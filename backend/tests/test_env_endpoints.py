import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    crew_dir = tmp_path / "demo_crew"
    package_dir = crew_dir / "src" / "demo"
    config_dir = package_dir / "config"
    config_dir.mkdir(parents=True)

    # Minimal files required for crew discovery utilities
    (config_dir / "agents.yaml").write_text("agents: {}\n", encoding="utf-8")
    (config_dir / "tasks.yaml").write_text("tasks: {}\n", encoding="utf-8")
    (package_dir / "main.py").write_text("def run(**inputs):\n    return inputs\n", encoding="utf-8")

    # Environment files to exercise the API
    (crew_dir / ".env").write_text("API_KEY=123\n", encoding="utf-8")
    nested_env = crew_dir / "config" / ".env.local"
    nested_env.parent.mkdir(parents=True, exist_ok=True)
    nested_env.write_text("LOCAL_VAR=value\n", encoding="utf-8")

    monkeypatch.setenv("CREWS_PATH", str(tmp_path))

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

    # Ensure a clean import so the new CREWS_PATH is honoured
    for module in ["main", "crew_manager"]:
        if module in sys.modules:
            del sys.modules[module]

    backend_root = Path(__file__).resolve().parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    main_module = importlib.import_module("main")
    client = TestClient(main_module.app)

    try:
        yield client, main_module, crew_dir
    finally:
        client.close()
        if hasattr(main_module, "observer") and hasattr(main_module.observer, "stop"):
            try:
                main_module.observer.stop()
            except Exception:
                pass

import types


def test_list_env_files(api_client):
    client, _, crew_dir = api_client
    response = client.get(f"/api/crews/{crew_dir.name}/env-files")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert set(payload["files"]) == {".env", "config/.env.local"}


def test_get_env_file_content(api_client):
    client, _, crew_dir = api_client
    response = client.get(f"/api/crews/{crew_dir.name}/env/.env")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["content"] == "API_KEY=123\n"


def test_save_env_file_validation_error(api_client):
    client, _, crew_dir = api_client
    response = client.post(
        f"/api/crews/{crew_dir.name}/env/.env",
        json={"content": "INVALID"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert "Invalid environment" in payload["detail"]


def test_save_env_file_updates_disk(api_client):
    client, _, crew_dir = api_client
    new_content = "API_KEY=999\nNEW_VALUE=test\n"
    response = client.post(
        f"/api/crews/{crew_dir.name}/env/.env",
        json={"content": new_content},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True

    saved_content = (crew_dir / ".env").read_text(encoding="utf-8")
    assert saved_content == new_content


def test_save_env_file_uses_atomic_write(api_client, monkeypatch):
    client, main_module, crew_dir = api_client
    new_content = "API_KEY=abc\n"
    recorded = {}

    original_atomic = main_module.crew_manager._atomic_write

    def tracking_atomic(self, file_path, content):
        recorded["path"] = file_path
        recorded["content"] = content
        return original_atomic(file_path, content)

    monkeypatch.setattr(
        main_module.crew_manager,
        "_atomic_write",
        types.MethodType(tracking_atomic, main_module.crew_manager),
    )

    response = client.post(
        f"/api/crews/{crew_dir.name}/env/.env",
        json={"content": new_content},
    )

    assert response.status_code == 200
    assert recorded["path"] == crew_dir / ".env"
    assert recorded["content"] == new_content


def test_save_yaml_file_validation_error(api_client):
    client, _, crew_dir = api_client
    response = client.post(
        f"/api/crews/{crew_dir.name}/tasks",
        json={"content": "bad: [unbalanced"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert "Invalid YAML" in payload["detail"]


def test_save_yaml_file_uses_atomic_write(api_client, monkeypatch):
    client, main_module, crew_dir = api_client
    new_yaml = "description: updated\nexpected_output: value\n"
    recorded = {}

    original_atomic = main_module.crew_manager._atomic_write

    def tracking_atomic(self, file_path, content):
        recorded["path"] = file_path
        recorded["content"] = content
        return original_atomic(file_path, content)

    monkeypatch.setattr(
        main_module.crew_manager,
        "_atomic_write",
        types.MethodType(tracking_atomic, main_module.crew_manager),
    )

    response = client.post(
        f"/api/crews/{crew_dir.name}/tasks",
        json={"content": new_yaml},
    )

    assert response.status_code == 200
    assert recorded["path"].as_posix().endswith("config/tasks.yaml")
    assert recorded["content"] == new_yaml
