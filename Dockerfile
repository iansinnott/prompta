FROM node:20 as builder

RUN apt-get update; apt install -y curl python-is-python3 pkg-config build-essential
RUN mkdir /app
WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm run build:server


FROM node:20-slim as dist

COPY --from=builder /app /app
WORKDIR /app
ENV NODE_ENV production
ENV PORT 8080
CMD [ "node", "./dist-server/server.js" ]
