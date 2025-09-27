# Docker Setup Documentation

## Overview
This guide describes how to run CrewAI Command Center with Docker. The repository ships with a single `docker-compose.yml` file that builds and orchestrates the FastAPI backend and the React/Nginx frontend.

## Prerequisites
- Docker Engine 24.x or later
- Docker Compose plugin (`docker compose` CLI)

## Compose topology
`docker-compose.yml` defines the following services:

| Service   | Image Build Context | Exposed Ports | Key Responsibilities |
|-----------|--------------------|---------------|----------------------|
| `backend` | `backend/Dockerfile` | `8001:8001`   | Runs the FastAPI application, Socket.IO server and watches the mounted crew directory. |
| `frontend`| `frontend/Dockerfile`| `80:80`       | Serves the compiled React dashboard via Nginx and proxies websocket traffic to the backend. |

Shared state is persisted through the volume mount `./crews:/app/crews`, ensuring the crews you manage from the UI are available across container restarts.

## Environment variables
Both services rely on configuration that is surfaced as environment variables in `docker-compose.yml`.

### Backend
The backend service accepts the same variables documented in `backend/.env.example`:

- `HOST` (default `0.0.0.0`)
- `PORT` (default `8001`)
- `LOG_LEVEL`
- `CORS_ORIGINS`
- `CREWS_PATH`
- `SOCKET_PING_TIMEOUT`
- `SOCKET_PING_INTERVAL`
- `SOCKET_MAX_HTTP_BUFFER_SIZE`

When running with bind mounts (the default `./crews:/app/crews`) you may also
need to align the container user with your host's user and group IDs so the
backend can write to the mounted directory. The runtime entrypoint listens for
the `APP_UID` and `APP_GID` environment variables and mutates the container
user on startup:

- `APP_UID` (optional)
- `APP_GID` (optional)

Set them before starting the stack if your host uses non-default IDs:

```bash
APP_UID=$(id -u) APP_GID=$(id -g) docker compose up
```

If the bind mount remains read-only, the backend logs a warning and continues
running as root so the UI stays available. Fix the host permissions and restart
the service to drop back to the unprivileged user.


### Frontend
The frontend service accepts the variables found in `frontend/.env.example`:

- `REACT_APP_API_BASE_URL`
- `REACT_APP_WS_URL`
- `NODE_ENV`

### Passing custom values
The compose file sets sensible defaults inline. If you need to override them you have two options:

1. **Edit or extend the compose file** – duplicate the relevant section into `docker-compose.override.yml` and adjust the `environment` entries, e.g.
   ```yaml
   services:
     backend:
       environment:
         HOST: 0.0.0.0
         PORT: 8001
         LOG_LEVEL: debug
     frontend:
       environment:
        REACT_APP_API_BASE_URL: "/api"
        REACT_APP_WS_URL: ""
   ```
   Docker Compose automatically reads `docker-compose.override.yml` when present.

2. **Inline overrides at runtime** – provide the desired values before the compose command:
   ```bash
   REACT_APP_API_BASE_URL=https://example.internal/api \
   REACT_APP_WS_URL=https://example.internal/api \
   LOG_LEVEL=debug \
   docker compose up --build
   ```

In both cases you can refer back to the `.env.example` files for the full list of supported options.

## Running the stack
From the repository root, build and start the containers:

```bash
docker compose up --build
```

The first run performs the image builds defined in each Dockerfile. Subsequent starts can omit `--build` unless source code changes are made.

### Useful commands
- Start in detached mode: `docker compose up --build -d`
- Follow logs: `docker compose logs -f backend` or `docker compose logs -f frontend`
- Stop and remove containers: `docker compose down`

## Accessing the application
- Frontend UI: [http://localhost](http://localhost)
- Backend API docs: [http://localhost:8001/docs](http://localhost:8001/docs)

When running in Docker, the frontend is already configured to talk to the backend service through the bundled nginx proxy. By default the React bundle targets `/api` and the same-origin Socket.IO endpoint, allowing nginx to forward those requests to the backend container. Adjust the environment variables if you need the browser to call a different host or you deploy behind another proxy.
