# Multi-stage build for Next.js 15
FROM node:25-alpine AS builder

# Install dependencies only when needed
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
COPY . .

# Build with production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:1.29.3-alpine AS runner

# Install curl for health checks
RUN apk add --no-cache curl

# Create nginx user (if not exists)
# RUN addgroup -g 101 -S nginx || true
# RUN adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Remove default nginx website
# RUN rm -rf /usr/share/nginx/html/*

# Copy built Next.js static files from builder stage
# COPY --from=builder /app/out /usr/share/nginx/html
# COPY --from=builder /app/public /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx directories and set permissions
# RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run \
#     && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run \
#     && chown -R nginx:nginx /usr/share/nginx/html \
#     && chmod -R 755 /usr/share/nginx/html

# Create pid file with proper permissions
# RUN touch /var/run/nginx.pid \
#     && chown nginx:nginx /var/run/nginx.pid

# Switch to non-root user
# USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]