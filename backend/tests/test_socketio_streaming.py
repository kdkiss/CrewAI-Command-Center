import asyncio
import socket
from contextlib import closing

import pytest
import socketio
import uvicorn


async def _wait_for_server_start(server: uvicorn.Server, timeout: float = 5.0) -> None:
    """Wait until a uvicorn server marks itself as started."""

    loop = asyncio.get_running_loop()
    end_time = loop.time() + timeout
    while not getattr(server, "started", False):
        if server.should_exit:
            raise RuntimeError("Uvicorn server exited before startup completed")
        if loop.time() >= end_time:
            raise TimeoutError("Timed out waiting for uvicorn to start")
        await asyncio.sleep(0.05)


def _reserve_port(host: str = "127.0.0.1") -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind((host, 0))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.getsockname()[1]


@pytest.mark.asyncio
async def test_socketio_streaming_emits_lifecycle_and_log_events(api_client, monkeypatch):
    _client, main_module, _ = api_client

    main_module.activity_store.add_event(
        "crew_started",
        {"crew_id": "demo-crew", "status": "started", "process_id": "bootstrap"},
    )

    class StubCrewManager:
        def __init__(self) -> None:
            self.started = []
            self.stopped = []

        async def start_crew(self, crew_id, inputs, sio):
            self.started.append((crew_id, inputs))

            await sio.emit(
                "crew_started",
                {
                    "crew_id": crew_id,
                    "process_id": "process-stub",
                    "status": "started",
                },
            )

            async def emit_stream():
                await asyncio.sleep(0)
                await sio.emit(
                    "crew_log",
                    {
                        "crewId": crew_id,
                        "agent": "observer",
                        "message": "Synthesizing search results",
                        "level": "info",
                        "timestamp": "2024-05-01T12:00:00Z",
                        "category": "THINKING",
                        "operationId": "op-1",
                        "sequence": 1,
                        "isDuplicate": False,
                        "duplicateCount": 0,
                    },
                )
                await asyncio.sleep(0)
                await sio.emit(
                    "crew_stopped",
                    {
                        "crew_id": crew_id,
                        "status": "stopped",
                        "exit_code": 0,
                    },
                )

            asyncio.create_task(emit_stream())
            return "process-stub"

        def stop_crew(self, crew_id):
            self.stopped.append(crew_id)

        def _schedule_cleanup(self):
            return None

        def get_crews(self):
            return []

    monkeypatch.setattr(main_module, "crew_manager", StubCrewManager())

    background_tasks = []

    def _spawn_task(target, *args, **kwargs):
        task = asyncio.create_task(target(*args, **kwargs))
        background_tasks.append(task)
        return task

    def _spawn_task_bound(self, target, *args, **kwargs):
        return _spawn_task(target, *args, **kwargs)

    monkeypatch.setattr(
        socketio.AsyncServer,
        "start_background_task",
        _spawn_task_bound,
    )
    monkeypatch.setattr(
        main_module.sio,
        "start_background_task",
        lambda target, *args, **kwargs: _spawn_task(target, *args, **kwargs),
    )

    host = "127.0.0.1"
    port = _reserve_port(host)
    config = uvicorn.Config(main_module.app, host=host, port=port, log_level="warning", lifespan="on")
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve())
    sio_client = socketio.AsyncClient()

    crew_started_event = asyncio.Event()
    crew_log_event = asyncio.Event()
    crew_stopped_event = asyncio.Event()
    history_event = asyncio.Event()

    crew_started_payload = {}
    crew_log_payloads = []
    crew_stopped_payload = {}
    history_payloads = []

    try:
        await _wait_for_server_start(server)

        @sio_client.event
        async def crew_started(data):
            crew_started_payload.update(data)
            crew_started_event.set()

        @sio_client.event
        async def crew_log(data):
            crew_log_payloads.append(data)
            crew_log_event.set()

        @sio_client.event
        async def crew_stopped(data):
            crew_stopped_payload.update(data)
            crew_stopped_event.set()

        @sio_client.event
        async def activity_history(data):
            if isinstance(data, list):
                history_payloads.extend(data)
            history_event.set()

        await sio_client.connect(f"http://{host}:{port}", wait_timeout=5, socketio_path="socket.io")
        await asyncio.wait_for(history_event.wait(), timeout=5)
        await sio_client.emit("startCrew", {"crew_id": "demo-crew", "inputs": {"topic": "ai"}})

        await asyncio.wait_for(crew_started_event.wait(), timeout=5)
        await asyncio.wait_for(crew_log_event.wait(), timeout=5)
        await asyncio.wait_for(crew_stopped_event.wait(), timeout=5)

        assert crew_started_payload == {
            "crew_id": "demo-crew",
            "process_id": "process-stub",
            "status": "started",
        }

        assert history_payloads
        history_entry = history_payloads[0]
        assert history_entry["type"] == "crew_started"
        assert history_entry["data"]["crew_id"] == "demo-crew"

        assert crew_log_payloads, "Expected at least one crew_log payload"
        log_entry = crew_log_payloads[0]
        assert log_entry["crewId"] == "demo-crew"
        assert log_entry["agent"] == "observer"
        assert log_entry["category"] == "THINKING"
        assert log_entry["isDuplicate"] is False
        assert log_entry["duplicateCount"] == 0

        assert crew_stopped_payload["crew_id"] == "demo-crew"
        assert crew_stopped_payload["status"] == "stopped"
        assert crew_stopped_payload["exit_code"] == 0

    finally:
        if sio_client.connected:
            await sio_client.disconnect()
        server.should_exit = True
        await server_task
        if background_tasks:
            for task in background_tasks:
                task.cancel()
            await asyncio.gather(*background_tasks, return_exceptions=True)


