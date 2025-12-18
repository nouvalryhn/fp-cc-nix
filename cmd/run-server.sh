#! /bin/sh

cd ../
npm install

docker build -t local-nixpacks-builder builder/
docker network create paas-network
docker compose up -d

npx prisma generate
npx prisma migrate dev

npm run dev
