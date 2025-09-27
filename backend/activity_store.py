from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Union


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ActivityStore:
    """Durable ring buffer that retains recent crew activity events."""

    _TRACKED_EVENTS = {
        "crew_log",
        "crew_started",
        "crew_start_ack",
        "crew_stopped",
        "crew_error",
        "stop_requested",
    }

    def __init__(
        self,
        max_events: int = 500,
        retention_seconds: Optional[int] = 3600,
        storage_path: Optional[Union[str, Path]] = None,
    ) -> None:
        self.max_events = max_events if max_events and max_events > 0 else None
        self.retention = (
            timedelta(seconds=retention_seconds)
            if retention_seconds and retention_seconds > 0
            else None
        )
        self._storage_path: Optional[Path] = (
            Path(storage_path).expanduser().resolve()
            if storage_path
            else None
        )
        if self._storage_path is not None:
            self._storage_path.parent.mkdir(parents=True, exist_ok=True)

        self._lock = Lock()
        self._events: List[Dict[str, Any]] = []
        self._next_id = 1
        self._logger = logging.getLogger(__name__)
        self.load_persisted_events()

    @property
    def tracked_events(self) -> Iterable[str]:
        return self._TRACKED_EVENTS

    def add_event(self, event_type: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if event_type not in self._TRACKED_EVENTS:
            return None

        snapshot = deepcopy(payload) if isinstance(payload, dict) else payload
        timestamp = _utcnow().isoformat().replace("+00:00", "Z")

        with self._lock:
            self._prune_locked()
            event_id = self._next_id
            self._next_id += 1

            entry = {
                "id": event_id,
                "type": event_type,
                "timestamp": timestamp,
                "data": snapshot,
            }

            self._events.append(entry)
            self._enforce_max_events_locked()
            self._persist_locked()

        return entry

    def get_events(self) -> List[Dict[str, Any]]:
        with self._lock:
            self._prune_locked()
            return [deepcopy(event) for event in self._events]

    def prune(self) -> None:
        with self._lock:
            if self._prune_locked():
                self._persist_locked()

    def load_persisted_events(self) -> None:
        with self._lock:
            self._load_persisted_events()

    def _prune_locked(self) -> None:
        if not self.retention:
            return False

        cutoff = _utcnow() - self.retention
        removed = False
        while self._events and self._parse_timestamp(self._events[0]["timestamp"]) < cutoff:
            self._events.pop(0)
            removed = True

        if removed:
            self._enforce_max_events_locked()

        return removed

    def _enforce_max_events_locked(self) -> None:
        if self.max_events is None:
            return

        if len(self._events) > self.max_events:
            del self._events[: len(self._events) - self.max_events]

    def _persist_locked(self) -> None:
        if self._storage_path is None:
            return

        payload = {
            "next_id": self._next_id,
            "events": self._events,
        }

        tmp_path = self._storage_path.with_suffix(self._storage_path.suffix + ".tmp")

        try:
            with tmp_path.open("w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)
            tmp_path.replace(self._storage_path)
        except Exception as exc:  # pragma: no cover - defensive logging
            self._logger.debug("Failed to persist activity history: %s", exc)
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass

    def _load_persisted_events(self) -> None:
        if self._storage_path is None or not self._storage_path.exists():
            return

        try:
            with self._storage_path.open("r", encoding="utf-8") as handle:
                raw = json.load(handle)
        except Exception as exc:  # pragma: no cover - defensive logging
            self._logger.debug("Failed to load persisted activity history: %s", exc)
            return

        events: List[Dict[str, Any]]
        next_id: Optional[int] = None

        if isinstance(raw, dict):
            events = [event for event in raw.get("events", []) if self._is_valid_event(event)]
            next_id = raw.get("next_id")
        elif isinstance(raw, list):  # Backwards compatibility with older payloads
            events = [event for event in raw if self._is_valid_event(event)]
        else:
            return

        self._events = events
        self._prune_locked()
        self._enforce_max_events_locked()

        if next_id is not None and isinstance(next_id, int) and next_id > 0:
            self._next_id = next_id
        else:
            self._next_id = (
                max((event.get("id", 0) for event in self._events), default=0) + 1
            )

    @staticmethod
    def _parse_timestamp(raw: str) -> datetime:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return _utcnow()

    @staticmethod
    def _is_valid_event(event: Any) -> bool:
        if not isinstance(event, dict):
            return False

        if "type" not in event or "timestamp" not in event:
            return False

        if "data" not in event:
            return False

        return True

    async def periodic_prune(self, interval_seconds: int = 60) -> None:
        import asyncio

        if interval_seconds <= 0:
            return

        while True:
            await asyncio.sleep(interval_seconds)
            self.prune()
