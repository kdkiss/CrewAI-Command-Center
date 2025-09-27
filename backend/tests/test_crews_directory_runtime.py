import importlib
import sys
import types
from pathlib import Path

import socketio
from watchdog import observers


def test_crews_directory_created_and_writable(tmp_path, monkeypatch):
    crews_root = tmp_path / "nested" / "crews"
    monkeypatch.setenv("CREWS_PATH", str(crews_root))

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

    for module in ("main", "crew_manager"):
        if module in sys.modules:
            del sys.modules[module]

    backend_root = Path(__file__).resolve().parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    main = importlib.import_module("main")

    try:
        crews_path = Path(main.CREWS_PATH)
        assert crews_path == crews_root
        assert crews_path.exists()

        test_file = crews_path / "write-check.txt"
        test_content = "ready"
        test_file.write_text(test_content, encoding="utf-8")
        assert test_file.read_text(encoding="utf-8") == test_content
    finally:
        if 'test_file' in locals() and test_file.exists():
            test_file.unlink()
        if hasattr(main, "observer") and hasattr(main.observer, "stop"):
            try:
                main.observer.stop()
            except Exception:
                pass
        if hasattr(main, "observer") and hasattr(main.observer, "join"):
            try:
                main.observer.join(timeout=0)
            except Exception:
                pass
        if "main" in sys.modules:
            del sys.modules["main"]
