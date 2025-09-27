from fastapi import FastAPI, HTTPException, Request, Body, Query

from typing import Dict, Any, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import socketio
import asyncio
import copy
import json
import os
import re
import yaml
import logging
import math
import time
from collections import deque
from threading import Lock
from dotenv import load_dotenv
import psutil
import platform
from datetime import datetime, timedelta, timezone
from pathlib import Path
from watchdog.events import FileSystemEventHandler

_WATCHDOG_IMPORT_ERROR: Optional[Exception] = None
try:  # pragma: no cover - import guard for optional dependency
    from watchdog.observers import Observer  # type: ignore
except Exception as exc:  # pragma: no cover - logged after logging is configured
    Observer = None  # type: ignore[assignment]
    _WATCHDOG_IMPORT_ERROR = exc
from crew_manager import CrewManager, normalize_crew_identifier
from activity_store import ActivityStore
from fastapi import APIRouter
from metrics_store import MetricsStore, RequestMetricRecord

# Load environment variables
load_dotenv()

# Configuration from environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8001))
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
CREWS_PATH = os.getenv('CREWS_PATH', str(Path(__file__).parent.parent / "crews"))
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
DEFAULT_FRONTEND_BUILD_DIR = BASE_DIR / "frontend" / "build"
FRONTEND_BUILD_DIR = Path(
    os.getenv('FRONTEND_BUILD_DIR', str(DEFAULT_FRONTEND_BUILD_DIR))
).expanduser()
SYSTEM_STATS_INTERVAL = int(os.getenv('SYSTEM_STATS_INTERVAL', 5))
SYSTEM_STATS_RETENTION_SECONDS = int(os.getenv('SYSTEM_STATS_RETENTION_SECONDS', 60 * 60 * 24))

SYSTEM_STATS_HISTORY_WINDOWS = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
}

SYSTEM_STATS_DEFAULT_HISTORY_WINDOW = os.getenv('SYSTEM_STATS_DEFAULT_HISTORY_WINDOW', '1h')
if SYSTEM_STATS_DEFAULT_HISTORY_WINDOW not in SYSTEM_STATS_HISTORY_WINDOWS:
    SYSTEM_STATS_DEFAULT_HISTORY_WINDOW = '1h'

SYSTEM_STATS_INCLUDE_HISTORY_IN_SOCKET = os.getenv('SYSTEM_STATS_INCLUDE_HISTORY_IN_SOCKET', 'false').lower() in {'1', 'true', 'yes', 'on'}
SYSTEM_STATS_SOCKET_HISTORY_WINDOW = os.getenv('SYSTEM_STATS_SOCKET_HISTORY_WINDOW', SYSTEM_STATS_DEFAULT_HISTORY_WINDOW)
if SYSTEM_STATS_SOCKET_HISTORY_WINDOW not in SYSTEM_STATS_HISTORY_WINDOWS:
    SYSTEM_STATS_SOCKET_HISTORY_WINDOW = SYSTEM_STATS_DEFAULT_HISTORY_WINDOW

REQUEST_METRICS_WINDOW_SECONDS = int(os.getenv('REQUEST_METRICS_WINDOW_SECONDS', 300))

DEFAULT_METRICS_DB_PATH = Path(__file__).resolve().parent / "data" / "metrics.db"
METRICS_DB_PATH = Path(os.getenv('METRICS_DB_PATH', str(DEFAULT_METRICS_DB_PATH))).expanduser()

ACTIVITY_HISTORY_MAX_EVENTS = int(os.getenv('ACTIVITY_HISTORY_MAX_EVENTS', 500))
ACTIVITY_HISTORY_RETENTION_SECONDS = int(os.getenv('ACTIVITY_HISTORY_RETENTION_SECONDS', 3600))
ACTIVITY_HISTORY_PRUNE_INTERVAL = int(os.getenv('ACTIVITY_HISTORY_PRUNE_INTERVAL', 60))
DEFAULT_ACTIVITY_HISTORY_STORAGE_PATH = Path(__file__).resolve().parent / "activity_history.json"
ACTIVITY_HISTORY_STORAGE_PATH = Path(
    os.getenv('ACTIVITY_HISTORY_STORAGE_PATH', str(DEFAULT_ACTIVITY_HISTORY_STORAGE_PATH))
).expanduser()

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

if _WATCHDOG_IMPORT_ERROR is not None:  # pragma: no cover - environment specific
    logger.warning(
        "Watchdog file observer unavailable; directory change notifications disabled: %s",
        _WATCHDOG_IMPORT_ERROR,
    )

# Log the CREWS_PATH for debugging
logger.info(f"Using CREWS_PATH: {CREWS_PATH}")
logger.info(f"Absolute CREWS_PATH: {os.path.abspath(CREWS_PATH)}")


