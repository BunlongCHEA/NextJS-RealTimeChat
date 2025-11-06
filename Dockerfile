# Multi-stage build for Next.js 15
FROM node:25-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build with production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production stage with Node.js + Nginx
FROM node:25-alpine AS runner

# Production stage with Nginx
# FROM nginx:1.29.3-alpine AS runner

# Install curl for health checks, nginx, and other utilities
RUN apk add --no-cache nginx curl

# Create app user
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /start.sh

# Copy supervisor configuration
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create ALL directories with 777 permissions AND fix /var/run
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
             /var/log/nginx \
             /var/lib/nginx \
             /var/lib/nginx/logs \
             /run/nginx \
             /app/logs && \
    chmod -R 777 /var/cache/nginx && \
    chmod -R 777 /var/log/nginx && \
    chmod -R 777 /var/lib/nginx && \
    chmod -R 777 /run/nginx && \
    chmod -R 777 /var/run && \
    chmod -R 777 /app && \
    chmod +x /start.sh && \
    touch /var/log/nginx/error.log /var/log/nginx/access.log /app/logs/nginx.pid && \
    chmod 777 /var/log/nginx/error.log /var/log/nginx/access.log /app/logs/nginx.pid

# Expose port
EXPOSE 8080 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start services
CMD ["/start.sh"]

# Start supervisor (manages both nginx and node.js)
# CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# Start nginx in foreground
# CMD ["nginx", "-g", "daemon off;"]