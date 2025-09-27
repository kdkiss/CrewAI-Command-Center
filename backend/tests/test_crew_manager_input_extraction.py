import sys
import textwrap
from pathlib import Path

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from crew_manager import CrewManager  # noqa: E402


def create_manager(tmp_path):
    # Ensure we pass a string path to CrewManager for compatibility
    return CrewManager(str(tmp_path))


def test_extract_inputs_from_inline_dict_and_getenv(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "inline_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            import os

            def run():
                inputs = {
                    "api_key": os.getenv("API_KEY"),
                    "iterations": 5,
                    "topic": "AI Research"
                }
                return inputs
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["api_key"] == {
        "description": "Parameter: api_key",
        "type": "str",
        "default": None,
        "required": True,
    }
    assert inputs["iterations"] == {
        "description": "Parameter: iterations",
        "type": "int",
        "default": 5,
        "required": False,
    }
    assert inputs["topic"] == {
        "description": "Parameter: topic",
        "type": "str",
        "default": "AI Research",
        "required": False,
    }


def test_extract_inputs_from_signature_and_docstring(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "signature_docstring_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            def run(topic: str = "Exploration", iterations: int = 2, verbose: bool = False):
                \"\"\"
                Run crew.

                Args:
                    topic: The topic to explore.
                    iterations: Number of iterations to run.
                    verbose: Enable verbose logging.
                \"\"\"
                return topic, iterations, verbose
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["topic"] == {
        "description": "Parameter: topic",
        "type": "str",
        "default": "Exploration",
        "required": False,
    }
    assert inputs["iterations"] == {
        "description": "Parameter: iterations",
        "type": "int",
        "default": 2,
        "required": False,
    }
    assert inputs["verbose"] == {
        "description": "Parameter: verbose",
        "type": "bool",
        "default": False,
        "required": False,
    }


def test_extract_inputs_from_signature_only(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "signature_only_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            def run(topic, target_audience):
                return topic, target_audience
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["topic"] == {
        "description": "Parameter: topic",
        "type": "str",
        "default": None,
        "required": True,
    }
    assert inputs["target_audience"] == {
        "description": "Parameter: target_audience",
        "type": "str",
        "default": None,
        "required": True,
    }


def test_extract_inputs_from_pattern_fallback(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "pattern_fallback_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            import os

            inputs = {
                "topic": "Fallback topic",
                "api_key": os.getenv("API_KEY"),
            }
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["topic"] == {
        "description": "Parameter: topic",
        "type": "str",
        "default": "Fallback topic",
        "required": False,
    }
    assert inputs["api_key"] == {
        "description": "Parameter: api_key",
        "type": "str",
        "default": None,
        "required": True,
    }


def test_extract_inputs_uses_pattern_fallback_on_parse_error(tmp_path, monkeypatch):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "malformed_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            def run(:
                inputs = {
                    "iterations": 3
                }
            """
        )
    )

    pattern_calls = []
    original = manager._extract_inputs_from_patterns

    def tracking_patterns(content, inputs_dict):
        pattern_calls.append(content)
        return original(content, inputs_dict)

    monkeypatch.setattr(manager, "_extract_inputs_from_patterns", tracking_patterns)

    inputs = manager._extract_inputs_from_main(main_py)

    assert pattern_calls, "Expected pattern fallback to be invoked"
    assert inputs["iterations"] == {
        "description": "Parameter: iterations",
        "type": "int",
        "default": 3,
        "required": False,
    }


def test_extract_inputs_with_no_parameters_returns_defaults(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "no_params_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            def run():
                return "done"
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["topic"] == {
        "description": "Enter research topic",
        "type": "str",
        "default": None,
        "required": True,
    }
    assert inputs["target_audience"] == {
        "description": "Define target audience",
        "type": "str",
        "default": None,
        "required": True,
    }


def test_extract_inputs_from_helper_default_function(tmp_path):
    manager = create_manager(tmp_path)
    main_py = tmp_path / "helper_defaults_main.py"
    main_py.write_text(
        textwrap.dedent(
            """
            from datetime import datetime

            def _default_inputs():
                return {
                    "topic": "AI LLMs",
                    "current_year": str(datetime.now().year),
                }

            def run(**inputs):
                merged_inputs = {**_default_inputs(), **inputs}
                return merged_inputs
            """
        )
    )

    inputs = manager._extract_inputs_from_main(main_py)

    assert inputs["topic"] == {
        "description": "Parameter: topic",
        "type": "str",
        "default": "AI LLMs",
        "required": False,
    }
    assert inputs["current_year"] == {
        "description": "Parameter: current_year",
        "type": "str",
        "default": "str(datetime.now().year)",
        "required": False,
    }
