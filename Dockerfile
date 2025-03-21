# syntax=docker/dockerfile:1.3-labs

FROM node:20-slim as builder

ARG TELEMETRY=1

# Set sensible shell
SHELL ["/bin/bash", "-e", "-c"]

# Install needed debian packages
RUN <<EOF
apt-get update
DEBIAN_FRONTEND=noninteractive
apt-get install -y curl 
apt-get install -y --no-install-recommends pkg-config build-essential s6 nginx unzip
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
EOF

# Install app
ENV HOME=/home/prompta
ENV APP=$HOME/app
ENV SYNC_SERVER_PATH=/db/
ENV DATA=/data

# Create entrypoint, prompta user, and key directories
RUN <<EOF
cat <<EOT >/entrypoint.sh
#!/bin/bash
exec /usr/bin/s6-svscan $HOME/s6
EOT

useradd --home-dir $HOME --shell /bin/bash prompta
mkdir -p $APP $DATA
chown -R prompta:prompta $HOME $DATA /entrypoint.sh
chmod 755 /entrypoint.sh
EOF

# Do the rest as prompta user, in the app dir
USER prompta
WORKDIR $APP

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="$HOME/.bun/bin:${PATH}"

# Copy in the code
COPY --chown=prompta:prompta . .

# Make client app's default sync-server URI relative to URI on which it's hosted
RUN sed -r -i.bak "s|return.*https://prompta-production.up.railway.app.*$|return window.location.href.replace(/(https?:\\\/\\\/[^\\\/]+)(\\\/.*)?$/, \"\$1$SYNC_SERVER_PATH\");|" src/lib/sync/vlcn.ts

# Disable telemetry
RUN [ "$TELEMETRY" = 0 ] && sed -r -i.bak 's!(cap\(|window.posthog.capture\()!return; // &!' src/lib/capture.ts

# # Use Bun instead of PNPM for package management
RUN bun install --frozen-lockfile && \
    bun pm trust --all

# Build static client
RUN bun run ui:build-static

# Compile db server typescript
RUN bun run build:server

# Create s6 runscripts
WORKDIR $HOME

RUN <<EOF
mkdir -p s6/db s6/www

cat <<EOT >$HOME/s6/www/run
#!/bin/bash

exec /usr/sbin/nginx -c $APP/nginx.conf -g 'daemon off;'
EOT

cat <<EOT >$HOME/s6/db/run
#!/bin/bash

cd $APP
export PORT=8081
export HOST=127.0.0.1
export BODYLIMIT=100
export RAILWAY_VOLUME_MOUNT_PATH="$DATA"
exec node ./dist-server/server.js
EOT

chmod 755 $HOME/s6/*/run

cat <<'EOT' >$APP/nginx.conf

pid /tmp/nginx.pid;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    client_body_temp_path /tmp;
    proxy_temp_path /tmp;
    fastcgi_temp_path /tmp;
    uwsgi_temp_path /tmp;
    scgi_temp_path /tmp;
    access_log /dev/stdout;
    error_log /dev/stderr;

    server {
        listen 8080;

        location / {
            root APP/build;
            index index.html;
        }

        location ~ ^SYNC_SERVER_PATH(.*) {
            client_max_body_size 0;
            proxy_read_timeout 36000s;
            proxy_pass http://127.0.0.1:8081/$1$is_args$args;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Cookie $http_cookie;
        }
    }
}
EOT

sed -ri "s|APP|$APP|g; s|SYNC_SERVER_PATH|$SYNC_SERVER_PATH|g" $APP/nginx.conf
EOF

ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 8080
