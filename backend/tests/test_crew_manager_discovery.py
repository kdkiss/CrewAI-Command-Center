import logging
import sys
import json
import textwrap
from pathlib import Path

import pytest

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from crew_manager import CrewManager  # noqa: E402


@pytest.fixture
def crew_layouts(tmp_path: Path) -> Path:
    """Create a mix of valid and invalid crew directory layouts."""

    agents_yaml = textwrap.dedent(
        """
        agent_alpha:
          role: Researcher
          goal: Understand customer needs
          backstory: Former market analyst
        agent_beta:
          role: Researcher
          goal: Understand customer needs
        """
    ).strip()

    tasks_yaml = textwrap.dedent(
        """
        task_alpha:
          description: Compile interview notes
          expected_output: Summary document
        task_beta:
          description: Highlight key pain points
        """
    ).strip()

    main_py = textwrap.dedent(
        """
        def run(topic: str, iterations: int = 3, verbose=False):
            '''Entry point for the crew.'''
            return {
                "topic": topic,
                "iterations": iterations,
                "verbose": verbose,
            }
        """
    ).strip()

    def create_crew(crew_name: str, pkg_name: str, *, include_agents: bool = True,
                    include_tasks: bool = True, include_main: bool = True) -> None:
        pkg_dir = tmp_path / crew_name / "src" / pkg_name
        config_dir = pkg_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)

        if include_agents:
            (config_dir / "agents.yaml").write_text(agents_yaml, encoding="utf-8")
        if include_tasks:
            (config_dir / "tasks.yaml").write_text(tasks_yaml, encoding="utf-8")
        if include_main:
            (pkg_dir / "main.py").write_text(main_py, encoding="utf-8")

    create_crew("valid_crew", "valid_pkg")
    create_crew("missing_agents", "oops_pkg", include_agents=False)
    create_crew("missing_tasks", "oops_pkg", include_tasks=False)
    create_crew("missing_main", "oops_pkg", include_main=False)

    return tmp_path


def test_get_crews_filters_invalid_layouts(tmp_path: Path, crew_layouts: Path, caplog):
    caplog.set_level(logging.WARNING)

    manager = CrewManager(str(crew_layouts))
    crews = manager.get_crews()

    crew_ids = {crew["id"] for crew in crews}
    assert crew_ids == {"valid_crew"}

    valid_crew = crews[0]
    assert valid_crew["name"] == "valid_crew"
    assert valid_crew["description"] == ""
    assert valid_crew["icon"] == ""
    assert valid_crew["status"] == "ready"
    assert valid_crew["agents"] == ["agent_alpha", "agent_beta"]
    assert valid_crew["tasks"] == ["task_alpha", "task_beta"]
    assert valid_crew["agent_order"] == ["agent_alpha", "agent_beta"]
    assert valid_crew["task_order"] == ["task_alpha", "task_beta"]

    inputs = valid_crew["inputs"]
    assert {"topic", "iterations", "verbose"}.issubset(inputs)
    assert inputs["iterations"]["default"] == 3
    assert inputs["iterations"]["required"] is False
    assert "description" in inputs["verbose"]

    warning_messages = [record.getMessage() for record in caplog.records if record.levelno >= logging.WARNING]
    assert any("Agent 'agent_beta' missing required fields" in message for message in warning_messages)
    assert any("Task 'task_beta' missing required fields" in message for message in warning_messages)

    expected_missing = {
        "missing_agents": "config/agents.yaml",
        "missing_tasks": "config/tasks.yaml",
        "missing_main": "main.py",
    }
    for crew_name, missing_file in expected_missing.items():
        assert any(crew_name in message and missing_file in message for message in warning_messages)

    for crew_name in expected_missing:
        crew_dir = crew_layouts / crew_name
        assert manager._load_crew_info(crew_dir) is None


def test_get_crews_uses_metadata_overrides(crew_layouts: Path):
    config_dir = crew_layouts / "valid_crew" / "src" / "valid_pkg" / "config"
    metadata_path = config_dir / "crew.json"
    metadata_path.write_text(
        json.dumps(
            {
                "name": "Customized Crew",
                "description": "Custom description",
                "icon": "star",
                "agent_order": ["agent_beta", "agent_alpha"],
                "task_order": ["task_beta", "task_alpha"],
            }
        ),
        encoding="utf-8",
    )

    manager = CrewManager(str(crew_layouts))
    crews = manager.get_crews()
    customized = next(crew for crew in crews if crew["id"] == "valid_crew")

    assert customized["name"] == "Customized Crew"
    assert customized["description"] == "Custom description"
    assert customized["icon"] == "star"
    assert customized["agents"] == ["agent_beta", "agent_alpha"]
    assert customized["tasks"] == ["task_beta", "task_alpha"]
    assert customized["agent_order"] == ["agent_beta", "agent_alpha"]
    assert customized["task_order"] == ["task_beta", "task_alpha"]
