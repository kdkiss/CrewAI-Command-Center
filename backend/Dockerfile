# Build Stage
FROM python:3.10-slim-bookworm AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Production Stage
FROM python:3.10-slim-bookworm

# Default user/group identifiers. These can be overridden at runtime by the
# entrypoint so the container matches the permissions of bind-mounted hosts
# without requiring a rebuild when the IDs change.
ARG APP_UID=1000
ARG APP_GID=1000

# Create an application user up front so filesystem ownership is consistent in
# the immutable layers. The runtime entrypoint can later mutate these IDs if
# the caller supplies different values through environment variables.

RUN groupadd -o -g ${APP_GID} appgroup \
    && useradd -o -u ${APP_UID} -r -g appgroup appuser

# Set working directory
WORKDIR /app
RUN chown appuser:appgroup /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages/ /usr/local/lib/python3.10/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY --chown=appuser:appgroup backend/ .

# Create and set permissions for crews directory within the app directory
RUN mkdir -p /app/crews && chown -R appuser:appgroup /app/crews

# Install runtime dependencies and the helper used by the entrypoint to switch
# users safely when the crews directory is writable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy the runtime entrypoint that reconciles user/group IDs and selects the
# appropriate user (appuser vs. root) based on the crews directory permissions.
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Normalize line endings for the entrypoint script so it works even when the
# repository was cloned on Windows where CRLF newlines are common. Otherwise the
# kernel would attempt to execute a non-existent "bash\r" binary.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Run the permission-aware entrypoint which will drop privileges to appuser when
# possible (falling back to root if the bind mount is not writable).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
