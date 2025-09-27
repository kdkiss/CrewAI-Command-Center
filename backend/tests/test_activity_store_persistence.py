from pathlib import Path


def test_activity_history_persists_across_restarts(main_instance_factory):
    first_instance = main_instance_factory()
    try:
        first_instance.module.activity_store.add_event(
            "crew_started",
            {"crew_id": "persisted", "status": "started", "process_id": "123"},
        )
        first_instance.module.activity_store.add_event(
            "crew_error",
            {"crew_id": "persisted", "error": "boom", "status": "error"},
        )
    finally:
        first_instance.close()

    storage_path: Path = first_instance.storage_path
    assert storage_path.exists(), "Expected activity history file to be created"

    second_instance = main_instance_factory()
    try:
        response = second_instance.client.get("/api/activity")
        assert response.status_code == 200
        payload = response.json()
        events = payload.get("events", [])
        assert any(event["type"] == "crew_started" for event in events)
        assert any(event["type"] == "crew_error" for event in events)
    finally:
        second_instance.close()
