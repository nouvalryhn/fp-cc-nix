FROM ghcr.io/railwayapp/nixpacks:latest

# Install curl and docker (official script sets up repo)
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://get.docker.com | sh
# Install buildx plugin from the repo set up by get.docker.com
RUN apt-get update && apt-get install -y docker-buildx-plugin

# Install Nixpacks CLI
RUN curl -sSL https://nixpacks.com/install.sh | bash
