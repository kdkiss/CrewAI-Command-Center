import types

def test_start_crew_success(api_client, monkeypatch):
    client, main_module, crew_dir = api_client
    recorded = {}

    async def fake_start(self, crew_id, inputs, sio):
        recorded["crew_id"] = crew_id
        recorded["inputs"] = inputs
        recorded["sio"] = sio
        return "pid-123"

    monkeypatch.setattr(
        main_module.crew_manager,
        "start_crew",
        types.MethodType(fake_start, main_module.crew_manager),
    )

    response = client.post(
        f"/api/crews/{crew_dir.name}/start",
        json={"inputs": {"topic": "ai"}},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload == {"process_id": "pid-123", "success": True}
    assert recorded["crew_id"] == crew_dir.name
    assert recorded["inputs"] == {"topic": "ai"}
    assert recorded["sio"] is main_module.sio


def test_start_crew_failure(api_client, monkeypatch):
    client, main_module, crew_dir = api_client

    async def fake_start(self, crew_id, inputs, sio):
        raise Exception("boom")

    monkeypatch.setattr(
        main_module.crew_manager,
        "start_crew",
        types.MethodType(fake_start, main_module.crew_manager),
    )

    response = client.post(
        f"/api/crews/{crew_dir.name}/start",
        json={"inputs": {}},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "boom"


def test_stop_crew_success(api_client, monkeypatch):
    client, main_module, crew_dir = api_client
    recorded = {}

    def fake_stop(self, crew_id):
        recorded["crew_id"] = crew_id

    monkeypatch.setattr(
        main_module.crew_manager,
        "stop_crew",
        types.MethodType(fake_stop, main_module.crew_manager),
    )

    response = client.post(f"/api/crews/{crew_dir.name}/stop")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {"status": "stopped", "success": True}
    assert recorded["crew_id"] == crew_dir.name


def test_stop_crew_failure(api_client, monkeypatch):
    client, main_module, crew_dir = api_client

    def fake_stop(self, crew_id):
        raise RuntimeError("cannot stop")

    monkeypatch.setattr(
        main_module.crew_manager,
        "stop_crew",
        types.MethodType(fake_stop, main_module.crew_manager),
    )

    response = client.post(f"/api/crews/{crew_dir.name}/stop")

    assert response.status_code == 400
    assert response.json()["detail"] == "cannot stop"


def test_create_crew_success(api_client, monkeypatch):
    client, main_module, _ = api_client
    recorded = {}
    events = []

    def fake_create(self, crew_id, config):
        recorded["crew_id"] = crew_id
        recorded["config"] = config
        return {"status": "success", "message": "ok"}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.crew_manager,
        "create_crew",
        types.MethodType(fake_create, main_module.crew_manager),
    )
    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    config = {
        "agents": {
            "agent_a": {
                "name": "agent_a",
                "role": "R",
                "goal": "G",
                "backstory": "B",
            }
        },
        "tasks": {
            "task_a": {
                "description": "Do it",
                "expected_output": "Done",
            }
        },
    }

    response = client.post(
        "/api/crews/new-crew",
        json=config,
    )

    assert response.status_code == 200
    assert recorded["crew_id"] == "new_crew"
    assert recorded["config"] == config
    assert events and events[0][0] == "crews_updated"


def test_create_crew_validation_error(api_client, monkeypatch):
    client, main_module, _ = api_client

    def fake_create(self, crew_id, config):
        raise ValueError("bad config")

    monkeypatch.setattr(
        main_module.crew_manager,
        "create_crew",
        types.MethodType(fake_create, main_module.crew_manager),
    )

    response = client.post(
        "/api/crews/new-crew",
        json={"agents": {}, "tasks": {}},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "bad config"


