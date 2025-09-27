#!/usr/bin/env python
import sys
import warnings

from datetime import datetime

from example_crew.crew import ExampleCrew

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

# This main file is intended to be a way for you to run your
# crew locally, so refrain from adding unnecessary logic into this file.
# Replace with inputs you want to test with, it will automatically
# interpolate any tasks and agents information

def _default_inputs():
    return {
        "topic": "AI LLMs",
        "current_year": str(datetime.now().year),
    }


def run(**inputs):
    """
    Run the crew.
    """
    merged_inputs = {**_default_inputs(), **inputs}

    try:
        ExampleCrew().crew().kickoff(inputs=merged_inputs)
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}")


def _parse_cli_inputs(argv):
    parsed_inputs = {}
    for arg in argv:
        if "=" not in arg:
            raise ValueError(
                f"Invalid input '{arg}'. Expected format key=value."
            )
        key, value = arg.split("=", 1)
        if not key:
            raise ValueError(
                f"Invalid input '{arg}'. Key cannot be empty."
            )
        parsed_inputs[key] = value
    return parsed_inputs


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = {
        "topic": "AI LLMs",
        'current_year': str(datetime.now().year)
    }
    try:
        ExampleCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        ExampleCrew().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = {
        "topic": "AI LLMs",
        "current_year": str(datetime.now().year)
    }
    
    try:
        ExampleCrew().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")


def main():
    cli_inputs = _parse_cli_inputs(sys.argv[1:])
    run(**cli_inputs)


if __name__ == "__main__":
    main()
