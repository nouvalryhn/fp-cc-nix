import "dotenv/config";
import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { buildImage } from "./lib/build";
import { deployApp } from "./lib/deploy";
import docker from "./lib/docker";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth";
import { prisma } from "./db/client";
import jwt from "jsonwebtoken";

const fastify = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
fastify.register(authRoutes);

fastify.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.split(" ")[1];
      if (!token) return reply.status(401).send({ error: "Missing token" });
      const decoded = jwt.verify(token, JWT_SECRET);
      request.user = decoded;
    } catch (err) {
      reply.status(401).send({ error: "Invalid token" });
    }
  },
);

declare module "fastify" {
  interface FastifyRequest {
    user?: any;
  }
  interface FastifyInstance {
    authenticate: any;
  }
}

const DeploySchema = z.object({
  repoUrl: z.url({ message: "Invalid URL" }),
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  env: z.record(z.string(), z.string()).optional(),
  restartPolicy: z.string().optional(),
  maxRetries: z.number().optional(),
});



// Event Emitter for build logs
import { EventEmitter } from 'events';
const buildEvents = new EventEmitter();

fastify.get('/events/build/:buildId', async (request, reply) => {
  const { buildId } = request.params as { buildId: string };

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const listener = (msg: string) => {
    reply.raw.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
  };

  buildEvents.on(buildId, listener);

  request.raw.on('close', () => {
    buildEvents.off(buildId, listener);
  });
});

fastify.post(
  "/deploy",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    try {
      const body = DeploySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(404).send({ error: body.error.issues[0].message });
      }

      const { repoUrl, name, env, restartPolicy, maxRetries } = body.data;
      const userId = request.user.id;

      const existing = await prisma.app.findUnique({ where: { name } });
      if (existing)
        return reply.status(400).send({ error: "App name already taken" });

      const buildId = Date.now().toString();

      // Start build in background
      (async () => {
        try {
          const onLog = (msg: string) => buildEvents.emit(buildId, msg);

          fastify.log.info(`[${name}] Starting background build ${buildId}`);
          onLog(`Starting deployment for ${name}...`);

          const imageName = await buildImage(repoUrl, name, onLog);

          onLog(`Deploying container...`);
          await deployApp(name, imageName, env || {}, restartPolicy, maxRetries);

          await prisma.app.create({
            data: {
              name,
              repoUrl,
              userId,
              domain: `${name}.localhost`,
              status: "running",
            },
          });

          onLog(`Deployment successful!`);
          buildEvents.emit(buildId, 'DONE'); // Signal completion
        } catch (e: any) {
          fastify.log.error(e);
          buildEvents.emit(buildId, `ERROR: ${e.message}`);
        }
      })();

      return { status: "pending", buildId };

    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ status: "error", message: err.message });
    }
  },
);

fastify.get(
  "/apps",
  { preHandler: [fastify.authenticate] },
  async (request, _) => {
    const userId = request.user.id;
    const apps = await prisma.app.findMany({ where: { userId } });
    return apps;
  },
);

fastify.get(
  "/admin/apps",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    if (request.user.role !== "ADMIN")
      return reply.code(403).send({ error: "Forbidden" });
    const apps = await prisma.app.findMany({ include: { user: true } });
    return apps;
  },
);

fastify.patch(
  "/apps/:id",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });

    if (!app) return reply.code(404).send({ error: "App not found" });

    if (app.userId !== request.user.id && request.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    try {
      const container = docker.getContainer(app.name);
      const isRunning = app.status === "running";

      if (isRunning) {
        await container.stop();
      } else {
        await container.start();
      }

      await prisma.app.update({
        data: {
          status: isRunning ? "stopped" : "running",
        },
        where: {
          id,
        },
      });
      return {
        status: isRunning
          ? "container has stopped successfully"
          : "container has started successfully",
      };
    } catch (e: any) {
      console.log(`Failed to start/stop container: ${e} `);
    }
  },
);

