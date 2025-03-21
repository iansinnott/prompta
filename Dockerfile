FROM node:20 as builder

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN apt-get update; apt install -y python-is-python3 pkg-config build-essential
RUN mkdir /app
WORKDIR /app

COPY . .

# Use Bun instead of PNPM for package management
RUN bun install --frozen-lockfile
RUN bun pm trust --all
RUN bun run build:server

FROM node:20-slim as dist

COPY --from=builder /app /app
WORKDIR /app
ENV NODE_ENV production
ENV PORT 8080
CMD [ "node", "./dist-server/server.js" ]