def ensure_crews_directory(path: Path) -> Path:
    """Ensure the crews directory exists and warn if it is not writable.

    The backend previously aborted startup when it could not create the
    directory or when the directory was read-only. In containerised
    environments the bind-mounted folder can legitimately be owned by another
    user which triggered an exception and left the API unavailable (manifesting
    as 502 responses). To keep the service reachable we now log the failure and
    continue. Subsequent write attempts will surface a more targeted error from
    the relevant API endpoint.
    """

    try:
        path.mkdir(parents=True, exist_ok=True)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "Unable to create crews directory %s (continuing in read-only mode): %s",
            path,
            exc,
        )
        return path

    test_file = path / ".crews-permission-check"
    try:
        test_file.write_text("ok", encoding="utf-8")
    except PermissionError as exc:
        logger.warning(
            "Crews directory %s is not writable (continuing in read-only mode): %s",
            path,
            exc,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "Could not verify writability for crews directory %s: %s",
            path,
            exc,
        )
    else:
        try:
            test_file.unlink()
        except Exception:  # pragma: no cover - best-effort cleanup
            pass

    return path

app = FastAPI()
router = APIRouter(prefix="/api")

system_stats_history = deque()
system_stats_history_lock = Lock()
request_metrics: Dict[str, Any] = {}
activity_store = ActivityStore(
    max_events=ACTIVITY_HISTORY_MAX_EVENTS,
    retention_seconds=ACTIVITY_HISTORY_RETENTION_SECONDS,
    storage_path=ACTIVITY_HISTORY_STORAGE_PATH,
)
metrics_store = MetricsStore(METRICS_DB_PATH)
_activity_prune_task = None


def _record_activity_event(event_type: str, payload: Dict[str, Any]) -> None:
    try:
        activity_store.add_event(event_type, payload)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Failed to record %s event: %s", event_type, exc)


def _default_request_metrics() -> Dict[str, Any]:
    return {
        "latency": {
            "averageMs": 0.0,
            "p95Ms": 0.0,
            "sampleSize": 0,
            "windowSeconds": REQUEST_METRICS_WINDOW_SECONDS,
        },
        "errorRate": {
            "ratio": 0.0,
            "errors": 0,
            "requests": 0,
            "windowSeconds": REQUEST_METRICS_WINDOW_SECONDS,
        },
    }


request_metrics_lock = Lock()
request_metrics_samples = deque()
request_metrics_summary: Dict[str, Any] = _default_request_metrics()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _isoformat(ts: datetime) -> str:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def _iter_numeric_metrics(payload: Dict[str, Any], prefix: str = ""):
    for key, value in payload.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            yield from _iter_numeric_metrics(value, path)
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            yield path, float(value)


def _calculate_percentile(sorted_values, percentile: float) -> float:
    if not sorted_values:
        return 0.0

    if len(sorted_values) == 1:
        return float(sorted_values[0])

    k = (len(sorted_values) - 1) * (percentile / 100)
    lower_index = math.floor(k)
    upper_index = math.ceil(k)

    if lower_index == upper_index:
        return float(sorted_values[int(k)])

    lower_value = sorted_values[lower_index]
    upper_value = sorted_values[upper_index]
    return float(lower_value * (upper_index - k) + upper_value * (k - lower_index))


def _prune_request_samples_locked(now: Optional[datetime] = None) -> None:
    cutoff = (now or _utcnow()) - timedelta(seconds=REQUEST_METRICS_WINDOW_SECONDS)
    while request_metrics_samples and request_metrics_samples[0]["timestamp"] < cutoff:
        request_metrics_samples.popleft()
    metrics_store.prune_request_metrics(cutoff)


def _recalculate_request_metrics_locked(now: Optional[datetime] = None) -> None:
    global request_metrics_summary

    _prune_request_samples_locked(now)

    samples = list(request_metrics_samples)
    sample_count = len(samples)
    durations = sorted(sample["duration_ms"] for sample in samples)
    error_count = sum(1 for sample in samples if sample["is_error"])

    summary = _default_request_metrics()
    summary["latency"]["sampleSize"] = sample_count
    summary["errorRate"]["requests"] = sample_count
    summary["errorRate"]["errors"] = error_count

    if sample_count:
        average_ms = sum(durations) / sample_count
        p95_ms = _calculate_percentile(durations, 95)
        summary["latency"]["averageMs"] = round(average_ms, 2)
        summary["latency"]["p95Ms"] = round(p95_ms, 2)
        summary["errorRate"]["ratio"] = round(error_count / sample_count, 4)

    request_metrics_summary = summary