@pytest.mark.asyncio
async def test_socketio_emits_crew_error_on_start_failure(api_client, monkeypatch):
    _client, main_module, _ = api_client

    class FailingCrewManager:
        def __init__(self) -> None:
            self.started = []

        async def start_crew(self, crew_id, inputs, sio):
            self.started.append((crew_id, inputs))
            raise RuntimeError("engine failure")

        def stop_crew(self, crew_id):
            return None

        def _schedule_cleanup(self):
            return None

        def get_crews(self):
            return []

    monkeypatch.setattr(main_module, "crew_manager", FailingCrewManager())

    background_tasks = []

    def _spawn_task(target, *args, **kwargs):
        task = asyncio.create_task(target(*args, **kwargs))
        background_tasks.append(task)
        return task

    monkeypatch.setattr(
        socketio.AsyncServer,
        "start_background_task",
        lambda self, target, *args, **kwargs: _spawn_task(target, *args, **kwargs),
    )
    monkeypatch.setattr(
        main_module.sio,
        "start_background_task",
        lambda target, *args, **kwargs: _spawn_task(target, *args, **kwargs),
    )

    host = "127.0.0.1"
    port = _reserve_port(host)
    config = uvicorn.Config(main_module.app, host=host, port=port, log_level="warning", lifespan="on")
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve())
    sio_client = socketio.AsyncClient()

    crew_error_event = asyncio.Event()
    crew_error_payload = {}

    try:
        await _wait_for_server_start(server)

        @sio_client.event
        async def crew_error(data):
            crew_error_payload.update(data)
            crew_error_event.set()

        await sio_client.connect(f"http://{host}:{port}", wait_timeout=5, socketio_path="socket.io")
        await sio_client.emit("startCrew", {"crew_id": "failing-crew", "inputs": {}})

        await asyncio.wait_for(crew_error_event.wait(), timeout=5)

        assert crew_error_payload == {
            "crew_id": "failing-crew",
            "error": "engine failure",
            "status": "error",
        }

        events = main_module.activity_store.get_events()
        assert any(
            event["type"] == "crew_error" and event["data"].get("crew_id") == "failing-crew"
            for event in events
        )
    finally:
        if sio_client.connected:
            await sio_client.disconnect()
        server.should_exit = True
        await server_task
        if background_tasks:
            for task in background_tasks:
                task.cancel()
            await asyncio.gather(*background_tasks, return_exceptions=True)
