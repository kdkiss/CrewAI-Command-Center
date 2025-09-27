"""Tests for the CrewRuntime orchestration helpers."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Tuple

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crew_runtime import CrewRuntime  # noqa: E402  pylint: disable=wrong-import-position


class DummyStorage:
    def __init__(self, crew_dir, pkg_dir, config_dir) -> None:
        self._crew_dir = crew_dir
        self._pkg_dir = pkg_dir
        self._config_dir = config_dir

    def resolve_existing_config_dir(self, crew_id: str):
        return self._crew_dir, self._pkg_dir, self._config_dir


class DummyBroadcaster:
    def __init__(self) -> None:
        self.calls: List[Tuple[Tuple[Any, ...], Dict[str, Any]]] = []

    async def stream_process_logs(self, *args, **kwargs) -> None:
        self.calls.append((args, kwargs))

    def cleanup(self) -> None:  # pragma: no cover - not used in test
        return None


class DummySio:
    def __init__(self) -> None:
        self.emitted: List[Tuple[str, Dict[str, Any]]] = []

    async def emit(self, event: str, payload: Dict[str, Any]) -> None:
        self.emitted.append((event, payload))


@pytest.mark.asyncio
async def test_start_crew_streams_logs(monkeypatch, tmp_path):
    crew_id = "demo"
    crew_dir = tmp_path / crew_id
    pkg_dir = crew_dir / "src" / crew_id
    config_dir = pkg_dir / "config"
    config_dir.mkdir(parents=True)
    main_py = pkg_dir / "main.py"
    main_py.write_text("print('hello world')\n", encoding="utf-8")

    storage = DummyStorage(crew_dir, pkg_dir, config_dir)
    broadcaster = DummyBroadcaster()
    runtime = CrewRuntime(storage, broadcaster)

    created_tasks: List[Any] = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        return SimpleNamespace(done=lambda: False, cancel=lambda: None)

    monkeypatch.setattr("crew_runtime.asyncio.create_task", fake_create_task)
    monkeypatch.setattr("crew_runtime.platform.system", lambda: "Linux")
    monkeypatch.setattr("crew_runtime.shutil.which", lambda _: None)

    dummy_process = SimpleNamespace(pid=4321, stdout=None, stderr=None, returncode=None)

    async def fake_subprocess_exec(*_args, **_kwargs):
        return dummy_process

    monkeypatch.setattr(
        "crew_runtime.asyncio.create_subprocess_exec", fake_subprocess_exec
    )

    sio = DummySio()

    handle_exit_calls: List[Tuple[Dict[str, Any], Any, Dict[str, Any]]] = []

    async def fake_handle_exit(payload: Dict[str, Any], sio_obj, *, emit_update: bool = True):
        handle_exit_calls.append((payload, sio_obj, {"emit_update": emit_update}))

    monkeypatch.setattr(runtime, "_handle_process_exit", fake_handle_exit)

    process_id = await runtime.start_crew(crew_id, {"foo": "bar"}, sio)

    assert process_id == str(dummy_process.pid)
    assert crew_id in runtime.running_crews

    assert len(created_tasks) == 1
    await created_tasks[0]

    assert len(broadcaster.calls) == 1
    args, kwargs = broadcaster.calls[0]
    assert args[0] == crew_id
    assert args[1] is dummy_process
    assert args[2] is sio
    assert kwargs["process_id"] == str(dummy_process.pid)

    on_stop = kwargs["on_stop"]
    exit_payload = {"crew_id": crew_id, "process_id": process_id, "exit_code": 0}
    await on_stop(exit_payload)

    assert handle_exit_calls == [
        (exit_payload, sio, {"emit_update": True}),
    ]

    assert ("crew_started", {"crew_id": crew_id, "process_id": process_id, "status": "started"}) in sio.emitted
