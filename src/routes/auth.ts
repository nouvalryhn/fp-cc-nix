import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/auth/register', async (request, reply) => {
        const { email, password } = RegisterSchema.parse(request.body);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(400).send({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword },
        });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    });

    fastify.post('/auth/login', async (request, reply) => {
        const { email, password } = LoginSchema.parse(request.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    });
}
