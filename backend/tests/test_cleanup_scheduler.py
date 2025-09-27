import asyncio
import sys
from pathlib import Path

import pytest

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from crew_manager import CrewManager  # noqa: E402


@pytest.fixture
def crew_manager_without_loop(tmp_path):
    """Instantiate CrewManager when no asyncio loop is running."""
    return CrewManager(str(tmp_path))


def test_schedule_cleanup_defers_without_event_loop(crew_manager_without_loop):
    manager = crew_manager_without_loop

    assert manager._cleanup_task is None
    assert manager._cleanup_pending is True


@pytest.mark.asyncio
async def test_schedule_cleanup_starts_when_loop_available(monkeypatch, crew_manager_without_loop):
    manager = crew_manager_without_loop

    assert manager._cleanup_pending is True

    scheduled = asyncio.Event()

    async def fake_cleanup_worker(self):
        scheduled.set()

    monkeypatch.setattr(CrewManager, "_cleanup_worker", fake_cleanup_worker)

    original_create_task = asyncio.create_task
    created_tasks = []

    def fake_create_task(coro):
        task = original_create_task(coro)
        created_tasks.append(task)
        return task

    monkeypatch.setattr(asyncio, "create_task", fake_create_task)

    manager._schedule_cleanup()

    await asyncio.wait_for(scheduled.wait(), timeout=1)

    assert created_tasks
    assert manager._cleanup_pending is False

    for task in created_tasks:
        await task
