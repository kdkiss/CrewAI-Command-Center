import asyncio
import sys
from collections import deque
from pathlib import Path
from typing import Any, Deque, Iterable, List, Tuple
from unittest.mock import AsyncMock

import datetime as dt
import pytest

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import crew_manager  # noqa: E402


class DummyAsyncStream:
    """Async stream returning predefined lines."""

    def __init__(self, lines: Iterable[Any], done_event: asyncio.Event | None = None):
        self._lines: Deque[Any] = deque(lines)
        self._transport = object()
        self._done_event = done_event or asyncio.Event()
        if not self._lines:
            self._done_event.set()

    async def readline(self):
        await asyncio.sleep(0)
        if self._lines:
            value = self._lines.popleft()
            if not self._lines:
                self._done_event.set()
            return value
        self._done_event.set()
        return b""


class DummyProcess:
    """Minimal async process compatible with _stream_logs."""

    def __init__(self, stdout_lines: Iterable[Any], stderr_lines: Iterable[Any], returncode: int = 0):
        self._stdout_done = asyncio.Event()
        self._stderr_done = asyncio.Event()
        self.stdout = DummyAsyncStream(stdout_lines, self._stdout_done)
        self.stderr = DummyAsyncStream(stderr_lines, self._stderr_done)
        self.pid = 1234
        self.returncode = returncode

    async def wait(self):
        await asyncio.gather(self._stdout_done.wait(), self._stderr_done.wait())
        await asyncio.sleep(0)
        return self.returncode


class FaultyLine:
    """Line object that raises when converted to string."""

    def __init__(self, message: str):
        self._message = message

    def __str__(self):  # pragma: no cover - defensive branch
        raise ValueError(self._message)


class FrozenDatetime(dt.datetime):
    """Datetime helper allowing manual progression of utcnow()."""

    current = dt.datetime(2024, 1, 1, 0, 0, 0)

    @classmethod
    def utcnow(cls):  # noqa: D401
        """Return the current frozen datetime."""
        return cls.current


@pytest.fixture
def reset_frozen_datetime():
    FrozenDatetime.current = dt.datetime(2024, 1, 1, 0, 0, 0)
    return FrozenDatetime


@pytest.mark.usefixtures("reset_frozen_datetime")
def test_log_deduplicator_duplicates_and_cleanup(monkeypatch):
    monkeypatch.setattr(crew_manager, "datetime", FrozenDatetime)
    deduplicator = crew_manager.LogDeduplicator(time_window=5)

    log_entry = {"message": "Agent Alpha working", "agent": "Alpha"}

    is_dup, count = deduplicator.is_duplicate(log_entry)
    assert not is_dup
    assert count == 1

    is_dup, count = deduplicator.is_duplicate(log_entry)
    assert is_dup
    assert count == 2

    FrozenDatetime.current += dt.timedelta(seconds=10)
    deduplicator.cleanup()
    assert not deduplicator.recent_logs

    is_dup, count = deduplicator.is_duplicate(log_entry)
    assert not is_dup
    assert count == 1


@pytest.mark.usefixtures("reset_frozen_datetime")
def test_operation_tracker_lifecycle(monkeypatch):
    monkeypatch.setattr(crew_manager, "datetime", FrozenDatetime)
    tracker = crew_manager.OperationTracker()

    op_id = tracker.start_operation("SEARCH", agent="Alpha")
    assert tracker.current_operation_id == op_id

    sequence = tracker.update_operation(op_id)
    assert sequence == 1

    tracker.end_operation(op_id, status="error")
    assert tracker.current_operation_id is None
    assert tracker.operations[op_id]["status"] == "error"

    FrozenDatetime.current += dt.timedelta(seconds=4000)
    tracker.cleanup_completed_operations(max_age_seconds=3600)
    assert op_id not in tracker.operations


@pytest.mark.parametrize(
    "message, expected",
    [
        ("Starting search for documents", "SEARCH"),
        ("Analyzing gathered intelligence", "ANALYSIS"),
        ("Deciding on best approach", "DECISION"),
        ("Result produced successfully", "RESULT"),
        ("Failure: unexpected exception occurred", "ERROR"),
        ("Executing follow-up action", "ACTION"),
        ("General information update", "INFO"),
    ],
)
def test_categorize_log(message: str, expected: str):
    assert crew_manager.categorize_log(message) == expected


@pytest.mark.parametrize(
    "message, default, expected",
    [
        ('Agent "Alpha": commencing task', "system", "Alpha"),
        ("From Beta: status report", "system", "Beta"),
        ("[Gamma] completed analysis", "system", "Gamma"),
        ("@delta posted an update", "system", "delta"),
        ("<epsilon> shared findings", "system", "epsilon"),
        ("No agent markers here", "fallback", "fallback"),
    ],
)
def test_extract_agent_name(message: str, default: str, expected: str):
    assert crew_manager.extract_agent_name(message, default) == expected


