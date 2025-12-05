import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

const WORK_DIR = path.resolve(process.cwd(), 'temp_builds');

export async function buildImage(repoUrl: string, appName: string): Promise<string> {
    const buildId = Date.now().toString();
    const repoDir = path.join(WORK_DIR, appName, buildId);
    await fs.ensureDir(repoDir);

    console.log(`[${appName}] Cloning ${repoUrl}...`);
    await simpleGit().clone(repoUrl, repoDir);

    const imageName = `${appName}:latest`;
    console.log(`[${appName}] Building image ${imageName} using Nixpacks...`);

    // We rely on the host docker CLI.

    return new Promise((resolve, reject) => {
        // Construct the Docker command
        const args = [
            'run',
            '--rm',
            '-v', `${repoDir}:/app`,
            '-v', '/var/run/docker.sock:/var/run/docker.sock',
            'local-nixpacks-builder:latest',
            '/usr/local/bin/nixpacks', 'build', '/app',
            '--name', imageName
        ];

        console.log(`Running: docker ${args.join(' ')}`);

        const child = spawn('docker', args, { env: process.env, shell: true });

        child.stdout.on('data', (data) => process.stdout.write(`[build] ${data}`));
        child.stderr.on('data', (data) => process.stderr.write(`[build-err] ${data}`));

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`[${appName}] Build success!`);
                resolve(imageName);
            } else {
                console.error(`[${appName}] Build failed with code ${code}`);
                reject(new Error(`Build failed with exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            console.error(`[${appName}] Failed to start build process: ${err.message}`);
            reject(err);
        });
    });
}
