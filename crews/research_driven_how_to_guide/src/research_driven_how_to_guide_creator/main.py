#!/usr/bin/env python
import sys
import os
from datetime import datetime
from pathlib import Path

# Add the src directory to Python path for module discovery
sys.path.insert(0, str(Path(__file__).parent.parent))

from research_driven_how_to_guide_creator.crew import ResearchDrivenHowToGuideCreatorCrew

# Best-effort load of .env without introducing a hard dependency
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# This main file is intended to be a way for your to run your
# crew locally, so refrain from adding unnecessary logic into this file.
# Replace with inputs you want to test with, it will automatically
# interpolate any tasks and agents information

def run(**inputs):
    """Run the crew and persist the result to ``outputs/``.

    The working directory is the crew root when launched via ``run_crew``,
    so the ``outputs`` folder will be created alongside the project files.
    
    Args:
        **inputs: Input parameters for the crew execution
    """
    # Use provided inputs or fall back to environment variables
    run_inputs = {
        'niche': inputs.get('niche', os.getenv('NICHE', 'AI for Education and Learning'))
    }

    print(f"Starting crew execution with inputs: {run_inputs}")

    try:
        result = ResearchDrivenHowToGuideCreatorCrew().crew().kickoff(inputs=run_inputs)

        out_dir = Path("outputs")
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_file = out_dir / f"how_to_guide_{ts}.md"
        
        out_file.write_text(str(result), encoding="utf-8")
        print(f"Crew execution completed successfully!")
        print(f"Saved output to: {out_file}")
        
        return result
        
    except Exception as e:
        error_msg = f"Error running research_driven_how_to_guide crew: {str(e)}"
        print(error_msg, file=sys.stderr)
        raise Exception(error_msg) from e


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = {
        'niche': os.getenv('NICHE', 'sample_value')
    }
    try:
        ResearchDrivenHowToGuideCreatorCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        ResearchDrivenHowToGuideCreatorCrew().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = {
        'niche': os.getenv('NICHE', 'sample_value')
    }
    try:
        ResearchDrivenHowToGuideCreatorCrew().crew().test(n_iterations=int(sys.argv[1]), openai_model_name=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")

if __name__ == "__main__":
    try:
        # Handle both old command-style and new keyword-style execution
        if len(sys.argv) >= 2 and sys.argv[1] in ["run", "train", "replay", "test"]:
            # Old command-style execution
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
        else:
            # New keyword-style execution for crew manager
            import argparse
            parser = argparse.ArgumentParser(description="Run the research_driven_how_to_guide crew")
            parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
            args, unknown = parser.parse_known_args()
            
            # Convert unknown args to keyword arguments (key=value format)
            inputs = {}
            for arg in unknown:
                if "=" in arg:
                    key, value = arg.split("=", 1)
                    inputs[key] = value

            # Run with provided keyword arguments
            run(**inputs)
            
    except Exception as e:
        print(f"ERROR: Unhandled exception in main execution block: {e}", file=sys.stderr)
        sys.exit(1)
