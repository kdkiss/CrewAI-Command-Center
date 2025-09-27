import asyncio
import json
import types

import pytest


def test_agent_library_endpoint_merges_user_entries(api_client):
    client, main_module, _ = api_client

    user_entry = {
        "name": "Custom Analyst",
        "role": "Special Projects Researcher",
        "goal": "Deliver bespoke insights for stakeholders.",
        "backstory": "You focus on rapid prototyping of research approaches.",
    }
    library_path = main_module.crew_manager.agent_library_path
    library_path.write_text(json.dumps([user_entry]), encoding="utf-8")

    response = client.get("/api/agents")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 2

    required_fields = {"name", "role", "goal", "backstory"}
    for entry in payload:
        assert required_fields.issubset(entry)
        assert all(isinstance(entry[field], str) for field in required_fields)
        assert all(entry[field].strip() for field in required_fields)

    assert any(entry["name"] == user_entry["name"] for entry in payload)
    assert any(entry.get("source") == "curated" for entry in payload)
    user_items = [entry for entry in payload if entry.get("source") == "user"]
    assert user_items
    assert all(isinstance(item.get("userIndex"), int) for item in user_items)


def test_agent_library_post_persists_entry(api_client):
    client, main_module, _ = api_client

    payload = {
        "name": "  Automation Specialist  ",
        "role": "Workflow Orchestrator",
        "goal": "Streamline repetitive crew operations.",
        "backstory": "You build tools that remove manual toil for the team.",
    }

    response = client.post("/api/agents", json=payload)

    assert response.status_code == 200
    agents = response.json()
    assert any(agent["name"] == "Automation Specialist" for agent in agents)
    updated_agent = next(agent for agent in agents if agent["name"] == "Automation Specialist")
    assert updated_agent["source"] == "user"
    assert updated_agent["userIndex"] == 0

    saved = json.loads(main_module.crew_manager.agent_library_path.read_text(encoding="utf-8"))
    assert saved == [
        {
            "name": "Automation Specialist",
            "role": "Workflow Orchestrator",
            "goal": "Streamline repetitive crew operations.",
            "backstory": "You build tools that remove manual toil for the team.",
        }
    ]


def test_agent_library_post_rejects_invalid_entry(api_client):
    client, _, _ = api_client

    response = client.post("/api/agents", json={"name": "Incomplete"})

    assert response.status_code == 400
    payload = response.json()
    assert "cannot be empty" in payload["detail"] or "must be" in payload["detail"]


def test_agent_library_put_updates_existing_entry(api_client):
    client, main_module, _ = api_client

    initial_entry = {
        "name": "Custom Researcher",
        "role": "Insights Lead",
        "goal": "Summarise findings",
        "backstory": "You compile executive-ready briefs.",
    }

    main_module.crew_manager.add_agent_library_entry(initial_entry)

    update_payload = {
        "name": "  Updated Researcher  ",
        "role": "Lead Analyst",
        "goal": "Provide concise updates",
        "backstory": "You focus on clarity and actionability.",
    }

    response = client.put("/api/agents/0", json=update_payload)

    assert response.status_code == 200
    agents = response.json()
    trimmed_payload = {key: value.strip() for key, value in update_payload.items()}
    updated_agent = next(agent for agent in agents if agent["name"] == trimmed_payload["name"])
    assert updated_agent["source"] == "user"
    assert updated_agent["userIndex"] == 0

    saved = json.loads(main_module.crew_manager.agent_library_path.read_text(encoding="utf-8"))
    assert saved == [trimmed_payload]


def test_agent_library_put_handles_missing_entry(api_client):
    client, _, _ = api_client

    payload = {
        "name": "Missing Agent",
        "role": "Ghost",
        "goal": "Haunt",
        "backstory": "Spooky.",
    }

    response = client.put("/api/agents/99", json=payload)

    assert response.status_code == 404
    body = response.json()
    assert "not found" in body["detail"].lower()


def test_agent_library_put_validates_payload(api_client):
    client, main_module, _ = api_client

    valid_entry = {
        "name": "Valid Agent",
        "role": "Builder",
        "goal": "Create",
        "backstory": "Gets things done.",
    }
    main_module.crew_manager.add_agent_library_entry(valid_entry)

    response = client.put("/api/agents/0", json={"name": "Invalid"})

    assert response.status_code == 400
    payload = response.json()
    assert "cannot be empty" in payload["detail"] or "must be" in payload["detail"]


