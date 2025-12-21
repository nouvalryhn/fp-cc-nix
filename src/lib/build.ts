import simpleGit from "simple-git";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";

const WORK_DIR = path.resolve(process.cwd(), "temp_builds");

export async function buildImage(
  repoUrl: string,
  appName: string,
  onLog?: (msg: string) => void
): Promise<string> {
  const buildId = Date.now().toString();
  const repoDir = path.join(WORK_DIR, appName, buildId);
  await fs.ensureDir(repoDir);

  const log = (msg: string) => {
    console.log(msg.trim());
    if (onLog) onLog(msg);
  }

  log(`[${appName}] Cloning ${repoUrl}...`);
  await simpleGit().clone(repoUrl, repoDir);

  const imageName = `${appName}:latest`;
  log(`[${appName}] Building image ${imageName} using Nixpacks...`);

  return new Promise((resolve, reject) => {
    const args = [
      "run",
      "--rm",
      "-v",
      `${repoDir}:/app`,
      "-v",
      "/var/run/docker.sock:/var/run/docker.sock",
      "-e",
      "NIXPACKS_NODE_VERSION=20",
      "local-nixpacks-builder:latest",
      "/usr/local/bin/nixpacks",
      "build",
      "/app",
      "--env",
      "NIXPACKS_NODE_VERSION=20",
      "--name",
      imageName,
    ];

    log(`Running: docker ${args.join(" ")}`);

    const child = spawn("docker", args, { env: process.env, shell: true });

    child.stdout.on("data", (data) => log(`[build] ${data}`));
    child.stderr.on("data", (data) => log(`[build-err] ${data}`));

    child.on("close", (code) => {
      if (code === 0) {
        log(`[${appName}] Build success!`);
        resolve(imageName);
      } else {
        log(`[${appName}] Build failed with code ${code}`);
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      log(`[${appName}] Failed to start build process: ${err.message}`);
      reject(err);
    });
  });
}
