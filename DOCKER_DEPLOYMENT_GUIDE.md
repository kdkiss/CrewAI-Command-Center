# Docker Deployment Guide

## Overview

This comprehensive guide covers the Docker setup for CrewAI Command Center, including deployment instructions, usage guidelines, troubleshooting, and security considerations. The application consists of a FastAPI backend and React frontend, orchestrated using Docker Compose.

## Architecture

The Docker setup includes:

- **Backend Service**: Python FastAPI application with Socket.IO support
- **Frontend Service**: React application served via Nginx (production) or development server (development)
- **Volume Mounts**: Persistent storage for crew configurations and data
- **Custom Networks**: Isolated networking between services
- **Health Checks**: Automatic service monitoring and restart capabilities

## 1. Deployment Instructions

### Prerequisites

- Docker Engine 24.x or later
- Docker Compose plugin (`docker compose` CLI)
- Minimum 4GB available RAM
- 2GB available disk space

### Development Deployment

For development with hot-reloading and debugging capabilities:

```bash
# Navigate to project root
cd /path/to/crewai-command-center

# Start development environment
docker compose -f docker-compose.dev.yml up --build
```

**Key Features:**
- Hot-reloading for both frontend and backend
- Development logging (debug level)
- Volume mounts for live code changes
- Development server for React frontend

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API Documentation: http://localhost:8001/docs

### Production Deployment

For production deployment with optimized builds:

```bash
# Navigate to project root
cd /path/to/crewai-command-center

# Start production environment
docker compose up --build -d
```

**Key Features:**
- Multi-stage builds for optimized images
- Nginx for static file serving
- Production logging (info level)
- Health checks for automatic recovery

**Access Points:**
- Frontend: http://localhost
- Backend API: http://localhost:8001
- API Documentation: http://localhost:8001/docs

### Environment Variable Configuration

#### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8001` | Server port |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warning, error) |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,http://192.168.56.1:3000` | Allowed CORS origins |
| `CREWS_PATH` | `/app/crews` | Path to crews directory |
| `SOCKET_PING_TIMEOUT` | `60` | Socket.IO ping timeout (seconds) |
| `SOCKET_PING_INTERVAL` | `25` | Socket.IO ping interval (seconds) |
| `SOCKET_MAX_HTTP_BUFFER_SIZE` | `100000000` | Maximum HTTP buffer size (bytes) |
| `RELOAD` | `false` | Enable auto-reload (development only) |
| `BACKEND_BIND_HOST` | `0.0.0.0` | Interface uvicorn binds to (override only when the backend runs outside Compose) |

To avoid permission issues with the mounted `./crews` directory inside Docker,
the backend entrypoint can realign the runtime user and group IDs based on the
`APP_UID` and `APP_GID` environment variables. Set them before `docker compose
up` if your host user/group IDs differ so the container can write to the bind
mount. When left unset the service tries to run as the bundled non-root user
and automatically falls back to root if the crews directory remains
read-only (a warning is emitted in the logs so you can correct the host
permissions later).


#### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `REACT_APP_API_BASE_URL` | `/api` | Backend REST base URL (proxied through nginx) |
| `REACT_APP_WS_URL` | same origin | Socket.IO URL |
| `NGINX_PORT` | `3000` | Nginx internal port (matches `FRONTEND_CONTAINER_PORT`) |
| `BACKEND_SERVICE_HOST` | `backend` | Internal hostname nginx proxies to within the Compose network |
| `BACKEND_SERVICE_PORT` | `8001` | Backend container port nginx forwards traffic to |

> **Tip:** Keep `BACKEND_SERVICE_HOST` pointed at the Compose service name
> (`backend`) so nginx can reach the API container. If you need the browser to
> talk to a different backend (for example, a remote deployment), override
> `REACT_APP_API_BASE_URL` instead of changing the service host/port variables.

#### Custom Environment Configuration

**Option 1: Environment File**
Create a `.env` file in the project root:

```bash
# Backend configuration
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Frontend configuration
REACT_APP_API_BASE_URL=https://api.yourdomain.com/api
REACT_APP_WS_URL=https://api.yourdomain.com
```

**Option 2: Runtime Overrides**
```bash
LOG_LEVEL=debug \
CORS_ORIGINS="http://localhost:3000,https://yourdomain.com" \
REACT_APP_API_BASE_URL=https://api.yourdomain.com/api \
docker compose up --build
```