def _reload_metrics_from_persistence() -> None:
    now = _utcnow()

    stats_cutoff = now - timedelta(seconds=SYSTEM_STATS_RETENTION_SECONDS)
    metrics_store.prune_system_stats(stats_cutoff)
    stats_records = metrics_store.fetch_system_stats_since(stats_cutoff)
    with system_stats_history_lock:
        system_stats_history.clear()
        for record in stats_records:
            system_stats_history.append({
                "timestamp": record.timestamp,
                "stats": record.stats,
            })

    request_cutoff = now - timedelta(seconds=REQUEST_METRICS_WINDOW_SECONDS)
    metrics_store.prune_request_metrics(request_cutoff)
    request_records = metrics_store.fetch_request_metrics_since(request_cutoff)
    with request_metrics_lock:
        request_metrics_samples.clear()
        for record in request_records:
            request_metrics_samples.append(
                {
                    "timestamp": record.timestamp,
                    "duration_ms": record.duration_ms,
                    "is_error": record.is_error,
                }
            )
        _recalculate_request_metrics_locked(now)


_reload_metrics_from_persistence()


def _record_request_metric(duration_ms: float, is_error: bool, *, timestamp: Optional[datetime] = None) -> None:
    sample = {
        "timestamp": timestamp or _utcnow(),
        "duration_ms": duration_ms,
        "is_error": is_error,
    }

    metrics_store.append_request_metric(
        RequestMetricRecord(
            timestamp=sample["timestamp"],
            duration_ms=duration_ms,
            is_error=is_error,
        )
    )

    with request_metrics_lock:
        request_metrics_samples.append(sample)
        _recalculate_request_metrics_locked(sample["timestamp"])


def get_request_metrics() -> Dict[str, Any]:
    with request_metrics_lock:
        _recalculate_request_metrics_locked()
        return copy.deepcopy(request_metrics_summary)


def add_stats_to_history(stats: Dict[str, Any], *, timestamp: Optional[datetime] = None) -> None:
    ts = timestamp or _utcnow()
    cutoff = ts - timedelta(seconds=SYSTEM_STATS_RETENTION_SECONDS)
    entry_stats = copy.deepcopy(stats)
    entry = {"timestamp": ts, "stats": entry_stats}

    metrics_store.append_system_stat(ts, entry_stats)
    metrics_store.prune_system_stats(cutoff)

    with system_stats_history_lock:
        system_stats_history.append(entry)
        while system_stats_history and system_stats_history[0]["timestamp"] < cutoff:
            system_stats_history.popleft()


def build_history_payload(window_key: str) -> Dict[str, Any]:
    if window_key not in SYSTEM_STATS_HISTORY_WINDOWS:
        raise ValueError(f"Unsupported window '{window_key}'. Valid options: {', '.join(SYSTEM_STATS_HISTORY_WINDOWS)}")

    window_delta = SYSTEM_STATS_HISTORY_WINDOWS[window_key]
    now = _utcnow()
    cutoff = now - window_delta

    relevant_entries = metrics_store.fetch_system_stats_since(cutoff)

    metrics: Dict[str, list] = {}
    oldest_timestamp: Optional[datetime] = None
    newest_timestamp: Optional[datetime] = None

    for entry in relevant_entries:
        ts = entry.timestamp
        stats = entry.stats

        if oldest_timestamp is None or ts < oldest_timestamp:
            oldest_timestamp = ts
        if newest_timestamp is None or ts > newest_timestamp:
            newest_timestamp = ts

        for metric_key, metric_value in _iter_numeric_metrics(stats):
            metrics.setdefault(metric_key, []).append({
                "timestamp": _isoformat(ts),
                "value": metric_value,
            })

    for samples in metrics.values():
        samples.sort(key=lambda sample: sample["timestamp"])

    sample_count = sum(len(samples) for samples in metrics.values())

    return {
        "window": window_key,
        "available_windows": list(SYSTEM_STATS_HISTORY_WINDOWS.keys()),
        "metrics": metrics,
        "sample_count": sample_count,
        "oldest_timestamp": _isoformat(oldest_timestamp) if oldest_timestamp else None,
        "newest_timestamp": _isoformat(newest_timestamp) if newest_timestamp else None,
        "retention_seconds": SYSTEM_STATS_RETENTION_SECONDS,
    }

async def collect_system_stats(
    cpu_interval: Optional[float] = None,
    *,
    record: bool = True,
) -> Dict[str, Any]:
    """Collect raw system statistics for CPU, memory, and platform details."""

    if cpu_interval is None:
        cpu_percent = psutil.cpu_percent(interval=None)
    else:
        cpu_percent = await asyncio.to_thread(psutil.cpu_percent, interval=cpu_interval)
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()

    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()

    boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
    uptime = (_utcnow() - boot_time).total_seconds()

    stats = {

        "cpu": {
            "usage": round(cpu_percent, 1),
            "cores": cpu_count,
            "model": platform.processor(),
            "frequency": f"{cpu_freq.current/1000:.2f} GHz" if cpu_freq else "N/A",
        },
        "memory": {
            "used": round(memory.used / (1024 ** 3), 1),
            "total": round(memory.total / (1024 ** 3), 1),
            "percent": memory.percent,
            "available": round(memory.available / (1024 ** 3), 1),
            "swap_used": round(swap.used / (1024 ** 3), 1),
            "swap_total": round(swap.total / (1024 ** 3), 1),
        },
        "os": f"{platform.system()} {platform.release()} {platform.version()}",
        "python_version": platform.python_version(),
        "uptime": int(uptime),
        "boot_time": boot_time.isoformat(),
    }

    stats.update(get_request_metrics())

    if record:
        add_stats_to_history(stats)

    return stats


