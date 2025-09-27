from __future__ import annotations

from pathlib import Path

import main


def test_start_crews_observer_handles_start_failure(monkeypatch):
    calls: dict[str, object] = {}

    class DummyObserver:
        def schedule(self, handler, path: str, recursive: bool) -> None:
            calls["scheduled"] = (handler.__class__.__name__, Path(path), recursive)

        def start(self) -> None:
            raise RuntimeError("boom")

        def stop(self) -> None:
            calls["stopped"] = True

        def join(self, timeout: float | None = None) -> None:
            calls["joined"] = timeout

    monkeypatch.setattr(main, "Observer", DummyObserver, raising=False)

    observer = main._start_crews_observer(main.crews_path)

    assert observer is None
    assert calls.get("scheduled") is not None
    assert calls.get("stopped") is True


def test_start_crews_observer_noop_when_observer_missing(monkeypatch):
    monkeypatch.setattr(main, "Observer", None, raising=False)

    observer = main._start_crews_observer(main.crews_path)

    assert observer is None
