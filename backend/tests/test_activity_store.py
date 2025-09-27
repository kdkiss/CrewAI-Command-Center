import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import activity_store  # noqa: E402  pylint: disable=wrong-import-position
from activity_store import ActivityStore  # noqa: E402  pylint: disable=wrong-import-position


@pytest.fixture
def storage_path(tmp_path):
    return tmp_path / "activity.json"


def test_add_event_tracks_known_events(monkeypatch, storage_path):
    base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time)

    store = ActivityStore(storage_path=storage_path, retention_seconds=None)

    payload = {"message": "hello", "details": {"count": 1}}
    entry = store.add_event("crew_started", payload)

    assert entry is not None
    assert entry["id"] == 1
    assert entry["type"] == "crew_started"
    assert entry["data"] == payload

    # Mutating the original payload should not affect the stored event.
    payload["details"]["count"] = 999
    events = store.get_events()
    assert events == [entry]
    assert events[0]["data"]["details"]["count"] == 1

    # Non-tracked events should be ignored.
    assert store.add_event("not_tracked", {"message": "ignored"}) is None


def test_prune_removes_expired_events(monkeypatch):
    base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
    store = ActivityStore(max_events=10, retention_seconds=60)

    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time)
    store.add_event("crew_started", {"message": "first"})

    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time + timedelta(seconds=30))
    store.add_event("crew_log", {"message": "second"})

    # Advance beyond the retention window and prune.
    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time + timedelta(seconds=200))
    store.prune()
    events = store.get_events()

    assert events == []


def test_persistence_round_trip(monkeypatch, storage_path):
    base_time = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time)

    store = ActivityStore(storage_path=storage_path, retention_seconds=None)
    store.add_event("crew_started", {"message": "boot"})
    store.add_event("crew_log", {"message": "running"})

    assert storage_path.exists()

    original_events = store.get_events()

    # Re-open the store using the persisted data and ensure the sequence continues.
    monkeypatch.setattr(activity_store, "_utcnow", lambda: base_time + timedelta(minutes=5))
    reloaded = ActivityStore(storage_path=storage_path, retention_seconds=None)
    reloaded_events = reloaded.get_events()

    assert reloaded_events == original_events

    next_entry = reloaded.add_event("crew_stopped", {"message": "done"})
    assert next_entry["id"] == max(event["id"] for event in original_events) + 1
    assert next_entry["timestamp"].startswith("2024-01-01T12:05")