def test_agent_library_delete_removes_entry(api_client):
    client, main_module, _ = api_client

    first_entry = {
        "name": "First Agent",
        "role": "Explorer",
        "goal": "Discover",
        "backstory": "Curious by nature.",
    }
    second_entry = {
        "name": "Second Agent",
        "role": "Writer",
        "goal": "Explain",
        "backstory": "Translates insights into prose.",
    }

    main_module.crew_manager.add_agent_library_entry(first_entry)
    main_module.crew_manager.add_agent_library_entry(second_entry)

    response = client.delete("/api/agents/0")

    assert response.status_code == 200
    agents = response.json()
    user_agents = [agent for agent in agents if agent.get("source") == "user"]
    assert len(user_agents) == 1
    remaining = user_agents[0]
    assert remaining["name"] == second_entry["name"]
    assert remaining["userIndex"] == 0

    saved = json.loads(main_module.crew_manager.agent_library_path.read_text(encoding="utf-8"))
    assert saved == [second_entry]


def test_agent_library_delete_handles_missing_entry(api_client):
    client, _, _ = api_client

    response = client.delete("/api/agents/42")

    assert response.status_code == 404
    payload = response.json()
    assert "not found" in payload["detail"].lower()


def test_health_endpoint(api_client):
    client, _, _ = api_client

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert "timestamp" in payload


def test_activity_history_endpoint(api_client):
    client, main_module, _ = api_client

    main_module.activity_store.add_event("crew_started", {"crew_id": "alpha", "status": "started"})
    main_module.activity_store.add_event("crew_log", {
        "crewId": "alpha",
        "agent": "navigator",
        "message": "Scanning",
        "level": "info",
        "timestamp": "2024-05-01T12:00:00Z",
        "isDuplicate": False,
        "duplicateCount": 0,
    })
    main_module.activity_store.add_event("crew_error", {
        "crew_id": "alpha",
        "error": "boom",
        "status": "error",
    })

    response = client.get("/api/activity")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert isinstance(payload["events"], list)
    assert len(payload["events"]) == 3
    assert payload["events"][0]["type"] == "crew_started"
    assert payload["events"][0]["data"]["crew_id"] == "alpha"
    assert payload["events"][-1]["type"] == "crew_error"
    assert payload["events"][-1]["data"]["error"] == "boom"


