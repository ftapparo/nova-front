# Stage 1: build
FROM node:20-alpine AS builder

ARG BUILD_VERSION=local
ENV BUILD_VERSION=${BUILD_VERSION}

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN echo ">>> BUILD_VERSION: ${BUILD_VERSION}" && npm run build

# Stage 2: serve
FROM nginx:1.27-alpine AS runner

ARG BUILD_VERSION=local
ENV BUILD_VERSION=${BUILD_VERSION}

RUN apk add --no-cache wget

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
