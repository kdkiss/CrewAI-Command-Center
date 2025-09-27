import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
import importlib.util

import pytest

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import crew_manager
from crew_manager import CrewManager, normalize_crew_identifier


@pytest.fixture(autouse=True)
def disable_cleanup(monkeypatch):
    monkeypatch.setattr(CrewManager, "_schedule_cleanup", lambda self: None)


class DummySio:
    def __init__(self):
        self.emitted = []

    async def emit(self, name, payload):
        self.emitted.append((name, payload))


class DummyTask:
    def __init__(self, coro):
        self.coro = coro

    def cancel(self):
        pass

    def __await__(self):
        return iter(())


def _build_crew(tmp_path: Path, crew_id: str = "demo", package_name: str = "package") -> Path:
    crew_dir = tmp_path / crew_id
    pkg_dir = crew_dir / "src" / package_name
    pkg_dir.mkdir(parents=True)
    (pkg_dir / "main.py").write_text("print('hello')\n", encoding="utf-8")
    (crew_dir / ".env").write_text("SHARED=crew_override\nLOCAL_ONLY=value\n", encoding="utf-8")
    return crew_dir


@pytest.mark.asyncio
async def test_start_crew_uv_posix(monkeypatch, tmp_path):
    crew_id = "crew_uv"
    crew_dir = _build_crew(tmp_path, crew_id, "uvpkg")

    monkeypatch.setenv("PYTHONPATH", "/base")
    monkeypatch.setenv("SHARED", "original")

    manager = CrewManager(str(tmp_path))

    captured = {}

    class DummyProcess:
        def __init__(self):
            self.pid = 4321
            self.returncode = None
            self.stdout = object()
            self.stderr = object()

    async def fake_create_subprocess_exec(*cmd, **kwargs):
        captured["cmd"] = list(cmd)
        captured["cwd"] = kwargs.get("cwd")
        captured["env"] = kwargs.get("env")
        captured["stdout"] = kwargs.get("stdout")
        captured["stderr"] = kwargs.get("stderr")
        return DummyProcess()

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return DummyTask(coro)

    monkeypatch.setattr(crew_manager.asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    monkeypatch.setattr(crew_manager.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(crew_manager.shutil, "which", lambda name: "/usr/bin/uv" if name == "uv" else None)
    monkeypatch.setattr("platform.system", lambda: "Linux")
    monkeypatch.setattr(crew_manager.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("Should not use subprocess.Popen on POSIX"))

    sio = DummySio()
    inputs = {"topic": "space", "count": 3}

    pid = await manager.start_crew(crew_id, inputs, sio)

    assert pid == "4321"
    assert captured["cmd"] == ["uv", "run", "python", os.path.join("src", "uvpkg", "main.py")]
    assert captured["cwd"] == str(crew_dir)
    assert captured["stdout"] is crew_manager.asyncio.subprocess.PIPE
    assert captured["stderr"] is crew_manager.asyncio.subprocess.PIPE

    env = captured["env"]
    assert env["PYTHONUNBUFFERED"] == "1"
    assert env["TOPIC"] == "space"
    assert env["COUNT"] == "3"
    assert env["SHARED"] == "crew_override"
    assert env["LOCAL_ONLY"] == "value"
    assert env["PYTHONPATH"] == "/base"

    assert crew_id in manager.running_crews
    assert isinstance(manager.running_crews[crew_id]["process"], DummyProcess)
    assert created_tasks, "Expected log streaming task to be scheduled"
    assert ("crew_started", {"crew_id": crew_id, "process_id": "4321", "status": "started"}) in sio.emitted


@pytest.mark.asyncio
async def test_start_crew_python_posix(monkeypatch, tmp_path):
    crew_id = "crew_py"
    crew_dir = _build_crew(tmp_path, crew_id, "pypkg")
    pkg_dir = crew_dir / "src" / "pypkg"

    monkeypatch.setenv("PYTHONPATH", "/base")
    monkeypatch.setenv("SHARED", "original")

    manager = CrewManager(str(tmp_path))

    captured = {}

    class DummyProcess:
        def __init__(self):
            self.pid = 1234
            self.returncode = None
            self.stdout = object()
            self.stderr = object()

    async def fake_create_subprocess_exec(*cmd, **kwargs):
        captured["cmd"] = list(cmd)
        captured["cwd"] = kwargs.get("cwd")
        captured["env"] = kwargs.get("env")
        return DummyProcess()

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return DummyTask(coro)

    monkeypatch.setattr(crew_manager.asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    monkeypatch.setattr(crew_manager.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(crew_manager.shutil, "which", lambda name: None)
    monkeypatch.setattr("platform.system", lambda: "Linux")
    monkeypatch.setattr(crew_manager.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("Should not use subprocess.Popen on POSIX"))

    sio = DummySio()
    inputs = {"topic": "ocean", "count": 5}

    pid = await manager.start_crew(crew_id, inputs, sio)

    assert pid == "1234"
    assert captured["cmd"] == [sys.executable, "-u", "main.py"]
    assert captured["cwd"] == str(pkg_dir)

    env = captured["env"]
    assert env["PYTHONUNBUFFERED"] == "1"
    assert env["TOPIC"] == "ocean"
    assert env["COUNT"] == "5"
    assert env["SHARED"] == "crew_override"
    assert env["LOCAL_ONLY"] == "value"
    assert env["PYTHONPATH"].startswith(str(crew_dir / "src"))
    assert env["PYTHONPATH"].endswith(os.pathsep + "/base")

    assert crew_id in manager.running_crews
    assert isinstance(manager.running_crews[crew_id]["process"], DummyProcess)
    assert created_tasks


@pytest.mark.asyncio
async def test_start_crew_windows_uses_popen(monkeypatch, tmp_path):
    crew_id = "crew_win"
    crew_dir = _build_crew(tmp_path, crew_id, "winpkg")

    monkeypatch.setenv("PYTHONPATH", "/base")
    monkeypatch.setenv("SHARED", "original")

    manager = CrewManager(str(tmp_path))

    captured = {}

    class DummyPopen:
        def __init__(self, cmd, cwd=None, stdout=None, stderr=None, env=None, text=None, bufsize=None, universal_newlines=None):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            captured["env"] = env
            captured["stdout"] = stdout
            captured["stderr"] = stderr
            self.pid = 2468
            self._returncode = None
            self.stdout = object()
            self.stderr = object()

        def poll(self):
            return self._returncode

        def terminate(self):
            pass

        def kill(self):
            pass

    def fake_create_task(coro):
        coro.close()
        return DummyTask(coro)

    def fail_create_subprocess_exec(*args, **kwargs):  # pragma: no cover - defensive
        raise AssertionError("Should not call create_subprocess_exec on Windows")

    monkeypatch.setattr(crew_manager.asyncio, "create_subprocess_exec", fail_create_subprocess_exec)
    monkeypatch.setattr(crew_manager.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(crew_manager.shutil, "which", lambda name: "/usr/bin/uv" if name == "uv" else None)
    monkeypatch.setattr("platform.system", lambda: "Windows")
    monkeypatch.setattr(crew_manager.subprocess, "Popen", DummyPopen)

    sio = DummySio()
    inputs = {"topic": "desert"}

    pid = await manager.start_crew(crew_id, inputs, sio)

    assert pid == "2468"
    assert captured["cmd"] == ["uv", "run", "python", os.path.join("src", "winpkg", "main.py")]
    assert captured["cwd"] == str(crew_dir)

    env = captured["env"]
    assert env["PYTHONUNBUFFERED"] == "1"
    assert env["TOPIC"] == "desert"
    assert env["SHARED"] == "crew_override"
    assert env["LOCAL_ONLY"] == "value"


@pytest.mark.asyncio
async def test_start_crew_running_collision(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))
    manager.running_crews["duplicate"] = {"process": object()}

    sio = DummySio()
    with pytest.raises(Exception, match="already running"):
        await manager.start_crew("duplicate", {}, sio)


@pytest.mark.asyncio
async def test_start_crew_invalid_structure(tmp_path):
    crew_id = "bad"
    crew_dir = tmp_path / crew_id
    crew_dir.mkdir()

    manager = CrewManager(str(tmp_path))

    sio = DummySio()
    with pytest.raises(Exception, match="missing src directory"):
        await manager.start_crew(crew_id, {}, sio)


def test_stop_crew_terminate(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))

    class FakeProcess:
        def __init__(self):
            self.pid = 55
            self.returncode = None
            self.terminated = False
            self.killed = False

        def terminate(self):
            self.terminated = True

        def kill(self):
            self.killed = True

    process = FakeProcess()
    manager.running_crews["crew"] = {"process": process}

    manager.stop_crew("crew")

    assert process.terminated is True
    assert process.killed is False


def test_stop_crew_kill_fallback(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))

    class FakeProcess:
        def __init__(self):
            self.pid = 66
            self.returncode = None
            self.killed = False

        def terminate(self):
            raise RuntimeError("boom")

        def kill(self):
            self.killed = True

    process = FakeProcess()
    manager.running_crews["crew"] = {"process": process}

    manager.stop_crew("crew")

    assert process.killed is True


def test_stop_crew_already_finished(tmp_path):
    manager = CrewManager(str(tmp_path))

    class FakeProcess:
        def __init__(self):
            self.pid = 77
            self.returncode = 0
            self.terminated = False

        def terminate(self):
            self.terminated = True

    process = FakeProcess()
    manager.running_crews["crew"] = {"process": process}

    manager.stop_crew("crew")

    assert process.terminated is False


@pytest.mark.asyncio
async def test_create_and_start_crew_with_special_characters(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))

    config = {
        "agents": {
            "alpha": {
                "name": "alpha",
                "role": "Researcher",
                "goal": "Explore",
                "backstory": "Seasoned analyst",
            }
        },
        "tasks": {
            "primary": {
                "name": "primary",
                "description": "Compile findings",
                "expected_output": "Summary",
            }
        },
    }

    raw_id = "messy-crew.v1"
    normalized_id = normalize_crew_identifier(raw_id)

    cli_calls = []

    def fake_cli(command, cwd=None, check=None, capture_output=None, text=None):
        cli_calls.append(command)
        assert command[-1] == normalized_id
        cli_dir = Path(cwd) / raw_id
        pkg = cli_dir / "src" / raw_id
        pkg.mkdir(parents=True)
        (pkg / "main.py").write_text(
            "# Provided by CLI\n\n"
            "def run(**inputs):\n"
            "    return inputs\n",
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="CLI warning")

    monkeypatch.setattr(crew_manager.subprocess, "run", fake_cli)

    manager.create_crew(raw_id, config)
    assert cli_calls, "Expected CrewAI CLI to be invoked"

    normalized_id = normalize_crew_identifier(raw_id)
    crew_dir = tmp_path / normalized_id
    pkg_dir = crew_dir / "src" / normalized_id
    config_dir = pkg_dir / "config"

    assert not (tmp_path / raw_id).exists(), "Original CLI directory should be renamed"
    metadata = json.loads((config_dir / "crew.json").read_text(encoding="utf-8"))
    assert metadata["name"] == normalized_id

    main_py = pkg_dir / "main.py"
    main_contents = main_py.read_text(encoding="utf-8")
    assert main_contents.startswith("# Provided by CLI")

    class_name = "".join(part.capitalize() for part in normalized_id.split("_"))
    if not class_name.endswith("Crew"):
        class_name += "Crew"

    (pkg_dir / "__init__.py").write_text("", encoding="utf-8")
    (pkg_dir / "crew.py").write_text(
        f"class {class_name}:\n"
        "    def crew(self):\n"
        "        class Runner:\n"
        "            def kickoff(self, inputs):\n"
        "                return inputs\n"
        "        return Runner()\n",
        encoding="utf-8",
    )

    spec = importlib.util.spec_from_file_location(f"{normalized_id}.main", main_py)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.run(topic="ai")

    monkeypatch.setenv("PYTHONPATH", "/base")

    class DummyProcess:
        def __init__(self):
            self.pid = 9876
            self.returncode = None
            self.stdout = object()
            self.stderr = object()

    captured = {}

    async def fake_create_subprocess_exec(*cmd, **kwargs):
        captured["cmd"] = list(cmd)
        captured["cwd"] = kwargs.get("cwd")
        captured["env"] = kwargs.get("env")
        return DummyProcess()

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return DummyTask(coro)

    monkeypatch.setattr(crew_manager.asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    monkeypatch.setattr(crew_manager.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(crew_manager.shutil, "which", lambda name: None)
    monkeypatch.setattr("platform.system", lambda: "Linux")
    monkeypatch.setattr(crew_manager.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("Should not use subprocess.Popen"))

    sio = DummySio()
    pid = await manager.start_crew(raw_id, {"topic": "ai"}, sio)

    assert pid == "9876"
    assert captured["cmd"] == [sys.executable, "-u", "main.py"]
    assert captured["cwd"] == str(pkg_dir)
    assert captured["env"]["PYTHONUNBUFFERED"] == "1"
    assert captured["env"]["TOPIC"] == "ai"
    assert captured["env"]["PYTHONPATH"].startswith(str(crew_dir / "src"))
    assert normalized_id in manager.running_crews
    assert any(event[0] == "crew_started" and event[1]["crew_id"] == normalized_id for event in sio.emitted)
    assert created_tasks, "Expected log streaming task to be scheduled"


def _sample_config() -> dict:
    return {
        "agents": {
            "alpha": {
                "name": "alpha",
                "role": "Researcher",
                "goal": "Explore",
                "backstory": "Seasoned analyst",
            }
        },
        "tasks": {
            "primary": {
                "name": "primary",
                "description": "Compile findings",
                "expected_output": "Summary",
            }
        },
    }


def test_create_crew_cli_failure(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))

    calls = []

    def failing_cli(command, cwd=None, check=None, capture_output=None, text=None):
        calls.append(command)
        raise subprocess.CalledProcessError(returncode=1, cmd=command, stderr="boom")

    monkeypatch.setattr(crew_manager.subprocess, "run", failing_cli)

    with pytest.raises(RuntimeError):
        manager.create_crew("failed-crew", _sample_config())

    assert calls == [["crewai", "create", "crew", "failed_crew"]]
    assert not (tmp_path / "failed-crew").exists()
    assert not (tmp_path / "failed_crew").exists()


def test_create_crew_cli_fallback(monkeypatch, tmp_path):
    manager = CrewManager(str(tmp_path))

    commands = []

    def cli_with_fallback(command, cwd=None, check=None, capture_output=None, text=None):
        commands.append(command)
        if command[0] == "crewai":
            raise FileNotFoundError("crewai not installed")

        cli_dir = Path(cwd) / "fallback-crew"
        pkg = cli_dir / "src" / "fallback-crew"
        pkg.mkdir(parents=True)
        (pkg / "main.py").write_text(
            "def run(**inputs):\n"
            "    return inputs\n",
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(crew_manager.subprocess, "run", cli_with_fallback)

    manager.create_crew("fallback-crew", _sample_config())

    assert len(commands) == 2
    assert commands[0] == ["crewai", "create", "crew", "fallback_crew"]
    assert commands[1][-2:] == ["crew", "fallback_crew"]

    normalized = "fallback_crew"
    crew_dir = tmp_path / normalized
    pkg_dir = crew_dir / "src" / normalized
    assert crew_dir.exists()
    assert not (tmp_path / "fallback-crew").exists()
    assert (pkg_dir / "main.py").exists()
    assert json.loads((pkg_dir / "config" / "crew.json").read_text(encoding="utf-8"))[
        "name"
    ] == normalized
