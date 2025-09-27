# CrewAI Command Center Backend

## Overview
The backend is a FastAPI application that powers the CrewAI Command Center dashboard. It exposes REST endpoints for managing crews, streams system telemetry over Socket.IO, serves static frontend assets when bundled, and watches the crews directory for configuration changes. Core responsibilities include:

- **Crew lifecycle management** – create, edit, start, stop, import, and delete crew definitions stored under the configured `CREWS_PATH`.
- **Environment editing** – read and persist per-crew `.env` files through the REST API.
- **Template catalogue** – provide ready-to-use agent/task templates via `/api/crew-templates`.
- **Real-time telemetry** – publish activity events, log messages, and system stats (CPU, memory, request metrics) to connected clients.

The service also exposes OpenAPI documentation at `/docs` and drives the frontend through the `/api` namespace.

## Prerequisites
- Python 3.10+
- Recommended: `uv` or `pip` for dependency installation
- (Optional) Node.js when developing the frontend alongside the API

## Quick start
```bash
cd backend

# 1. Configure environment variables
cp .env.example .env

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Launch the API with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Visit `http://localhost:8001/docs` for interactive API documentation. When running the frontend separately, point `REACT_APP_API_BASE_URL` to `http://localhost:8001/api`.

> **Heads up:** If you set up the backend before this dependency cleanup, rerun `pip install -r requirements.txt` (or recreate the virtual environment) so the removed optional packages `chromadb`, `pypdf`, and `tiktoken` are uninstalled from your environment.

## Running tests
Execute the pytest suite from the `backend/` directory:

```bash
pytest
```

The tests cover core helpers such as the activity store and crew manager utilities.

## Project structure
- `main.py` – FastAPI application entry point; configures CORS, Socket.IO, system metrics, and API routes.
- `crew_manager.py` – High-level orchestration for crew CRUD, process control, templating, and log deduplication.
- `activity_store.py` – In-memory ring buffer for recent crew activity with retention policies.
- `agent_library.py` – Provides reusable agent presets exposed via the API.
- `crew_templates.py` – Template catalogue consumed by the frontend.
- `requirements*.txt` – Runtime and test dependency pins.
- `tests/` – Unit tests (pytest).

## API surface
All endpoints are rooted at `/api`:

- `GET /api/health` – Service liveness.
- `GET /api/system/stats` – Current CPU, memory, uptime, and request metrics sampled from middleware in `main.py`.
- `GET /api/system/stats/history` – Historical aggregates for the configured retention window.
- `GET /api/activity` – Recent activity events captured by `ActivityStore`.
- `GET /api/agents` – Available agent presets from `agent_library.py`.
- Template catalogue: `GET /api/crew-templates` and `GET /api/crew-templates/{template_id}`.
- Crew management: `GET /api/crews`, CRUD endpoints, and `/api/crews/{crew_id}/start|stop` for process control.
- Environment management: `/api/crews/{crew_id}/env-files` and `/api/crews/{crew_id}/env/{env_name}` for reading/writing `.env` content.

Socket.IO clients should connect to the same host (configurable via `REACT_APP_WS_URL`). Broadcasts include `system_stats`, `activity_event`, and crew log streams published by `CrewManager`.

## Configuration
Environment variables (see `.env.example`) tune runtime behaviour:

| Variable | Description |
|----------|-------------|
| `HOST`, `PORT` | Interface and port for the FastAPI/Socket.IO server. |
| `LOG_LEVEL` | Logging level (`info`, `debug`, etc.). |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins. |
| `CREWS_PATH` | Filesystem directory where crew definitions and env files are stored. Created if missing. |
| `FRONTEND_BUILD_DIR` | Optional path to a compiled frontend bundle served under `/`. Defaults to `../frontend/build`. |
| `SYSTEM_STATS_INTERVAL` | Sampling interval (seconds) for CPU/memory metrics. |
| `SYSTEM_STATS_RETENTION_SECONDS` | How long to retain stats for history queries. |
| `SYSTEM_STATS_INCLUDE_HISTORY_IN_SOCKET` | Include history payloads in Socket.IO `system_stats` broadcasts. |
| `SYSTEM_STATS_SOCKET_HISTORY_WINDOW` | History window key (`1h`, `24h`) for socket broadcasts. |
| `REQUEST_METRICS_WINDOW_SECONDS` | Rolling window for request latency/error aggregation. |
| `ACTIVITY_HISTORY_MAX_EVENTS` / `ACTIVITY_HISTORY_RETENTION_SECONDS` | Controls `ActivityStore` buffer size and pruning. |
| `SOCKET_PING_TIMEOUT`, `SOCKET_PING_INTERVAL`, `SOCKET_MAX_HTTP_BUFFER_SIZE` | Socket.IO server tuning knobs. |

Set `RELOAD=true` during development to auto-restart when files change. Docker users can rely on the `backend/Dockerfile` and root `docker-compose*.yml` definitions for containerized workflows.

## Additional tips
- The backend watches the crews directory using `watchdog` to keep UI state in sync when files change outside the app.
- Use the `/api/crews/import` endpoint to upload a bundled crew definition (YAML or JSON) exported from another environment.
- When running against GPU-heavy or resource-constrained hosts, adjust `SYSTEM_STATS_INTERVAL` to reduce collection overhead.
