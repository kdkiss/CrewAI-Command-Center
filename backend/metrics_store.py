"""Persistence helpers for system statistics and request metrics."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Dict, List


@dataclass
class SystemStatRecord:
    timestamp: datetime
    stats: Dict[str, object]


@dataclass
class RequestMetricRecord:
    timestamp: datetime
    duration_ms: float
    is_error: bool


class MetricsStore:
    """Simple SQLite-backed persistence for system stats and request metrics."""

    def __init__(self, db_path: Path):
        self._db_path = Path(db_path)
        if not self._db_path.parent.exists():
            self._db_path.parent.mkdir(parents=True, exist_ok=True)

        self._lock = RLock()
        self._conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._initialize()

    def _initialize(self) -> None:
        with self._lock:
            cursor = self._conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS system_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS request_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    duration_ms REAL NOT NULL,
                    is_error INTEGER NOT NULL
                )
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_system_stats_timestamp ON system_stats(timestamp)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_request_metrics_timestamp ON request_metrics(timestamp)"
            )
            self._conn.commit()

    @staticmethod
    def _serialize_timestamp(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()

    @staticmethod
    def _deserialize_timestamp(raw: str) -> datetime:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def append_system_stat(self, timestamp: datetime, stats: Dict[str, object]) -> None:
        payload = json.dumps(stats)
        serialized_timestamp = self._serialize_timestamp(timestamp)
        with self._lock:
            self._conn.execute(
                "INSERT INTO system_stats (timestamp, payload) VALUES (?, ?)",
                (serialized_timestamp, payload),
            )
            self._conn.commit()

    def prune_system_stats(self, cutoff: datetime) -> None:
        serialized_cutoff = self._serialize_timestamp(cutoff)
        with self._lock:
            self._conn.execute(
                "DELETE FROM system_stats WHERE timestamp < ?",
                (serialized_cutoff,),
            )
            self._conn.commit()

    def fetch_system_stats_since(self, cutoff: datetime) -> List[SystemStatRecord]:
        serialized_cutoff = self._serialize_timestamp(cutoff)
        with self._lock:
            cursor = self._conn.execute(
                "SELECT timestamp, payload FROM system_stats WHERE timestamp >= ? ORDER BY timestamp ASC",
                (serialized_cutoff,),
            )
            rows = cursor.fetchall()

        results: List[SystemStatRecord] = []
        for row in rows:
            timestamp = self._deserialize_timestamp(row["timestamp"])
            stats = json.loads(row["payload"])
            results.append(SystemStatRecord(timestamp=timestamp, stats=stats))
        return results

    def clear_system_stats(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM system_stats")
            self._conn.commit()

    def append_request_metric(self, record: RequestMetricRecord) -> None:
        serialized_timestamp = self._serialize_timestamp(record.timestamp)
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO request_metrics (timestamp, duration_ms, is_error)
                VALUES (?, ?, ?)
                """,
                (serialized_timestamp, float(record.duration_ms), int(bool(record.is_error))),
            )
            self._conn.commit()

    def prune_request_metrics(self, cutoff: datetime) -> None:
        serialized_cutoff = self._serialize_timestamp(cutoff)
        with self._lock:
            self._conn.execute(
                "DELETE FROM request_metrics WHERE timestamp < ?",
                (serialized_cutoff,),
            )
            self._conn.commit()

    def fetch_request_metrics_since(self, cutoff: datetime) -> List[RequestMetricRecord]:
        serialized_cutoff = self._serialize_timestamp(cutoff)
        with self._lock:
            cursor = self._conn.execute(
                "SELECT timestamp, duration_ms, is_error FROM request_metrics WHERE timestamp >= ? ORDER BY timestamp ASC",
                (serialized_cutoff,),
            )
            rows = cursor.fetchall()

        results: List[RequestMetricRecord] = []
        for row in rows:
            timestamp = self._deserialize_timestamp(row["timestamp"])
            duration_ms = float(row["duration_ms"])
            is_error = bool(row["is_error"])
            results.append(
                RequestMetricRecord(
                    timestamp=timestamp,
                    duration_ms=duration_ms,
                    is_error=is_error,
                )
            )
        return results

    def clear_request_metrics(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM request_metrics")
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()


__all__ = [
    "MetricsStore",
    "RequestMetricRecord",
    "SystemStatRecord",
]
