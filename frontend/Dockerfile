# Build Stage
FROM node:20-alpine AS build

# Accept build arguments for React environment variables.  These default to
# same-origin URLs so the nginx proxy can forward requests to the backend
# service without exposing internal hostnames to the browser.
ARG REACT_APP_API_BASE_URL=/api
ARG REACT_APP_WS_URL

# Set environment variables from build arguments
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
RUN chown appuser:appgroup /app

# Install dependencies as root (required for npm)
COPY package.json package-lock.json ./
RUN npm ci \
    && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Copy source code
COPY --chown=appuser:appgroup . .

# Build application and prune to production dependencies for the final image
RUN npm run build \
    && npm prune --omit=dev

# Development Stage
FROM node:20-alpine AS development
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown appuser:appgroup /app
USER appuser
CMD ["npm", "run", "dev"]

# Production Stage
FROM nginx:alpine AS production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create directories and set permissions
RUN mkdir -p /var/cache/nginx /var/run/nginx /tmp/nginx \
    && chown -R appuser:appgroup /var/cache/nginx \
    && chown -R appuser:appgroup /var/run/nginx \
    && chown -R appuser:appgroup /tmp/nginx \
    && chmod -R 755 /var/run/nginx \
    && chmod -R 755 /tmp/nginx

# Modify nginx.conf to use a PID file location the non-root user can access
RUN sed -i 's|pid        /run/nginx.pid;|pid        /tmp/nginx/nginx.pid;|g' /etc/nginx/nginx.conf

# Copy built files from build stage
COPY --from=build --chown=appuser:appgroup /app/build /usr/share/nginx/html

# Copy nginx configuration template for envsubst processing at runtime
COPY --chown=appuser:appgroup nginx.conf.template /etc/nginx/templates/default.conf.template

# Ensure the nginx configuration directories are writable by the runtime user so
# the stock nginx entrypoint can render the template into /etc/nginx/conf.d.
RUN chown -R appuser:appgroup /etc/nginx /var/cache/nginx /var/run/nginx /tmp/nginx

# Provide sane defaults so standalone `docker run` works without extra flags.
ENV BACKEND_SERVICE_HOST=backend \
    BACKEND_SERVICE_PORT=8001 \
    NGINX_PORT=3000

# Install runtime dependencies
RUN apk add --no-cache curl

# Provide a tiny wrapper around nginx's stock entrypoint so we can populate the
# new BACKEND_SERVICE_* variables from the legacy BACKEND_HOST/BACKEND_PORT when
# they are present.
COPY docker-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh
RUN chmod 755 /usr/local/bin/frontend-entrypoint.sh

# Switch to non-root user
USER appuser

EXPOSE 3000

# Execute the compatibility wrapper which then chains to nginx's entrypoint.
ENTRYPOINT ["/usr/local/bin/frontend-entrypoint.sh"]

# Use exec form of CMD
CMD ["nginx", "-g", "daemon off;"]