fastify.delete(
  "/apps/:id",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });

    if (!app) return reply.code(404).send({ error: "App not found" });

    if (app.userId !== request.user.id && request.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    try {
      const container = docker.getContainer(app.name);
      await container.stop();
      await container.remove();
    } catch (e) {
      console.log("Container might not exist, ignoring error");
    }

    await prisma.app.delete({ where: { id } });
    return { status: "deleted" };
  },
);

fastify.get(
  "/apps/:id/metrics",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });

    if (!app) return reply.code(404).send({ error: "App not found" });

    if (app.userId !== request.user.id && request.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    try {
      const container = docker.getContainer(app.name);
      const stats = await container.stats({ stream: false });

      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      const memoryUsage = stats.memory_stats.usage / 1024 / 1024; // MB
      const memoryLimit = stats.memory_stats.limit / 1024 / 1024; // MB
      const memoryPercent =
        (stats.memory_stats.usage / stats.memory_stats.limit) * 100;

      const networks = stats.networks || {};
      let rxBytes = 0,
        txBytes = 0;
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
      return reply
        .code(500)
        .send({ error: "Failed to fetch metrics", message: e.message });
    }
  },
);


fastify.post(
  "/apps/:id/redeploy",
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await prisma.app.findUnique({ where: { id } });

    if (!app) return reply.code(404).send({ error: "App not found" });

    if (app.userId !== request.user.id && request.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const buildId = Date.now().toString();

    // Background Redeploy
    (async () => {
      try {
        const onLog = (msg: string) => buildEvents.emit(buildId, msg);
        onLog(`Starting redeploy for ${app.name}...`);

        // 1. Capture config
        let env: Record<string, string> = {};
        let restartPolicy = "no";
        let maxRetries = undefined;

        try {
          const container = docker.getContainer(app.name);
          const info = await container.inspect();
          info.Config.Env.forEach((e) => {
            const parts = e.split("=");
            const k = parts[0];
            const v = parts.slice(1).join("=");
            env[k] = v;
          });
          if (info.HostConfig?.RestartPolicy) {
            restartPolicy = info.HostConfig.RestartPolicy.Name;
            maxRetries = info.HostConfig.RestartPolicy.MaximumRetryCount;
          }
        } catch (e) {
          onLog(`Warning: Could not inspect container config.`);
        }

        // 2. Rebuild
        const imageName = await buildImage(app.repoUrl, app.name, onLog);

        // 3. Redeploy
        onLog(`Replacing container...`);
        await deployApp(app.name, imageName, env, restartPolicy, maxRetries);

        await prisma.app.update({
          where: { id },
          data: { status: 'running' }
        });

        onLog(`Redeployment successful!`);
        buildEvents.emit(buildId, 'DONE');

      } catch (err: any) {
        fastify.log.error(err);
        buildEvents.emit(buildId, `ERROR: ${err.message}`);
      }
    })();

    return { status: "pending", buildId, message: "Redeploy started" };
  },
);

const syncContainerStatus = async () => {
  try {
    const apps = await prisma.app.findMany();
    const containers = await docker.listContainers({ all: true });

    for (const app of apps) {
      const container = containers.find((c) => c.Names.some((n) => n === `/${app.name}`));
      const isRunning = container && container.State === 'running';
      const dbStatus = app.status === 'running';

      if (isRunning && !dbStatus) {
        console.log(`[Sync] Marking ${app.name} as running`);
        await prisma.app.update({ where: { id: app.id }, data: { status: 'running' } });
      } else if (!isRunning && dbStatus) {
        console.log(`[Sync] Marking ${app.name} as stopped`);
        await prisma.app.update({ where: { id: app.id }, data: { status: 'stopped' } });
      }
    }
  } catch (e) {
    console.error("Error syncing container status:", e);
  }
};

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server listening on http://localhost:3000");

    // Initial sync
    syncContainerStatus();
    // Periodic sync every 10 seconds
    setInterval(syncContainerStatus, 10000);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