**Option 3: Docker Compose Override**
Create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  backend:
    environment:
      - LOG_LEVEL=debug
      - CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

  frontend:
    environment:
      - REACT_APP_API_BASE_URL=https://api.yourdomain.com/api
      - REACT_APP_WS_URL=https://api.yourdomain.com
```

### Volume Mount Setup

#### Crews Directory

The application mounts `./crews:/app/crews` for persistent crew data:

```bash
# Ensure crews directory exists
mkdir -p ./crews

# Set proper permissions (if needed)
chmod 755 ./crews
```

**Volume Configuration:**
- **Host Path**: `./crews` (relative to docker-compose.yml location)
- **Container Path**: `/app/crews`
- **Purpose**: Store crew configurations and persistent data
- **Permissions**: Read-write for crew management operations

#### Development Volume Mounts

For development, additional volume mounts enable hot-reloading:

```yaml
# Frontend development mount
- ./frontend:/app
- /app/node_modules

# Backend development mount
- ./backend:/app
```

## 2. Usage Instructions

### Starting Services

#### Development Mode
```bash
# Start with build
docker compose -f docker-compose.dev.yml up --build

# Start in background
docker compose -f docker-compose.dev.yml up --build -d
```

#### Production Mode
```bash
# Start with build
docker compose up --build

# Start in background
docker compose up --build -d
```

### Stopping Services

#### Graceful Shutdown
```bash
# Stop all services
docker compose down

# Stop with volumes removal (WARNING: removes persistent data)
docker compose down -v
```

#### Emergency Stop
```bash
# Force stop all containers
docker compose kill
```

### Viewing Logs

#### Real-time Log Monitoring
```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend

# View last 100 lines
docker compose logs --tail=100 backend
```

#### Log Filtering
```bash
# Filter by log level
docker compose logs -f | grep -i error
docker compose logs -f | grep -i warning

# Filter by specific text
docker compose logs -f | grep "socket\|connection"
```

### Accessing the Application

#### Development Environment
- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/api/health

#### Production Environment
- **Frontend UI**: http://localhost
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **Health Check**: http://localhost/health

#### Service Health Verification
```bash
# Check container status
docker compose ps

# Check service health
curl http://localhost:8001/api/health
curl http://localhost/health

# View detailed health status
docker compose ps --format table
```

## 3. Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Port Conflicts
**Symptoms**: Error binding to port 3000 or 8001
**Solution**:
```bash
# Check what's using the ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :8001

# Stop conflicting services
sudo systemctl stop nginx  # or other web servers

# Use different ports
docker compose -f docker-compose.dev.yml up --build -d
# Then modify port mapping in docker-compose files
```

#### Issue 2: Volume Permission Errors
**Symptoms**: Backend cannot read/write to crews directory
**Solution**:
```bash
# Fix directory permissions
sudo chown -R $USER:$USER ./crews
chmod -R 755 ./crews

# Or run with proper user mapping
docker compose -f docker-compose.dev.yml up --build
```

#### Issue 3: Build Failures
**Symptoms**: Docker build fails during image creation
**Solution**:
```bash
# Clear Docker cache
docker system prune -a

# Rebuild specific service
docker compose build --no-cache backend

# Check available disk space
df -h
```

#### Issue 4: Service Dependencies
**Symptoms**: Frontend cannot connect to backend
**Solution**:
```bash
# Check service health
docker compose ps

# View backend logs
docker compose logs backend

# Restart services in order
docker compose down
docker compose up --build backend
docker compose up --build frontend
```

#### Issue 5: Memory Issues
**Symptoms**: Containers crash with out-of-memory errors
**Solution**:
```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### Service Health Checks

#### Manual Health Verification
```bash
# Backend health check
curl -f http://localhost:8001/api/health

# Frontend health check
curl -f http://localhost/health

# Docker health status
docker compose ps
```

#### Automated Health Monitoring
```bash
# Monitor health continuously
watch -n 5 'docker compose ps && echo "--- Backend Health ---" && curl -s http://localhost:8001/api/health && echo -e "\n--- Frontend Health ---" && curl -s http://localhost/health'
```

### Volume Mount Verification

#### Check Volume Status
```bash
# List volumes
docker volume ls | grep crewai

# Inspect volume details
docker volume inspect crewai-network_default

# Check mount points
docker compose exec backend ls -la /app/crews
```

#### Verify Data Persistence
```bash
# Create test file
echo "test data" > ./crews/test.txt

# Check if file exists in container
docker compose exec backend cat /app/crews/test.txt

# Restart container and verify persistence
docker compose restart backend
docker compose exec backend cat /app/crews/test.txt
```

