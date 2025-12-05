import Fastify from 'fastify';
import { z } from 'zod';
import { buildImage } from './lib/build';
import { deployApp } from './lib/deploy';
import docker from './lib/docker';

import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });
fastify.register(cors, {
    origin: true
});

const DeploySchema = z.object({
    repoUrl: z.string().url(),
    name: z.string().min(3),
    env: z.record(z.string(), z.string()).optional(),
});

fastify.post('/deploy', async (request, reply) => {
    try {
        const body = DeploySchema.parse(request.body);
        const { repoUrl, name, env } = body;

        fastify.log.info(`Received deploy request for ${name} from ${repoUrl}`);

        // 1. Build
        const imageName = await buildImage(repoUrl, name);

        // 2. Deploy
        await deployApp(name, imageName, env || {});

        return { status: 'success', url: `http://${name}.localhost` };
    } catch (err: any) {
        request.log.error(err);
        return reply.code(500).send({ status: 'error', message: err.message });
    }
});

fastify.get('/apps', async () => {
    const containers = await docker.listContainers();
    return containers
        .filter(c => c.Labels && c.Labels['traefik.enable'] === 'true')
        .map(c => ({
            id: c.Id,
            name: c.Names[0].replace('/', ''),
            status: c.Status,
            url: `http://${c.Names[0].replace('/', '')}.localhost`
        }));
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