def maybe_attach_history(stats: Dict[str, Any]) -> Dict[str, Any]:
    if not SYSTEM_STATS_INCLUDE_HISTORY_IN_SOCKET:
        return stats

    try:
        stats["history"] = build_history_payload(SYSTEM_STATS_SOCKET_HISTORY_WINDOW)
    except ValueError as exc:
        logger.warning("Unable to attach system stats history: %s", exc)
    return stats

# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check endpoint for container monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# System stats endpoint
@router.get("/system/stats", response_model=dict)
async def get_system_stats():
    """Get system statistics including CPU and memory usage."""
    try:
        stats = await collect_system_stats()
        payload = maybe_attach_history({**stats})
        return {**payload, "status": "success"}
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.scope.get("type") != "http" or not request.url.path.startswith("/api"):
            return await call_next(request)

        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            _record_request_metric(duration_ms, True)
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        _record_request_metric(duration_ms, response.status_code >= 400)
        return response

# CORS configuration - must match Socket.IO CORS settings
# Configure CORS for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestMetricsMiddleware)

# Configure Socket.IO with WebSocket settings (CORS handled by FastAPI)
SOCKET_PING_TIMEOUT = int(os.getenv('SOCKET_PING_TIMEOUT', 60))
SOCKET_PING_INTERVAL = int(os.getenv('SOCKET_PING_INTERVAL', 25))
SOCKET_MAX_HTTP_BUFFER_SIZE = int(os.getenv('SOCKET_MAX_HTTP_BUFFER_SIZE', 1e8))

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=[],  # CORS handled by FastAPI CORSMiddleware
    logger=True,
    engineio_logger=True,
    async_handlers=True,
    ping_timeout=SOCKET_PING_TIMEOUT,
    ping_interval=SOCKET_PING_INTERVAL,
    max_http_buffer_size=SOCKET_MAX_HTTP_BUFFER_SIZE
)

async def broadcast_system_stats():
    await asyncio.sleep(1)
    while True:
        try:
            stats = await collect_system_stats()
            stats_payload = {**maybe_attach_history({**stats}), "status": "success"}
        except Exception as exc:
            logger.error(f"Error collecting system stats for broadcast: {exc}")
            stats_payload = {"status": "error", "message": str(exc)}

        await sio.emit("system_stats", stats_payload)
        await asyncio.sleep(SYSTEM_STATS_INTERVAL)


@router.get("/system/stats/history", response_model=dict)
async def get_system_stats_history(window: str = Query(SYSTEM_STATS_DEFAULT_HISTORY_WINDOW)):
    try:
        history_payload = build_history_payload(window)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"status": "success", **history_payload}


@router.get("/activity", response_model=dict)
async def get_activity_history() -> Dict[str, Any]:
    events = activity_store.get_events()
    return {"status": "success", "events": events}


# Include the router after all route definitions
app.include_router(router)

# Create ASGI app with Socket.IO
app.mount("/socket.io", socketio.ASGIApp(sio, socketio_path="socket.io"))

_frontend_build_mounted = False


def _resolve_frontend_build_directory() -> Optional[Path]:
    raw_setting = str(FRONTEND_BUILD_DIR).strip()
    if not raw_setting:
        return None

    candidate = FRONTEND_BUILD_DIR
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()
    else:
        candidate = candidate.resolve()

    return candidate


def _maybe_mount_frontend_build() -> None:
    global _frontend_build_mounted

    if _frontend_build_mounted:
        return

    build_dir = _resolve_frontend_build_directory()
    if build_dir is None:
        logger.info("FRONTEND_BUILD_DIR is empty; skipping static frontend mount.")
        return

    if build_dir.is_dir():
        logger.info("Mounting frontend build directory at %s", build_dir)
        app.mount("/", StaticFiles(directory=str(build_dir), html=True), name="frontend")
        _frontend_build_mounted = True
    else:
        logger.info(
            "Frontend build directory %s not found. Static assets will not be served by FastAPI.",
            build_dir,
        )


# Use CREWS_PATH environment variable
crews_path = ensure_crews_directory(Path(CREWS_PATH))
crew_manager = CrewManager(str(crews_path), activity_store=activity_store)


