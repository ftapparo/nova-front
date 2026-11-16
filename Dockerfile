# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
# npm install, não npm ci: o npm ci falha no build do Portainer do servidor
# (já testado), mesmo passando localmente.
RUN npm install

COPY . .

# Nada de VITE_* aqui: o painel fala sempre com a própria origem (/v3) e o
# nginx repassa para a nova-api. Não há configuração que entre no bundle.
RUN BUILD_VERSION="$(date -u +%Y%m%d%H%M%S)-$(head -c 3 /dev/urandom | od -An -tx1 | tr -d ' \n')" && \
    echo ">>> BUILD_VERSION: ${BUILD_VERSION}" && \
    echo -n "${BUILD_VERSION}" > /tmp/build_version && \
    BUILD_VERSION="${BUILD_VERSION}" npm run build

# Stage 2: serve
FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache wget

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /tmp/build_version /etc/build_version
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
