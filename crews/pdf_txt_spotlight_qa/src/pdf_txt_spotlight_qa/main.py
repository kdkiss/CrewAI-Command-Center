#!/usr/bin/env python
import sys
from pdf_txt_spotlight_qa.crew import PdfTxtSpotlightQaCrew


def main():
    run()


def run():
    """Run the crew with default inputs."""
    inputs = {
        "pdf": "docs/paper.pdf",
        "txt": "docs/appendix.txt",
        "query": "evaluation metrics",
    }
    PdfTxtSpotlightQaCrew().crew().kickoff(inputs=inputs)


def train():
    """Train the crew for a given number of iterations."""
    inputs = {
        "pdf": "docs/paper.pdf",
        "txt": "docs/appendix.txt",
        "query": "evaluation metrics",
    }
    try:
        PdfTxtSpotlightQaCrew().crew().train(
            n_iterations=int(sys.argv[2]),
            filename=sys.argv[3],
            inputs=inputs,
        )
    except Exception as exc:
        raise Exception(f"An error occurred while training the crew: {exc}") from exc


def replay():
    """Replay the crew execution from a specific task."""
    try:
        PdfTxtSpotlightQaCrew().crew().replay(task_id=sys.argv[2])
    except Exception as exc:
        raise Exception(f"An error occurred while replaying the crew: {exc}") from exc


def test():
    """Test the crew execution and returns the results."""
    inputs = {
        "pdf": "docs/paper.pdf",
        "txt": "docs/appendix.txt",
        "query": "evaluation metrics",
    }
    try:
        PdfTxtSpotlightQaCrew().crew().test(
            n_iterations=int(sys.argv[2]),
            openai_model_name=sys.argv[3],
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
        if len(sys.argv) < 4:
            print("Usage: main.py train <iterations> <output_file>")
            sys.exit(1)
        train()
    elif command == "replay":
        if len(sys.argv) < 3:
            print("Usage: main.py replay <task_id>")
            sys.exit(1)
        replay()
    elif command == "test":
        if len(sys.argv) < 4:
            print("Usage: main.py test <iterations> <model>")
            sys.exit(1)
        test()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
