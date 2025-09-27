#!/usr/bin/env python
import sys
from news_notes_web_brief_generator.crew import NewsNotesWebBriefGeneratorCrew


def run():
    """Run the crew."""
    inputs = {
        "topic": "AI agents for ops",
    }
    NewsNotesWebBriefGeneratorCrew().crew().kickoff(inputs=inputs)


def train():
    """Train the crew for a given number of iterations."""
    inputs = {
        "topic": "AI agents for ops",
    }
    try:
        NewsNotesWebBriefGeneratorCrew().crew().train(
            n_iterations=int(sys.argv[1]),
            filename=sys.argv[2],
            inputs=inputs,
        )
    except Exception as exc:
        raise Exception(f"An error occurred while training the crew: {exc}") from exc


def replay():
    """Replay the crew execution from a specific task."""
    try:
        NewsNotesWebBriefGeneratorCrew().crew().replay(task_id=sys.argv[1])
    except Exception as exc:
        raise Exception(f"An error occurred while replaying the crew: {exc}") from exc


def test():
    """Test the crew execution and returns the results."""
    inputs = {
        "topic": "AI agents for ops",
    }
    try:
        NewsNotesWebBriefGeneratorCrew().crew().test(
            n_iterations=int(sys.argv[1]),
            openai_model_name=sys.argv[2],
            inputs=inputs,
        )
    except Exception as exc:
        raise Exception(f"An error occurred while testing the crew: {exc}") from exc


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: main.py <command> [<args>]")
        sys.exit(1)

    command = sys.argv[1]
    if command == "run":
        run()
    elif command == "train":
        train()
    elif command == "replay":
        replay()
    elif command == "test":
        test()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
