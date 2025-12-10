# Minimalist PaaS

## Overview
We have built a minimalist Platform-as-a-Service (PaaS) that runs on a single Linux server (simulated here on Windows). It uses **Docker** and **Nixpacks** to automatically build and deploy applications from Git repositories.

## Components
-   **Orchestrator**: Node.js API server (`src/server.ts`).
-   **Builder**: Uses `ghcr.io/railwayapp/nixpacks` to build container images.
-   **Router**: **Traefik** reverse proxy to route subdomains to containers.

## Setup
1.  **Installation**:
    ```bash
    npm install
    ```
2.  **Build Builder Image**:
    ```bash
    docker build -t local-nixpacks-builder builder/
    ```
3.  **Infrastructure**:
    Start Traefik (proxy) and PostgreSQL (database):
    ```bash
    docker network create paas-network
    docker-compose up -d
    ```
4.  **Database Setup**:
    Run Prisma migrations to initialize the schema:
    ```bash
    npx prisma migrate dev
    ```

## Usage

### 1. Start the Server
```bash
npm run dev
```
*Server runs on port 3000.*

### 2. Start the Frontend (Dashboard)
```bash
cd web
npm run dev
```
*Dashboard runs on port 5173.*

### 3. Deploy an App
You can use the dashboard at `http://localhost:5173` or the API directly:
```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/railwayapp-templates/node-express", "name":"my-app"}'
```

### 4. Access
The app is accessible via Traefik:
```bash
curl -H "Host: my-app.localhost" http://localhost
```

## Features Verified
### Routing
- **Status**: Success
- **Test**: `curl -H "Host: simple-app.localhost" http://localhost`
- **Result**: `Hello from PaaS!`
- **Note**: Deployment logic enforces `PORT=3000` to match Traefik configuration.

### Frontend (SvelteKit)
- **Status**: Success
- **URL**: `http://localhost:5173`
- **Features**:
    -   **Dashboard**: Lists running apps with status.
    -   **Deploy**: Form to deploy new apps from Git URLs.
-   **Verification**: Verified page load and API connectivity.

## V2 Features (Auth & DB)
-   **Database**: PostgreSQL (Prisma ORM)
-   **Auth**: JWT-based Email/Password
-   **Roles**: User and Superadmin

### Verified Stacks
-   **Node.js**: `railwayapp-templates/node-express` (Port 3000)
-   **Go**: `railwayapp-templates/gin` (Port 3000)
    -   *Note*: Nixpacks automatically detected Go and built the binary.
-   **Next.js**: `railwayapp-templates/nextjs-basic` (Port 3000)
