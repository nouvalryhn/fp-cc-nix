import docker from './docker';

export async function deployApp(appName: string, imageName: string, env: Record<string, string> = {}) {
    // Check if container already exists
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find(c => c.Names.includes(`/${appName}`));

    if (existing) {
        console.log(`[${appName}] Stopping existing container...`);
        const container = docker.getContainer(existing.Id);
        if (existing.State === 'running') {
            await container.stop();
        }
        await container.remove();
    }

    console.log(`[${appName}] Starting new container from ${imageName}...`);

    // Format env for Docker
    const envArr = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    // Enforce PORT=3000 for Traefik compatibility
    if (!env['PORT']) {
        envArr.push('PORT=3000');
    }

    // We connect it to a specific network so Traefik can find it? 
    // For now, let's assume default bridge or host.
    // Traefik usually needs them on the same network.
    // Let's create a network 'paas_net' if not exists, but for MVP let's just use labels
    // and ensure Traefik is on the same network or publish ports.

    // Actually, for a simple implementation, we can just publish a random port or use Traefik labels.
    // Traefik labels are best for subdomains.

    await docker.createContainer({
        Image: imageName,
        name: appName,
        Env: envArr,
        Labels: {
            'traefik.enable': 'true',
            [`traefik.http.routers.${appName}.rule`]: `Host(\`${appName}.localhost\`)`,
            [`traefik.http.services.${appName}.loadbalancer.server.port`]: '3000', // Default assumption, might need config
        },
        HostConfig: {
            NetworkMode: 'paas-network',
        }
    }).then(async (container) => {
        // We should attach it to a network shared with Traefik
        // For now, allow start.
        await container.start();
    });

    console.log(`[${appName}] Deployed successfully!`);
}
