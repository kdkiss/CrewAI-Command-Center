import yaml



def _prioritize_import_route(app):
    routes = list(app.router.routes)
    for index, route in enumerate(routes):
        if getattr(route, "path", None) == "/api/crews/import":
            # Move the import route to the front so it is matched before dynamic crew routes.
            app.router.routes.insert(0, app.router.routes.pop(index))
            break


def _build_payload(**overrides):
    payload = {
        "name": "Research Crew",
        "description": "Handles research tasks",
        "agents": [
            {
                "name": "Analyst",
                "role": "Researcher",
                "goal": "Collect market data",
                "backstory": "A dedicated researcher",
            }
        ],
        "tasks": [
            {
                "name": "Compile Report",
                "description": "Summarise findings into an actionable report",
                "expected_output": "A concise report",
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_import_crew_creates_expected_structure(api_client):
    client, _, existing_crew_dir = api_client

    _prioritize_import_route(client.app)

    response = client.post("/api/crews/import", json=_build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["message"] == "Crew 'Research Crew' imported successfully"

    crew_id = body["crew_id"]
    assert crew_id == "research_crew"
    crews_root = existing_crew_dir.parent
    created_dir = crews_root / crew_id
    package_dir = created_dir / "src" / crew_id
    config_dir = package_dir / "config"

    assert created_dir.exists(), "Crew directory should be created on disk"
    assert (package_dir / "main.py").exists(), "main entry point should be generated"
    assert config_dir.exists(), "Configuration directory should exist"

    agents_path = config_dir / "agents.yaml"
    tasks_path = config_dir / "tasks.yaml"
    assert agents_path.exists()
    assert tasks_path.exists()

    agents_yaml = yaml.safe_load(agents_path.read_text(encoding="utf-8"))
    tasks_yaml = yaml.safe_load(tasks_path.read_text(encoding="utf-8"))

    assert agents_yaml == {
        "Analyst": {
            "name": "Analyst",
            "role": "Researcher",
            "goal": "Collect market data",
            "backstory": "A dedicated researcher",
        }
    }
    assert tasks_yaml == {
        "Compile Report": {
            "description": "Summarise findings into an actionable report",
            "expected_output": "A concise report",
        }
    }


def test_import_crew_missing_agents_field_returns_400(api_client):
    client, _, _ = api_client

    _prioritize_import_route(client.app)

    payload = _build_payload()
    payload.pop("agents")

    response = client.post("/api/crews/import", json=payload)

    assert response.status_code == 400
    assert response.json() == {"detail": "Missing required field: 'agents'"}


def test_import_crew_duplicate_name_generates_unique_id(api_client):
    client, _, existing_crew_dir = api_client

    _prioritize_import_route(client.app)

    payload = _build_payload(name="Duplicate Crew")

    first = client.post("/api/crews/import", json=payload)
    assert first.status_code == 200
    first_id = first.json()["crew_id"]

    second = client.post("/api/crews/import", json=payload)
    assert second.status_code == 200
    second_body = second.json()

    second_id = second_body["crew_id"]

    assert second_id != first_id
    assert second_id == f"{first_id}_1"

    crews_root = existing_crew_dir.parent
    assert (crews_root / second_id).exists()
