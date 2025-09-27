#!/usr/bin/env python
"""
Academic Essay Humanizer main entry point
This file demonstrates the CORRECT structure for CrewAI crews to work with the control panel.
"""

import os
import sys
from typing import Dict

from academic_essay_humanizer.crew import AcademicEssayHumanizerCrew


def _load_environment_overrides() -> Dict[str, str]:
    """Return input values sourced from environment variables when available."""

    env_mappings = {
        "draft_text": os.getenv("DRAFT_TEXT"),
        "citation_style": os.getenv("CITATION_STYLE"),
    }
    return {key: value for key, value in env_mappings.items() if value is not None}


def run(**inputs):
    """
    Run the crew with user-defined inputs.
    This is the MAIN execution function - only inputs defined here will be shown in the UI.
    """
    defaults = {
        "draft_text": "Insert your draft text here.",
        "citation_style": "APA",
    }
    run_inputs = {**defaults, **_load_environment_overrides(), **inputs}
    AcademicEssayHumanizerCrew().crew().kickoff(inputs=run_inputs)


def train():
    """
    Train the crew for a given number of iterations.
    These inputs are for training only and won't appear in the main UI.
    """
    inputs = {
        'draft_text': 'training draft text',
        'citation_style': 'MLA'
    }
    try:
        AcademicEssayHumanizerCrew().crew().train(
            n_iterations=int(sys.argv[1]),
            filename=sys.argv[2],
            inputs=inputs
        )
    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")


def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        AcademicEssayHumanizerCrew().crew().replay(task_id=sys.argv[1])
    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")


def test():
    """
    Test the crew execution and returns the results.
    These inputs are for testing only and won't appear in the main UI.
    """
    inputs = {
        'draft_text': 'test draft text',
        'citation_style': 'APA'
    }
    try:
        AcademicEssayHumanizerCrew().crew().test(
            n_iterations=int(sys.argv[1]),
            openai_model_name=sys.argv[2],
            inputs=inputs
        )
    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")


def _parse_key_value_args(args):
    """Parse CLI arguments in the form key=value into a dictionary."""

    parsed = {}
    for arg in args:
        if "=" not in arg:
            raise ValueError(
                f"Unexpected argument '{arg}'. Expected key=value pairs when running the default command."
            )
        key, value = arg.split("=", 1)
        parsed[key] = value
    return parsed


if __name__ == "__main__":
    cli_args = sys.argv[1:]
    known_commands = {"run", "train", "replay", "test"}

    if not cli_args:
        run()
        sys.exit(0)

    candidate_command = cli_args[0]
    if candidate_command in known_commands:
        command = candidate_command
        remainder = cli_args[1:]
    elif "=" in candidate_command:
        command = "run"
        remainder = cli_args
    else:
        print(f"Unknown command: {candidate_command}")
        sys.exit(1)

    if command == "run":
        try:
            kwargs = _parse_key_value_args(remainder)
        except ValueError as exc:
            print(exc)
            sys.exit(1)
        run(**kwargs)
    elif command == "train":
        train()
    elif command == "replay":
        replay()
    elif command == "test":
        test()
