import importlib
import sys
from pathlib import Path
from typing import Tuple
import types

import pytest
from fastapi.testclient import TestClient
import socketio


def _cleanup_main_instance(client: TestClient, main_module: object) -> None:
    client.close()

    observer = getattr(main_module, "observer", None)
    if observer and hasattr(observer, "stop"):
        try:
            observer.stop()
        except Exception:
            pass
    if observer and hasattr(observer, "join"):
        try:
            observer.join()
        except Exception:
            pass


class _MainAppInstance:
    def __init__(self, client: TestClient, module: object, crew_dir: Path, storage_path: Path) -> None:
        self.client = client
        self.module = module
        self.crew_dir = crew_dir
        self.storage_path = storage_path
        self._closed = False

    def close(self) -> None:
        if self._closed:
            return

        _cleanup_main_instance(self.client, self.module)
        self._closed = True


def _bootstrap_main_app(tmp_path: Path, monkeypatch) -> Tuple[TestClient, object, Path, Path]:
    crew_dir = tmp_path / "demo_crew"
    package_dir = crew_dir / "src" / "demo"
    config_dir = package_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)

    # Minimal files required for crew discovery utilities
    (config_dir / "agents.yaml").write_text("agents: {}\n", encoding="utf-8")
    (config_dir / "tasks.yaml").write_text("tasks: {}\n", encoding="utf-8")
    (package_dir / "main.py").write_text("def run(**kwargs):\n    return kwargs\n", encoding="utf-8")

    # Environment files to exercise the API
    (crew_dir / ".env").write_text("API_KEY=123\n", encoding="utf-8")
    nested_env = crew_dir / "config" / ".env.local"
    nested_env.parent.mkdir(parents=True, exist_ok=True)
    nested_env.write_text("LOCAL_VAR=value\n", encoding="utf-8")

    storage_path = tmp_path / "activity_history.json"

    monkeypatch.setenv("CREWS_PATH", str(tmp_path))
    monkeypatch.setenv("ACTIVITY_HISTORY_STORAGE_PATH", str(storage_path))


    from watchdog import observers

    class DummyObserver:
        def schedule(self, *args, **kwargs):
            return None

        def start(self):
            return None

        def stop(self):
            return None

        def join(self, *args, **kwargs):
            return None

    monkeypatch.setattr(observers, "Observer", DummyObserver)

    monkeypatch.setattr(
        socketio.AsyncServer,
        "start_background_task",
        lambda self, target, *args, **kwargs: types.SimpleNamespace(cancel=lambda: None),
    )

    # Ensure a clean import so the new CREWS_PATH is honoured
    for module in ["main", "crew_manager"]:
        if module in sys.modules:
            del sys.modules[module]

    backend_root = Path(__file__).resolve().parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    main_module = importlib.import_module("main")
    client = TestClient(main_module.app)

    return client, main_module, crew_dir, storage_path


@pytest.fixture
def api_client(tmp_path, monkeypatch) -> Tuple[TestClient, object, Path]:
    """Provide a FastAPI test client backed by a temporary crews directory."""

    client, main_module, crew_dir, _ = _bootstrap_main_app(tmp_path, monkeypatch)

    try:
        yield client, main_module, crew_dir
    finally:
        _cleanup_main_instance(client, main_module)


@pytest.fixture
def main_instance_factory(tmp_path, monkeypatch):
    instances = []

    def factory():
        client, main_module, crew_dir, storage_path = _bootstrap_main_app(tmp_path, monkeypatch)
        instance = _MainAppInstance(client, main_module, crew_dir, Path(storage_path))
        instances.append(instance)
        return instance

    try:
        yield factory
    finally:
        for instance in reversed(instances):
            instance.close()
