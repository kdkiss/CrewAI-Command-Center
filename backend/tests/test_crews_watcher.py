import asyncio
import importlib
import sys
from pathlib import Path

import pytest


@pytest.fixture
def reload_backend_main(monkeypatch, tmp_path):
    """Reload main.py with a temporary crews directory available on sys.path."""
    module_name = "main"
    backend_root = Path(__file__).resolve().parents[1]
    backend_path = str(backend_root)
    added_path = False

    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
        added_path = True

    # Ensure any existing observer is stopped before reloading
    existing = sys.modules.pop(module_name, None)
    if existing and hasattr(existing, "observer"):
        existing.observer.stop()
        existing.observer.join()

    # Reload crew_manager to ensure a fresh CrewManager instance with the temp path
    sys.modules.pop("crew_manager", None)

    monkeypatch.setenv("CREWS_PATH", str(tmp_path))
    module = importlib.import_module(module_name)
    yield module

    if hasattr(module, "observer"):
        module.observer.stop()
        module.observer.join()

    # Reset captured event loop to avoid leaking closed loops to other tests
    if hasattr(module, "crew_manager"):
        module.crew_manager.event_loop = None
    if hasattr(module, "sio") and hasattr(module.sio, "main_event_loop"):
        module.sio.main_event_loop = None

    if added_path:
        sys.path.remove(backend_path)


@pytest.mark.asyncio
async def test_crews_updated_emitted_for_filesystem_events(reload_backend_main, tmp_path, monkeypatch):
    main = reload_backend_main

    await main.capture_main_event_loop()

    crew_update_event = asyncio.Event()
    emissions = []

    async def fake_emit(event_name, payload):
        emissions.append((event_name, payload))
        if event_name == "crews_updated":
            crew_update_event.set()

    monkeypatch.setattr(main.sio, "emit", fake_emit)

    # Ensure the watchdog observer thread has started before triggering events
    await asyncio.sleep(0.2)

    crew_dir = tmp_path / "example_crew"
    config_dir = crew_dir / "src" / "example_pkg" / "config"
    config_dir.mkdir(parents=True)
    (config_dir / "agents.yaml").write_text("{}")
    (config_dir / "tasks.yaml").write_text("{}")
    (config_dir.parent / "main.py").write_text("# example")

    await asyncio.wait_for(crew_update_event.wait(), timeout=5)

    assert any(event == "crews_updated" for event, _ in emissions)


@pytest.mark.asyncio
async def test_cleanup_scheduled_on_startup(reload_backend_main, monkeypatch):
    main = reload_backend_main

    calls = 0

    def fake_schedule_cleanup():
        nonlocal calls
        calls += 1

    monkeypatch.setattr(main.crew_manager, "_schedule_cleanup", fake_schedule_cleanup)

    await main.capture_main_event_loop()

    assert calls == 1
