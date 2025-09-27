import pytest

from crew_manager import CrewManager


@pytest.fixture
def crew_manager(tmp_path):
    return CrewManager(str(tmp_path))


def test_get_template_catalog_returns_metadata(crew_manager):
    catalog = crew_manager.get_template_catalog()

    assert isinstance(catalog, list)
    assert any(item["id"] == "research" for item in catalog)

    research = next(item for item in catalog if item["id"] == "research")
    assert research["agentCount"] == 2
    assert research["taskCount"] == 2
    assert research["name"]

    # Mutating the returned catalog should not affect subsequent calls
    research["name"] = "mutated"
    new_catalog = crew_manager.get_template_catalog()
    refreshed = next(item for item in new_catalog if item["id"] == "research")
    assert refreshed["name"] != "mutated"


def test_render_template_hydrates_definition(crew_manager):
    template = crew_manager.render_template("research")

    assert template["id"] == "research"
    assert template["metadata"]["agent_order"] == template["agentOrder"]
    assert template["metadata"]["task_order"] == template["taskOrder"]
    assert len(template["agents"]) == 2
    assert len(template["tasks"]) == 2

    template["agents"][0]["name"] = "Changed"
    regenerated = crew_manager.render_template("research")
    assert regenerated["agents"][0]["name"] != "Changed"


def test_render_template_handles_missing_id(crew_manager):
    with pytest.raises(ValueError):
        crew_manager.render_template("unknown")


def test_render_template_rejects_empty_id(crew_manager):
    with pytest.raises(ValueError):
        crew_manager.render_template("")
