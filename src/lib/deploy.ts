import docker from "./docker";

export async function deployApp(
  appName: string,
  imageName: string,
  env: Record<string, string> = {},
) {
  const containers = await docker.listContainers({ all: true });
  const existing = containers.find((c) => c.Names.includes(`/${appName}`));

  if (existing) {
    console.log(`[${appName}] Stopping existing container...`);
    const container = docker.getContainer(existing.Id);
    if (existing.State === "running") {
      await container.stop();
    }
    await container.remove();
  }

  console.log(`[${appName}] Starting new container from ${imageName}...`);

  const envArr = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  if (!env["PORT"]) {
    envArr.push("PORT=3000");
  }
  if (!env["HOST"]) {
    envArr.push("HOST=0.0.0.0");
  }

  await docker
    .createContainer({
      Image: imageName,
      name: appName,
      Env: envArr,
      Labels: {
        "traefik.enable": "true",
        [`traefik.http.routers.${appName}.rule`]: `Host(\`${appName}.localhost\`)`,
        [`traefik.http.services.${appName}.loadbalancer.server.port`]: "3000",
      },
      HostConfig: {
        NetworkMode: "paas-network",
      },
    })
    .then(async (container) => {
      await container.start();
    });

  console.log(`[${appName}] Deployed successfully!`);
}