@pytest.mark.asyncio
async def test_stream_logs_emits_deduplicated_events(monkeypatch, tmp_path):
    monkeypatch.setattr(crew_manager.CrewManager, "_schedule_cleanup", lambda self: None)
    manager = crew_manager.CrewManager(str(tmp_path))

    process = DummyProcess(
        stdout_lines=[
            b'Agent "Alpha": Starting search for leads\n',
            b'Agent "Alpha": Starting search for leads\n',
            b'Agent "Alpha": Result found in archive\n',
        ],
        stderr_lines=[b"Error: critical failure detected\n"],
    )

    manager.running_crews["crew-1"] = {"process": process, "process_id": str(process.pid)}

    events: List[Tuple[str, Any]] = []

    class DummySio:
        async def emit(self, event: str, payload: Any):
            events.append((event, payload))

    sio = DummySio()
    manager._emit_crew_update = AsyncMock()

    await manager._stream_logs("crew-1", process, sio)

    crew_logs = [payload for event, payload in events if event == "crew_log"]
    stop_events = [payload for event, payload in events if event == "crew_stopped"]

    assert len(stop_events) == 1
    assert stop_events[0]["crew_id"] == "crew-1"
    assert stop_events[0]["status"] == "stopped"
    assert "crew-1" not in manager.running_crews
    manager._emit_crew_update.assert_awaited_once()

    messages = [log["message"] for log in crew_logs]
    assert messages.count('Agent "Alpha": Starting search for leads') == 1

    search_log = next(log for log in crew_logs if "Starting search" in log["message"])
    assert search_log["isDuplicate"] is False
    assert search_log["duplicateCount"] == 1
    assert search_log["operationId"] is not None
    assert search_log["sequence"] >= 1

    result_log = next(log for log in crew_logs if "Result found" in log["message"])
    assert result_log["category"] == "RESULT"
    assert result_log["operationId"] is None

    error_log = next(log for log in crew_logs if "critical failure" in log["message"])
    assert error_log["level"] == "error"
    assert error_log["category"] == "ERROR"


@pytest.mark.asyncio
async def test_stream_logs_handles_decode_errors(monkeypatch, tmp_path):
    monkeypatch.setattr(crew_manager.CrewManager, "_schedule_cleanup", lambda self: None)
    manager = crew_manager.CrewManager(str(tmp_path))

    process = DummyProcess(stdout_lines=[FaultyLine("unable to decode")], stderr_lines=[])
    manager.running_crews["crew-2"] = {"process": process, "process_id": str(process.pid)}

    events: List[Tuple[str, Any]] = []

    class DummySio:
        async def emit(self, event: str, payload: Any):
            events.append((event, payload))

    sio = DummySio()
    manager._emit_crew_update = AsyncMock()

    await manager._stream_logs("crew-2", process, sio)

    crew_logs = [payload for event, payload in events if event == "crew_log"]
    assert crew_logs
    assert crew_logs[0]["message"].startswith("[Decode Error: unable to decode]")

    stop_events = [payload for event, payload in events if event == "crew_stopped"]
    assert stop_events and stop_events[0]["crew_id"] == "crew-2"


@pytest.mark.asyncio
async def test_stream_logs_recovers_from_emit_failures(monkeypatch, tmp_path):
    monkeypatch.setattr(crew_manager.CrewManager, "_schedule_cleanup", lambda self: None)
    manager = crew_manager.CrewManager(str(tmp_path))

    process = DummyProcess(
        stdout_lines=[
            b'Agent "Alpha": Initiating search\n',
            b"Background analysis in progress\n",
        ],
        stderr_lines=[],
    )
    manager.running_crews["crew-3"] = {"process": process, "process_id": str(process.pid)}

    events: List[Tuple[str, Any]] = []

    class FaultySio:
        def __init__(self):
            self._first_failure = True

        async def emit(self, event: str, payload: Any):
            if event == "crew_log" and self._first_failure:
                self._first_failure = False
                raise RuntimeError("emit failed")
            events.append((event, payload))

    sio = FaultySio()
    manager._emit_crew_update = AsyncMock()

    await manager._stream_logs("crew-3", process, sio)

    crew_logs = [payload for event, payload in events if event == "crew_log"]
    assert crew_logs
    assert any("Background analysis" in log["message"] for log in crew_logs)

    stop_events = [payload for event, payload in events if event == "crew_stopped"]
    assert stop_events and stop_events[0]["crew_id"] == "crew-3"