def _sanitize_crew_id_or_error(raw_id: str) -> str:
    try:
        return normalize_crew_identifier(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


async def _apply_crew_update(crew_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)

    try:
        result = crew_manager.update_crew(sanitized_crew_id, payload)
    except ValueError as exc:
        logger.warning("Validation error updating crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error updating crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to update crew: {str(exc)}")

    await sio.emit("crews_updated", crew_manager.get_crews())
    return {**result, "id": sanitized_crew_id}


async def _apply_crew_deletion(crew_id: str) -> Dict[str, Any]:
    sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)

    try:
        result = crew_manager.delete_crew(sanitized_crew_id)
    except ValueError as exc:
        logger.warning("Validation error deleting crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error deleting crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to delete crew: {str(exc)}")

    await sio.emit("crews_updated", crew_manager.get_crews())
    return {**result, "id": sanitized_crew_id}


@app.on_event("startup")
async def capture_main_event_loop():
    """Store the main asyncio event loop for cross-thread callbacks."""
    loop = asyncio.get_running_loop()
    activity_store.load_persisted_events()
    sio.main_event_loop = loop
    crew_manager.event_loop = loop
    crew_manager._schedule_cleanup()
    global _activity_prune_task
    if ACTIVITY_HISTORY_PRUNE_INTERVAL > 0:
        _activity_prune_task = sio.start_background_task(
            activity_store.periodic_prune,
            ACTIVITY_HISTORY_PRUNE_INTERVAL,
        )
    _maybe_mount_frontend_build()
    global _crews_observer
    if _crews_observer is None:
        _crews_observer = _start_crews_observer(crews_path)
    logger.info("Captured main event loop for crew updates")


class CrewFolderHandler(FileSystemEventHandler):
    def on_any_event(self, event):
        """Trigger a crews_updated broadcast when files within crews/ change."""
        logger.info(
            "Detected filesystem event for crews directory: %s (is_directory=%s)",
            getattr(event, "src_path", "<unknown>"),
            getattr(event, "is_directory", None),
        )

        loop = getattr(crew_manager, "event_loop", None) or getattr(sio, "main_event_loop", None)

        if loop is None or loop.is_closed():
            logger.warning("Skipping crews_updated emit because the main event loop is not available or closed")
            return

        try:
            future = asyncio.run_coroutine_threadsafe(
                sio.emit("crews_updated", crew_manager.get_crews()),
                loop,
            )
        except RuntimeError as exc:
            logger.warning(
                "Skipping crews_updated emit because the event loop is closed: %s",
                exc,
            )
            return
        except Exception as exc:
            logger.exception("Failed to schedule crews_updated emit on main event loop: %s", exc)
            return

        def _log_future_result(fut: asyncio.Future) -> None:
            try:
                fut.result()
            except Exception as error:
                logger.error("Error emitting crews_updated: %s", error)
            else:
                logger.info("crews_updated emit completed successfully")

        future.add_done_callback(_log_future_result)

# Set up file watcher
_crews_observer: Optional["Observer"] = None


def _start_crews_observer(path: Path) -> Optional["Observer"]:
    if Observer is None:
        return None

    try:
        observer = Observer()
    except Exception as exc:  # pragma: no cover - defensive guard
        logger.warning(
            "Failed to initialise crews directory observer – disabling change notifications: %s",
            exc,
        )
        return None

    try:
        observer.schedule(CrewFolderHandler(), str(path), recursive=True)
        observer.start()
    except Exception as exc:
        logger.warning(
            "Failed to start crews directory observer – disabling change notifications: %s",
            exc,
        )
        try:
            observer.stop()
        except Exception:  # pragma: no cover - best-effort cleanup
            pass
        return None

    logger.info("Started crews directory observer for %s", path)
    return observer


def _stop_crews_observer() -> None:
    global _crews_observer

    if _crews_observer is None:
        return

    try:
        _crews_observer.stop()
        _crews_observer.join(timeout=5)
    except Exception as exc:  # pragma: no cover - defensive guard
        logger.debug("Error stopping crews directory observer: %s", exc)
    finally:
        _crews_observer = None


@app.on_event("shutdown")
async def _shutdown_event() -> None:
    _stop_crews_observer()

    global _activity_prune_task
    task = _activity_prune_task
    if task and hasattr(task, "cancel"):
        try:
            task.cancel()
        except Exception:  # pragma: no cover - best-effort cleanup
            pass


# Start background broadcaster for system stats once per process
if not getattr(sio, "system_stats_task", None):
    sio.system_stats_task = sio.start_background_task(broadcast_system_stats)


@app.get("/api/agents")
async def get_agent_library():
    try:
        return crew_manager.get_agent_library()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to load agent library: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load agent library")


@app.post("/api/agents")
async def create_agent_library_entry(agent: Dict[str, Any]):
    try:
        return crew_manager.add_agent_library_entry(agent)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to save agent library entry: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save agent library entry")


@app.put("/api/agents/{index}")
async def update_agent_library_entry(index: int, agent: Dict[str, Any]):
    try:
        return crew_manager.update_agent_library_entry(index, agent)
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 400
        raise HTTPException(status_code=status_code, detail=message)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to update agent library entry %s: %s", index, exc)
        raise HTTPException(status_code=500, detail="Failed to update agent library entry")


