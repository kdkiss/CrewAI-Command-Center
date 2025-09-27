"""Socket.IO broadcasting utilities for crew runtime logs."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple


logger = logging.getLogger(__name__)


class LogDeduplicator:
    """Track and deduplicate log events within a configurable time window."""

    def __init__(self, time_window: int = 5) -> None:
        self.recent_logs: Dict[int, Tuple[datetime, int]] = {}
        self.time_window = time_window

    def is_duplicate(self, log_entry: Dict[str, Any]) -> Tuple[bool, int]:
        log_hash = hash((log_entry.get("message", ""), log_entry.get("agent", "")))
        current_time = datetime.utcnow()

        if log_hash in self.recent_logs:
            last_seen, count = self.recent_logs[log_hash]
            if (current_time - last_seen).total_seconds() < self.time_window:
                self.recent_logs[log_hash] = (current_time, count + 1)
                return True, count + 1

        self.recent_logs[log_hash] = (current_time, 1)
        return False, 1

    def cleanup(self) -> None:
        current_time = datetime.utcnow()
        expired = [
            key
            for key, (timestamp, _count) in self.recent_logs.items()
            if (current_time - timestamp).total_seconds() > self.time_window
        ]
        for key in expired:
            del self.recent_logs[key]


class OperationTracker:
    """Track multi-step operations inferred from log categories."""

    def __init__(self) -> None:
        self.operations: Dict[str, Dict[str, Any]] = {}
        self.current_operation_id: Optional[str] = None

    def start_operation(self, operation_type: str, agent: Optional[str] = None) -> str:
        operation_id = str(datetime.utcnow().timestamp()).replace(".", "")
        self.operations[operation_id] = {
            "type": operation_type,
            "agent": agent,
            "start_time": datetime.utcnow(),
            "status": "in_progress",
            "sequence": 0,
        }
        self.current_operation_id = operation_id
        return operation_id

    def update_operation(self, operation_id: str, status: Optional[str] = None) -> int:
        if operation_id not in self.operations:
            return 0

        if status:
            self.operations[operation_id]["status"] = status
        self.operations[operation_id]["sequence"] += 1
        return self.operations[operation_id]["sequence"]

    def end_operation(self, operation_id: str, status: str = "complete") -> None:
        if operation_id not in self.operations:
            return

        self.operations[operation_id]["status"] = status
        self.operations[operation_id]["end_time"] = datetime.utcnow()
        if self.current_operation_id == operation_id:
            self.current_operation_id = None

    def get_operation_info(self, operation_id: str) -> Dict[str, Any]:
        return dict(self.operations.get(operation_id, {}))

    def cleanup_completed_operations(self, max_age_seconds: int = 3600) -> None:
        current_time = datetime.utcnow()
        expired = [
            op_id
            for op_id, op_info in self.operations.items()
            if "end_time" in op_info
            and (current_time - op_info["end_time"]).total_seconds() > max_age_seconds
        ]
        for op_id in expired:
            del self.operations[op_id]


def categorize_log(message: str) -> str:
    message_lower = message.lower()
    if any(term in message_lower for term in ["search", "query", "looking for", "find"]):
        return "SEARCH"
    if any(term in message_lower for term in ["analyz", "process", "evaluat", "assess"]):
        return "ANALYSIS"
    if any(term in message_lower for term in ["decid", "select", "choose", "determin"]):
        return "DECISION"
    if any(term in message_lower for term in ["result", "found", "complet", "finish"]):
        return "RESULT"
    if any(term in message_lower for term in ["error", "fail", "exception", "issue"]):
        return "ERROR"
    if any(term in message_lower for term in ["execut", "perform", "run", "start"]):
        return "ACTION"
    return "INFO"


def extract_agent_name(message: str, default_agent: str = "system") -> str:
    patterns = [
        r'Agent\s+["\']?([^"\':\n]+)["\']?:',
        r'From\s+["\']?([^"\':\n]+)["\']?:',
        r'\[([^\[\]]+)\]',
        r'@([a-zA-Z0-9_-]+)',
        r'<([a-zA-Z0-9_-]+)>',
    ]

    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return match.group(1).strip()
    return default_agent


class CrewLogBroadcaster:
    """Stream process logs to Socket.IO with deduplication and activity tracking."""

    def __init__(
        self,
        *,
        log_deduplicator: Optional[LogDeduplicator] = None,
        operation_tracker: Optional[OperationTracker] = None,
        activity_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        self.log_deduplicator = log_deduplicator or LogDeduplicator()
        self.operation_tracker = operation_tracker or OperationTracker()
        self._activity_callback = activity_callback

    async def stream_process_logs(
        self,
        crew_id: str,
        process,
        sio,
        *,
        process_id: str,
        on_stop: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> None:
        logger.info(
            "Starting log streaming for crew %s (pid=%s)",
            crew_id,
            getattr(process, "pid", "unknown"),
        )

        async def _read_stream(stream, level: str) -> None:
            if not stream:
                logger.debug("No %s stream available for crew %s", level, crew_id)
                return

            loop = asyncio.get_event_loop()
            try:
                while True:
                    try:
                        if hasattr(stream, "readline") and callable(stream.readline):
                            if hasattr(stream, "_transport"):
                                line = await stream.readline()
                            else:
                                line = await loop.run_in_executor(None, stream.readline)
                        else:
                            line = await loop.run_in_executor(None, stream.readline)
                    except asyncio.CancelledError:
                        logger.debug("Stream reading cancelled for crew %s (%s)", crew_id, level)
                        break
                    except Exception as exc:
                        logger.error("Error reading %s stream for crew %s: %s", level, crew_id, exc)
                        break

                    if not line:
                        logger.debug("End of %s stream for crew %s", level, crew_id)
                        break

                    try:
                        text = (
                            line.decode(errors="replace").rstrip("\r\n")
                            if isinstance(line, bytes)
                            else str(line).rstrip("\r\n")
                        )
                    except Exception as exc:  # pragma: no cover - defensive decoding
                        logger.warning("Error decoding line from %s stream: %s", level, exc)
                        text = f"[Decode Error: {exc}]"

                    if not text.strip():
                        continue

                    agent = extract_agent_name(text)
                    category = categorize_log(text)

                    operation_id_for_log: Optional[str] = None

                    if category in {"SEARCH", "ANALYSIS", "DECISION"}:
                        if self.operation_tracker.current_operation_id is None:
                            operation_id = self.operation_tracker.start_operation(category, agent=agent)
                        else:
                            operation_id = self.operation_tracker.current_operation_id
                        sequence = self.operation_tracker.update_operation(operation_id)
                        operation_id_for_log = operation_id
                    elif category == "RESULT" and self.operation_tracker.current_operation_id:
                        operation_id = self.operation_tracker.current_operation_id
                        sequence = self.operation_tracker.update_operation(operation_id)
                        self.operation_tracker.end_operation(operation_id)
                    elif self.operation_tracker.current_operation_id:
                        operation_id = self.operation_tracker.current_operation_id
                        sequence = self.operation_tracker.update_operation(operation_id)
                        operation_id_for_log = operation_id
                    else:
                        operation_id = None
                        sequence = 0

                    log_entry = {
                        "crewId": crew_id,
                        "message": text,
                        "level": "error" if level == "error" else "info",
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "category": category,
                        "agent": agent,
                        "operationId": operation_id_for_log,
                        "sequence": sequence,
                    }

                    is_duplicate, duplicate_count = self.log_deduplicator.is_duplicate(log_entry)
                    log_entry["isDuplicate"] = is_duplicate
                    log_entry["duplicateCount"] = duplicate_count

                    if is_duplicate and duplicate_count > 1:
                        continue

                    try:
                        if self._activity_callback:
                            self._activity_callback("crew_log", log_entry)
                        await sio.emit("crew_log", log_entry)
                    except Exception as exc:  # pragma: no cover - network issues
                        logger.error("Error emitting log for crew %s: %s", crew_id, exc)

            except asyncio.CancelledError:
                logger.debug("Stream reader task cancelled for crew %s (%s)", crew_id, level)
                raise

        stdout_task = asyncio.create_task(_read_stream(process.stdout, "info"))
        stderr_task = asyncio.create_task(_read_stream(process.stderr, "error"))

        try:
            if hasattr(process, "process") and hasattr(process.process, "wait"):
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, process.process.wait)
                return_code = process.process.returncode
            else:
                await process.wait()
                return_code = getattr(process, "returncode", None)
        except asyncio.CancelledError:
            logger.info("Log streaming for crew %s was cancelled", crew_id)
            raise
        except Exception as exc:
            logger.error("Error streaming logs for %s: %s", crew_id, exc, exc_info=True)
            error_payload = {
                "crewId": crew_id,
                "message": f"Error in log streaming: {exc}",
                "level": "error",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            try:
                if self._activity_callback:
                    self._activity_callback("crew_log", error_payload)
                await sio.emit("crew_log", error_payload)
            except Exception:  # pragma: no cover - best effort
                pass
            return_code = getattr(process, "returncode", None)
        finally:
            stdout_task.cancel()
            stderr_task.cancel()
            try:
                await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            except Exception as exc:  # pragma: no cover - gather errors ignored
                logger.debug("Error gathering stream tasks for %s: %s", crew_id, exc)

            if on_stop:
                payload = {
                    "crew_id": crew_id,
                    "process_id": process_id,
                    "exit_code": return_code,
                }
                await on_stop(payload)

    def cleanup(self) -> None:
        self.log_deduplicator.cleanup()
        self.operation_tracker.cleanup_completed_operations()

