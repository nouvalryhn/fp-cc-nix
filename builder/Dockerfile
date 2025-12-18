FROM ghcr.io/railwayapp/nixpacks:latest

RUN apt update && apt install -y curl
RUN curl -fsSL https://get.docker.com | sh
RUN apt update && apt install -y docker-buildx-plugin

RUN curl -sSL https://nixpacks.com/install.sh | bash