@app.delete("/api/agents/{index}")
async def delete_agent_library_entry(index: int):
    try:
        return crew_manager.delete_agent_library_entry(index)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to delete agent library entry %s: %s", index, exc)
        raise HTTPException(status_code=500, detail="Failed to delete agent library entry")


@app.get("/api/crew-templates")
async def get_crew_template_catalog():
    try:
        return crew_manager.get_template_catalog()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to load crew template catalog: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load crew templates")


@app.get("/api/crew-templates/{template_id}")
async def get_crew_template(template_id: str):
    try:
        return crew_manager.render_template(template_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to render crew template %s: %s", template_id, exc)
        raise HTTPException(status_code=500, detail="Failed to load crew template")


@app.get("/api/crews")
async def get_crews():
    try:
        crews = crew_manager.get_crews()
        logger.info(f"Returning {len(crews)} crews")
        return crews
    except Exception as e:
        logger.error(f"Error getting crews: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crews")
async def create_crew_entry(payload: Dict[str, Any]):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid request payload")

    crew_id = payload.get("id")
    if not crew_id or not isinstance(crew_id, str):
        raise HTTPException(status_code=400, detail="Crew 'id' must be provided")

    sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)

    crew_definition = dict(payload)
    crew_definition.pop("id", None)

    try:
        result = crew_manager.create_crew(sanitized_crew_id, crew_definition)
    except ValueError as exc:
        logger.warning("Validation error creating crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error creating crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to create crew: {str(exc)}")

    await sio.emit("crews_updated", crew_manager.get_crews())
    return {**result, "id": sanitized_crew_id}


@app.post("/api/crews/{crew_id}/start")
async def start_crew(crew_id: str, data: dict = Body(...)):
    try:
        # Get inputs from request body
        inputs = data.get("inputs", {})

        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        logger.info(f"Starting crew {sanitized_crew_id} with inputs: {inputs}")

        # Start the crew with the provided inputs
        process_id = await crew_manager.start_crew(sanitized_crew_id, inputs, sio)
        return {"process_id": process_id, "success": True}
    except Exception as e:
        logger.error(f"Error starting crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/crews/{crew_id}/stop")
async def stop_crew(crew_id: str):
    try:
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        logger.info(f"Stopping crew {sanitized_crew_id}")
        crew_manager.stop_crew(sanitized_crew_id)
        return {"status": "stopped", "success": True}
    except Exception as e:
        logger.error(f"Error stopping crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/crews/{crew_id}/env-files")
async def list_env_files(crew_id: str):
    try:
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        files = crew_manager.list_env_files(sanitized_crew_id)
        return {"files": files, "success": True}
    except Exception as e:
        logger.error(f"Error listing environment files for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/crews/{crew_id}/env/{env_name:path}")
async def get_env_file(crew_id: str, env_name: str):
    try:
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        content = crew_manager.get_env_content(sanitized_crew_id, env_name)
        return {"content": content, "success": True}
    except Exception as e:
        logger.error(f"Error getting environment file {env_name} for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/crews/{crew_id}/env/{env_name:path}")
async def save_env_file(crew_id: str, env_name: str, data: dict):
    try:
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        crew_manager.save_env_content(sanitized_crew_id, env_name, data.get("content", ""))
        return {"status": "saved", "success": True}
    except ValueError as e:
        logger.warning(f"Validation error saving environment file {env_name} for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error saving environment file {env_name} for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/crews/{crew_id}/{file_type}")
async def get_yaml_file(crew_id: str, file_type: str):
    try:
        # Remove .yaml or .yml from file_type if present
        if file_type.endswith('.yaml') or file_type.endswith('.yml'):
            file_type = file_type.rsplit('.', 1)[0]
            
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        content = crew_manager.get_yaml_content(sanitized_crew_id, file_type)
        return {"content": content, "success": True}
    except Exception as e:
        logger.error(f"Error getting YAML file {file_type} for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/crews/{crew_id}/{file_type}")
async def save_yaml_file(crew_id: str, file_type: str, data: dict):
    try:
        # Remove .yaml or .yml from file_type if present
        if file_type.endswith('.yaml') or file_type.endswith('.yml'):
            file_type = file_type.rsplit('.', 1)[0]
            
        sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)
        crew_manager.save_yaml_content(sanitized_crew_id, file_type, data["content"])
        return {"status": "saved", "success": True}
    except Exception as e:
        logger.error(f"Error saving YAML file {file_type} for crew {crew_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/crews/{crew_id}")