def test_system_stats_success(api_client, monkeypatch):
    client, main_module, _ = api_client

    class FakeMemory:
        used = 2 * 1024 ** 3
        total = 4 * 1024 ** 3
        percent = 50.0
        available = 2 * 1024 ** 3

    class FakeSwap:
        used = 0
        total = 0

    monkeypatch.setattr(main_module.psutil, "cpu_percent", lambda interval=None: 12.3)
    monkeypatch.setattr(main_module.psutil, "cpu_count", lambda: 8)
    monkeypatch.setattr(main_module.psutil, "cpu_freq", lambda: types.SimpleNamespace(current=2400.0))
    monkeypatch.setattr(main_module.psutil, "virtual_memory", lambda: FakeMemory())
    monkeypatch.setattr(main_module.psutil, "swap_memory", lambda: FakeSwap())
    monkeypatch.setattr(main_module.psutil, "boot_time", lambda: 0)

    response = client.get("/api/system/stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["cpu"]["usage"] == 12.3
    assert payload["cpu"]["cores"] == 8
    assert payload["memory"]["used"] == 2.0


def test_system_stats_error(api_client, monkeypatch):
    client, main_module, _ = api_client

    def boom(interval=None):
        raise RuntimeError("stats offline")

    monkeypatch.setattr(main_module.psutil, "cpu_percent", boom)

    response = client.get("/api/system/stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["message"] == "stats offline"


def test_get_crew_template_catalog(api_client):
    client, _, _ = api_client

    response = client.get("/api/crew-templates")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert any(item["id"] == "research" for item in payload)


def test_get_specific_crew_template(api_client):
    client, _, _ = api_client

    response = client.get("/api/crew-templates/research")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "research"
    assert len(payload["agents"]) >= 1
    assert len(payload["tasks"]) >= 1
    assert payload["agentOrder"]
    assert payload["taskOrder"]


def test_get_unknown_crew_template(api_client):
    client, _, _ = api_client

    response = client.get("/api/crew-templates/not-real")

    assert response.status_code == 404


def test_create_crew_rejects_invalid_id(api_client, monkeypatch):
    client, main_module, _ = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    response = client.post(
        "/api/crews",
        json={"id": "bad id!", "agents": {}, "tasks": {}},
    )

    assert response.status_code >= 400
    payload = response.json()
    assert "Invalid crew ID" in payload["detail"]
    assert events == []


def test_create_crew_rejects_existing_directory(api_client, monkeypatch):
    client, main_module, crew_dir = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    existing_dir = crew_dir.parent / "existing_crew"
    existing_dir.mkdir()

    response = client.post(
        "/api/crews",
        json={"id": "existing-crew", "agents": {}, "tasks": {}},
    )

    assert response.status_code in {400, 409}
    payload = response.json()
    assert "already exists" in payload["detail"]
    assert events == []


def test_update_crew_endpoint_invokes_manager(api_client, monkeypatch):
    client, main_module, _ = api_client
    events = []
    recorded = {}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    def fake_update(self, crew_id, payload):
        recorded["crew_id"] = crew_id
        recorded["payload"] = payload
        return {"status": "success"}

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    monkeypatch.setattr(
        main_module.crew_manager,
        "update_crew",
        types.MethodType(fake_update, main_module.crew_manager),
    )

    payload = {"agents": {}, "tasks": {}}
    response = client.put("/api/crews/sample-crew", json=payload)

    assert response.status_code == 200
    assert recorded == {"crew_id": "sample_crew", "payload": payload}
    assert any(event[0] == "crews_updated" for event in events)
    assert response.json()["id"] == "sample_crew"


def test_delete_crew_endpoint_invokes_manager(api_client, monkeypatch):
    client, main_module, _ = api_client
    events = []
    recorded = {}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    def fake_delete(self, crew_id):
        recorded["crew_id"] = crew_id
        return {"status": "success"}

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    monkeypatch.setattr(
        main_module.crew_manager,
        "delete_crew",
        types.MethodType(fake_delete, main_module.crew_manager),
    )

    response = client.delete("/api/crews/sample-crew")

    assert response.status_code == 200
    assert recorded == {"crew_id": "sample_crew"}
    assert any(event[0] == "crews_updated" for event in events)
    assert response.json()["id"] == "sample_crew"


def test_get_crews_propagates_errors(api_client, monkeypatch):
    client, main_module, _ = api_client

    def boom(self):
        raise RuntimeError("cannot list crews")

    monkeypatch.setattr(
        main_module.crew_manager,
        "get_crews",
        types.MethodType(boom, main_module.crew_manager),
    )

    response = client.get("/api/crews")

    assert response.status_code == 500
    assert response.json()["detail"] == "cannot list crews"


def test_get_yaml_file_propagates_errors(api_client, monkeypatch):
    client, main_module, crew_dir = api_client

    def boom(self, crew_id, file_type):
        raise FileNotFoundError("missing yaml")

    monkeypatch.setattr(
        main_module.crew_manager,
        "get_yaml_content",
        types.MethodType(boom, main_module.crew_manager),
    )

    response = client.get(f"/api/crews/{crew_dir.name}/tasks")

    assert response.status_code == 404
    assert response.json()["detail"] == "missing yaml"


def test_list_env_files_propagates_errors(api_client, monkeypatch):
    client, main_module, crew_dir = api_client

    def boom(self, crew_id):
        raise RuntimeError("env missing")

    monkeypatch.setattr(
        main_module.crew_manager,
        "list_env_files",
        types.MethodType(boom, main_module.crew_manager),
    )

    response = client.get(f"/api/crews/{crew_dir.name}/env-files")

    assert response.status_code == 404
    assert response.json()["detail"] == "env missing"


@pytest.mark.asyncio
async def test_startCrew_missing_crew_id_emits_error(api_client, monkeypatch):
    _, main_module, _ = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    await main_module.startCrew("sid", {"inputs": {"topic": "ai"}})

    assert events == [("error", {"message": "Missing crew_id"}, None)]


@pytest.mark.asyncio
async def test_startCrew_success_emits_ack(api_client, monkeypatch):
    _, main_module, crew_dir = api_client
    events = []
    recorded = {}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    async def fake_start(self, crew_id, inputs, sio):
        recorded["crew_id"] = crew_id
        recorded["inputs"] = inputs
        recorded["sio"] = sio
        return "pid-321"

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )
    monkeypatch.setattr(
        main_module.crew_manager,
        "start_crew",
        types.MethodType(fake_start, main_module.crew_manager),
    )

    await main_module.startCrew("sid", {"crew_id": crew_dir.name, "inputs": {"topic": "ai"}})

    assert recorded == {
        "crew_id": crew_dir.name,
        "inputs": {"topic": "ai"},
        "sio": main_module.sio,
    }
    assert (
        "crew_start_ack",
        {"crew_id": crew_dir.name, "process_id": "pid-321", "status": "starting"},
        "sid",
    ) in events


@pytest.mark.asyncio
async def test_startCrew_error_emits_failure(api_client, monkeypatch):
    _, main_module, crew_dir = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    async def fake_start(self, crew_id, inputs, sio):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )
    monkeypatch.setattr(
        main_module.crew_manager,
        "start_crew",
        types.MethodType(fake_start, main_module.crew_manager),
    )

    await main_module.startCrew("sid", {"crew_id": crew_dir.name, "inputs": {}})

    assert ("crew_error", {"crew_id": crew_dir.name, "error": "boom", "status": "error"}, None) in events


