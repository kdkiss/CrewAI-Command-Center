import os
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from agent_library import (  # noqa: E402  pylint: disable=wrong-import-position
    USER_AGENT_LIBRARY_FILENAME,
    load_user_agent_library,
    save_user_agent_library,
)
from crew_manager import CrewManager  # noqa: E402  pylint: disable=wrong-import-position


def _build_entry(suffix: str) -> dict[str, str]:
    return {
        "name": f"Test Agent {suffix}",
        "role": "Analyst",
        "goal": "Gather intel",
        "backstory": "Works tirelessly to surface insights.",
    }


def test_agent_library_survives_manager_restart(tmp_path: Path) -> None:
    manager = CrewManager(str(tmp_path))
    custom_entry = _build_entry("A")
    manager.add_agent_library_entry(custom_entry)

    second_manager = CrewManager(str(tmp_path))
    entries = second_manager.get_agent_library()

    assert any(entry["name"] == custom_entry["name"] for entry in entries)


def test_agent_library_delete_removes_entry(tmp_path: Path) -> None:
    manager = CrewManager(str(tmp_path))
    first = _build_entry("A")
    second = _build_entry("B")
    manager.add_agent_library_entry(first)
    manager.add_agent_library_entry(second)

    entries = manager.delete_agent_library_entry(0)

    assert all(entry.get("name") != first["name"] for entry in entries)
    persisted = manager._load_user_agent_library()  # pylint: disable=protected-access
    assert persisted == [second]


def test_save_user_agent_library_is_atomic(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / USER_AGENT_LIBRARY_FILENAME
    original_entry = _build_entry("Original")
    save_user_agent_library(path, [original_entry])

    def _explode(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise RuntimeError("boom")

    monkeypatch.setattr(os, "replace", _explode)

    with pytest.raises(RuntimeError):
        save_user_agent_library(path, [_build_entry("New")])

    persisted = load_user_agent_library(path)
    assert persisted == [original_entry]

    tmp_files = list(path.parent.glob(f"{path.name}*"))
    assert tmp_files == [path]
