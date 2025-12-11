import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { buildImage } from './lib/build';
import { deployApp } from './lib/deploy';
import docker from './lib/docker';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth';
import { prisma } from './db/client';
import jwt from 'jsonwebtoken';

const fastify = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

fastify.register(cors, { origin: true });
fastify.register(authRoutes);

// Auth Middleware
fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const token = request.headers.authorization?.split(' ')[1];
        if (!token) return reply.status(401).send({ error: 'Missing token' });
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
    } catch (err) {
        reply.status(401).send({ error: 'Invalid token' });
    }
});

declare module 'fastify' {
    interface FastifyRequest {
        user?: any;
    }
    interface FastifyInstance {
        authenticate: any;
    }
}

const DeploySchema = z.object({
    repoUrl: z.string().url(),
    name: z.string().min(3),
    env: z.record(z.string(), z.string()).optional(),
});

fastify.post('/deploy', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
        const body = DeploySchema.parse(request.body);
        const { repoUrl, name, env } = body;
        const userId = request.user.id;

        // Check if name exists
        const existing = await prisma.app.findUnique({ where: { name } });
        if (existing) return reply.status(400).send({ error: 'App name already taken' });

        fastify.log.info(`Received deploy request for ${name} from ${repoUrl}`);

        const imageName = await buildImage(repoUrl, name);
        await deployApp(name, imageName, env || {});

        const app = await prisma.app.create({
            data: {
                name,
                repoUrl,
                userId,
                domain: `${name}.localhost`,
                status: 'running'
            }
        });

        return { status: 'success', app };
    } catch (err: any) {
        request.log.error(err);
        return reply.code(500).send({ status: 'error', message: err.message });
    }
});

fastify.get('/apps', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const apps = await prisma.app.findMany({ where: { userId } });
    return apps;
});

// Admin Route
fastify.get('/admin/apps', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' });
    const apps = await prisma.app.findMany({ include: { user: true } });
    return apps;
});

fastify.delete('/apps/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });

    if (!app) return reply.code(404).send({ error: 'App not found' });

    // Check ownership
    if (app.userId !== request.user.id && request.user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Forbidden' });
    }

    // Teardown logic
    try {
        const container = docker.getContainer(app.name);
        await container.stop();
        await container.remove();
    } catch (e) {
        console.log('Container might not exist, ignoring error');
    }

    await prisma.app.delete({ where: { id } });
    return { status: 'deleted' };
});

fastify.get('/apps/:id/metrics', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });
    
    if (!app) return reply.code(404).send({ error: 'App not found' });
    
    if (app.userId !== request.user.id && request.user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
        const container = docker.getContainer(app.name);
        const stats = await container.stats({ stream: false });
        
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

        const memoryUsage = stats.memory_stats.usage / 1024 / 1024; // MB
        const memoryLimit = stats.memory_stats.limit / 1024 / 1024; // MB
        const memoryPercent = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;

        const networks = stats.networks || {};
        let rxBytes = 0, txBytes = 0;
        Object.values(networks).forEach((net: any) => {
            rxBytes += net.rx_bytes;
            txBytes += net.tx_bytes;
        });

        return {
            cpu: {
                percent: cpuPercent.toFixed(2),
            },
            memory: {
                usage: memoryUsage.toFixed(2),
                limit: memoryLimit.toFixed(2),
                percent: memoryPercent.toFixed(2),
            },
            network: {
                rxBytes,
                txBytes,
            },
        };
    } catch (e: any) {
        return reply.code(500).send({ error: 'Failed to fetch metrics', message: e.message });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