@pytest.mark.asyncio
async def test_stopCrew_missing_crew_id_emits_error(api_client, monkeypatch):
    _, main_module, _ = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    await main_module.stopCrew("sid", {})

    assert events == [("error", {"message": "Missing crew_id"}, None)]


@pytest.mark.asyncio
async def test_stopCrew_success_emits_stopped(api_client, monkeypatch):
    _, main_module, crew_dir = api_client
    events = []
    recorded = {}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    def fake_stop(self, crew_id):
        recorded["crew_id"] = crew_id

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )
    monkeypatch.setattr(
        main_module.crew_manager,
        "stop_crew",
        types.MethodType(fake_stop, main_module.crew_manager),
    )

    await main_module.stopCrew("sid", {"crew_id": crew_dir.name})

    assert recorded == {"crew_id": crew_dir.name}
    assert ("stop_requested", {"crew_id": crew_dir.name, "status": "stopping"}, None) in events


@pytest.mark.asyncio
async def test_stopCrew_error_emits_error(api_client, monkeypatch):
    _, main_module, crew_dir = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    def fake_stop(self, crew_id):
        raise RuntimeError("cannot stop")

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )
    monkeypatch.setattr(
        main_module.crew_manager,
        "stop_crew",
        types.MethodType(fake_stop, main_module.crew_manager),
    )

    await main_module.stopCrew("sid", {"crew_id": crew_dir.name})

    assert ("error", {"message": "cannot stop"}, None) in events


@pytest.mark.asyncio
async def test_crew_log_emits_payload(api_client, monkeypatch):
    _, main_module, _ = api_client
    events = []

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )

    message = {"crew_id": "demo", "agent": "agent_a", "message": "hello"}

    await main_module.crew_log("sid", message)

    assert events == [("crew_log", message, None)]


@pytest.mark.asyncio
async def test_broadcast_system_stats_emits_periodically(api_client, monkeypatch):
    _, main_module, _ = api_client
    events = []
    sleep_calls = {"count": 0}

    async def fake_emit(self, event, payload, room=None):
        events.append((event, payload, room))

    async def fake_sleep(duration):
        sleep_calls["count"] += 1
        if sleep_calls["count"] >= 2:
            raise asyncio.CancelledError

    monkeypatch.setattr(
        main_module.sio,
        "emit",
        types.MethodType(fake_emit, main_module.sio),
    )
    monkeypatch.setattr(main_module, "collect_system_stats", lambda: {"cpu": {"usage": 1}})
    monkeypatch.setattr(main_module.asyncio, "sleep", fake_sleep)

    with pytest.raises(asyncio.CancelledError):
        await main_module.broadcast_system_stats()

    assert any(
        event == "system_stats" and payload == {"cpu": {"usage": 1}, "status": "success"}
        for event, payload, _ in events
    )
    assert sleep_calls["count"] >= 2