### Connection Debugging

#### Network Connectivity
```bash
# Test internal network connectivity
docker compose exec backend curl -f http://frontend:3000
docker compose exec frontend curl -f http://backend:8001/api/health

# Check DNS resolution
docker compose exec backend nslookup frontend
docker compose exec frontend nslookup backend
```

#### WebSocket Connection Issues
```bash
# Test WebSocket connectivity
docker compose exec backend curl -I -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:8001/socket.io/?EIO=3&transport=websocket

# Check WebSocket logs
docker compose logs -f backend | grep -i socket
```

#### CORS Issues
```bash
# Test CORS headers
curl -I -H "Origin: http://localhost:3000" http://localhost:8001/api/health

# Check CORS configuration
docker compose exec backend python -c "from main import app; print('CORS origins:', app.cors_origins)"
```

## 4. Security Considerations

### Non-Root User Setup

Both services run with non-root users for enhanced security:

**Backend Container:**
- User: `appuser` (UID/GID: dynamically assigned)
- Group: `appgroup`
- Working directory: `/app` (owned by appuser)
- Crews directory: `/crews` (owned by appuser)

**Frontend Container:**
- User: `appuser` (UID/GID: dynamically assigned)
- Group: `appgroup`
- Nginx cache and run directories: owned by appuser

**Security Benefits:**
- Reduced attack surface
- Limited container breakout potential
- Proper file system permissions
- Compliance with security best practices

### Environment Variable Management

#### Secure Environment Variables
```bash
# Use Docker secrets for sensitive data
echo "your-secret-key" | docker secret create api_secret_key -

# Reference in docker-compose.yml
secrets:
  - api_secret_key

services:
  backend:
    secrets:
      - api_secret_key
    environment:
      - SECRET_KEY_FILE=/run/secrets/api_secret_key
```

#### Environment Validation
```bash
# Validate required environment variables
docker compose config

# Check for missing variables
docker compose exec backend env | grep -E "(HOST|PORT|LOG_LEVEL|CORS_ORIGINS|CREWS_PATH)"
```

### Network Isolation

#### Custom Network Configuration
```yaml
networks:
  crewai-network:
    driver: bridge
    internal: false
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Network Security Features:**
- Isolated bridge network
- Service-to-service communication only
- No external network exposure (except mapped ports)
- DNS resolution between services

#### Firewall Configuration
```bash
# Restrict container networking (Linux)
sudo iptables -I DOCKER-USER -i docker0 -d 172.20.0.0/16 -j DROP

# Allow only specific ports
sudo iptables -I DOCKER-USER -i docker0 -p tcp --dport 8001 -j ACCEPT
sudo iptables -I DOCKER-USER -i docker0 -p tcp --dport 3000 -j ACCEPT
```

### Security Best Practices

#### Image Security
- Use official base images only
- Multi-stage builds for minimal attack surface
- Regular base image updates
- Vulnerability scanning: `docker scan <image>`

#### Container Security
```bash
# Run security scans
docker compose exec backend apk audit  # Alpine
docker compose exec backend apt list --upgradable  # Debian

# Check running processes
docker compose exec backend ps aux

# Verify user context
docker compose exec backend whoami
docker compose exec backend id
```

#### Access Control
```bash
# Limit Docker daemon access
sudo groupadd docker
sudo usermod -aG docker $USER

# Set proper file permissions
chmod 600 docker-compose*.yml
chmod 600 .env*

# Regular security updates
docker compose pull
docker compose up --build
```

#### Monitoring and Logging
```bash
# Enable Docker daemon logging
sudo dockerd --log-level=info

# Monitor resource usage
docker compose exec backend top
docker compose exec frontend top

# Check file integrity
docker compose exec backend find /app -type f -exec ls -la {} \;
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Security](https://fastapi.tiangolo.com/deployment/)
- [Nginx Security](https://nginx.org/en/docs/)
- [Python Security Best Practices](https://docs.python.org/3/using/cmdline.html#cmdoption-R)

## Support

For additional support or questions about the Docker deployment:

1. Check the troubleshooting section above
2. Review the application logs: `docker compose logs -f`
3. Verify system requirements and prerequisites
4. Check Docker daemon status: `sudo systemctl status docker`
5. Review firewall and network configuration

---

*This documentation was last updated: 2025-09-21*
*Docker Compose version: 3.8*
*Base images: python:3.10-slim-bookworm, node:20-alpine, nginx:alpine*