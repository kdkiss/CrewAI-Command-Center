# Deployment Guide

CrewAI Command Center can be deployed using Docker Compose for both development and production workflows. This guide outlines the recommended setups and configuration options.

## Development Deployment

For development with hot-reloading and debugging capabilities:

```bash
# Start development environment
docker compose -f docker-compose.dev.yml up --build
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API Documentation: http://localhost:8001/docs

## Production Deployment

For production deployment with optimized builds:

```bash
# Start production environment
docker compose up --build -d
```

**Access Points:**
- Frontend: http://localhost
- Backend API: http://localhost:8001
- API Documentation: http://localhost:8001/docs

> ⚠️ When running the backend in a production-only mode (serving the prebuilt UI without the React dev server), execute `npm run build` inside `frontend/` beforehand so the FastAPI app can serve the generated `frontend/build` directory.

## Environment Configuration

You can configure the Docker deployment using environment variables:

### Option 1: Environment File
Create a `.env` file in the project root with your custom settings.

### Option 2: Runtime Overrides
```bash
LOG_LEVEL=debug REACT_APP_API_BASE_URL=https://api.yourdomain.com/api REACT_APP_WS_URL=https://api.yourdomain.com docker compose up --build
```

### Option 3: Docker Compose Override
Create a `docker-compose.override.yml` file with your custom settings.

For detailed Docker deployment instructions, refer to the [Docker Deployment Guide](../DOCKER_DEPLOYMENT_GUIDE.md).