async def create_crew(
    crew_id: str,
    config: Dict[str, Any] = Body(...)
) -> Dict[str, str]:
    """
    Legacy endpoint for creating a crew with a provided identifier.

    This endpoint accepts the same payload structure as ``POST /api/crews``
    but keeps compatibility with clients that supply the crew identifier as
    part of the URL path.
    """

    sanitized_crew_id = _sanitize_crew_id_or_error(crew_id)

    try:
        logger.info(
            "Creating crew '%s' with %d agents and %d tasks via legacy endpoint",
            sanitized_crew_id,
            len((config or {}).get("agents", {})),
            len((config or {}).get("tasks", {})),
        )
        result = crew_manager.create_crew(sanitized_crew_id, dict(config))
    except ValueError as exc:
        logger.warning("Validation error creating crew '%s': %s", sanitized_crew_id, exc)
        message = str(exc)
        status = 409 if "already exists" in message else 400
        raise HTTPException(status_code=status, detail=message)
    except Exception as exc:
        logger.error("Unexpected error creating crew '%s': %s", sanitized_crew_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to create crew: {str(exc)}")

    await sio.emit("crews_updated", crew_manager.get_crews())
    return result


@app.put("/api/crews/{crew_id}")
async def update_crew_entry(
    crew_id: str,
    payload: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid request payload")

    return await _apply_crew_update(crew_id, payload)


@app.patch("/api/crews/{crew_id}")
async def patch_crew_entry(
    crew_id: str,
    payload: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid request payload")

    return await _apply_crew_update(crew_id, payload)


@app.delete("/api/crews/{crew_id}")
async def delete_crew_entry(crew_id: str) -> Dict[str, Any]:
    return await _apply_crew_deletion(crew_id)


@app.post("/api/crews/import")
async def import_crew(
    request: Request
) -> Dict[str, Any]:
    """
    Import a crew from a YAML configuration file.
    
    The configuration should follow this structure:
    {
        "name": "Crew Name",
        "description": "Crew Description",
        "agents": [
            {
                "name": "Agent Name",
                "role": "Agent Role",
                "goal": "Agent Goal",
                "backstory": "Agent Backstory"
            }
        ],
        "tasks": [
            {
                "name": "Task Name",
                "description": "Task Description",
                "expected_output": "Expected Output"
            }
        ]
    }
    
    Args:
        request (Request): The request containing the crew configuration
        
    Returns:
        Dict[str, Any]: Success message with status and crew ID
        
    Raises:
        HTTPException: 400 if validation fails or crew creation errors occur
    """
    try:
        # Get the crew configuration from the request body
        config = await request.json()
        
        # Validate the configuration structure
        # Name is optional, if not provided, generate a default name
        if 'name' not in config or not config['name']:
            config['name'] = 'Imported Crew'
        
        required_fields = ['agents', 'tasks']
        for field in required_fields:
            if field not in config:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: '{field}'"
                )
        
        # Validate agents structure
        if not isinstance(config['agents'], list):
            raise HTTPException(
                status_code=400,
                detail="Agents must be a list"
            )
        
        for agent in config['agents']:
            if not isinstance(agent, dict):
                raise HTTPException(
                    status_code=400,
                    detail="Each agent must be a dictionary"
                )
            
            required_agent_fields = ['name', 'role', 'goal', 'backstory']
            for field in required_agent_fields:
                if field not in agent or not agent[field]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Each agent must have a '{field}' field"
                    )
        
        # Validate tasks structure
        if not isinstance(config['tasks'], list):
            raise HTTPException(
                status_code=400,
                detail="Tasks must be a list"
            )
        
        for task in config['tasks']:
            if not isinstance(task, dict):
                raise HTTPException(
                    status_code=400,
                    detail="Each task must be a dictionary"
                )
            
            required_task_fields = ['name', 'description', 'expected_output']
            for field in required_task_fields:
                if field not in task or not task[field]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Each task must have a '{field}' field"
                    )
        
        # Generate a normalized crew ID from the crew name
        import re

        name_slug = re.sub(r"[^a-zA-Z0-9]+", "_", str(config['name']).lower()).strip("_")
        if not name_slug:
            name_slug = "imported_crew"

        try:
            crew_id = normalize_crew_identifier(name_slug)
        except ValueError:
            crew_id = normalize_crew_identifier("imported_crew")

        # Ensure the crew ID is unique
        original_crew_id = crew_id
        counter = 1
        while (crews_path / crew_id).exists():
            crew_id = normalize_crew_identifier(f"{original_crew_id}_{counter}")
            counter += 1
        
        # Transform the configuration to match the expected structure for create_crew
        transformed_config = {
            "agents": {},
            "tasks": {}
        }
        
        # Transform agents
        for agent in config['agents']:
            agent_name = agent['name']
            transformed_config['agents'][agent_name] = {
                "name": agent_name,
                "role": agent['role'],
                "goal": agent['goal'],
                "backstory": agent['backstory']
            }
        
        # Transform tasks
        for task in config['tasks']:
            task_name = task['name']
            transformed_config['tasks'][task_name] = {
                "description": task['description'],
                "expected_output": task['expected_output']
            }
        
        # Create the crew using the existing create_crew method
        logger.info(f"Importing crew '{config['name']}' with ID '{crew_id}'")
        result = crew_manager.create_crew(crew_id, transformed_config)
        
        # Emit update to connected clients
        await sio.emit("crews_updated", crew_manager.get_crews())
        
        return {
            "success": True,
            "message": f"Crew '{config['name']}' imported successfully",
            "crew_id": crew_id
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error importing crew: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import crew: {str(e)}")


@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    try:
        # Send current state to the new client
        await sio.emit("crews_updated", crew_manager.get_crews(), room=sid)
        logger.info(f"Sent initial crews data to {sid}")
        history = activity_store.get_events()
        if history:
            await sio.emit("activity_history", history, room=sid)
    except Exception as e:
        logger.error(f"Error sending initial data to {sid}: {str(e)}")

@sio.event
def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def crew_updated(sid, data):
    try:
        # This will be called when a crew is updated
        logger.debug(f"Crew updated: {data.get('id', 'unknown')}")
        await sio.emit("crew_updated", data)
    except Exception as e:
        logger.error(f"Error handling crew_updated: {str(e)}")

@sio.event
async def crew_started(sid, data):
    try:
        logger.info(f"Crew started: {data.get('crew_id', 'unknown')}")
        _record_activity_event("crew_started", data)
        await sio.emit("crew_started", data)
    except Exception as e:
        logger.error(f"Error handling crew_started: {str(e)}")

@sio.event
async def crew_stopped(sid, data):
    try:
        logger.info(f"Crew stopped: {data.get('crew_id', 'unknown')} (exit code: {data.get('exit_code', 'unknown')})")
        _record_activity_event("crew_stopped", data)
        await sio.emit("crew_stopped", data)
    except Exception as e:
        logger.error(f"Error handling crew_stopped: {str(e)}")

@sio.event
async def crew_error(sid, data):
    try:
        logger.error(
            "Crew error for %s: %s",
            data.get("crew_id", "unknown"),
            data.get("error", data),
        )
        _record_activity_event("crew_error", data)
        await sio.emit("crew_error", data)
    except Exception as e:
        logger.error(f"Error handling crew_error: {str(e)}")

@sio.event
async def startCrew(sid, data):
    # Extract crew_id and inputs from the data
    crew_id = data.get("crew_id")
    inputs = data.get("inputs", {})
    
    try:
        if not crew_id:
            logger.error("Missing crew_id in startCrew event")
            await sio.emit("error", {"message": "Missing crew_id"})
            return
            
        # Log the start request
        logger.info(f"Starting crew {crew_id} with inputs: {inputs}")
        
        # Start the crew with the provided inputs
        process_id = await crew_manager.start_crew(crew_id, inputs, sio)

        # Acknowledge to the requesting client that the start request was accepted.
        # The CrewManager.start_crew coroutine is responsible for broadcasting the
        # global ``crew_started`` lifecycle event so we only reply directly to the
        # origin socket here to avoid duplicate events for listeners.
        ack_payload = {
            "crew_id": crew_id,
            "process_id": process_id,
            "status": "starting",
        }
        _record_activity_event("crew_start_ack", ack_payload)
        await sio.emit(
            "crew_start_ack",
            ack_payload,
            room=sid,
        )
    except Exception as e:
        logger.error(f"Error starting crew: {str(e)}", exc_info=True)
        # Make sure crew_id is defined before using it in the error response
        error_crew_id = crew_id if crew_id else "unknown"
        error_payload = {
            "crew_id": error_crew_id,
            "error": str(e),
            "status": "error"
        }
        _record_activity_event("crew_error", error_payload)
        await sio.emit("crew_error", error_payload)

@sio.event
async def stopCrew(sid, data):
    try:
        # Extract crew_id from the data
        crew_id = data.get("crew_id")
        
        if not crew_id:
            logger.error("Missing crew_id in stopCrew event")
            await sio.emit("error", {"message": "Missing crew_id"})
            return
            
        # Log the stop request
        logger.info(f"Stopping crew {crew_id}")
        
        # Stop the crew
        crew_manager.stop_crew(crew_id)
        
        # Acknowledge the stop request without emitting the final lifecycle event
        stop_payload = {
            "crew_id": crew_id,
            "status": "stopping"
        }
        _record_activity_event("stop_requested", stop_payload)
        await sio.emit("stop_requested", stop_payload)
    except Exception as e:
        logger.error(f"Error stopping crew {crew_id}: {str(e)}")
        await sio.emit("error", {"message": str(e)})

@sio.event
async def crew_log(sid, data):
    try:
        # Broadcast log messages to all clients
        logger.debug(f"Log from {data.get('agent', 'unknown')} for crew {data.get('crew_id', 'unknown')}: {data.get('message', 'No message')}")
        _record_activity_event("crew_log", data)
        await sio.emit("crew_log", data)
    except Exception as e:
        logger.error(f"Error handling crew_log: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True, log_level=LOG_LEVEL.lower())
