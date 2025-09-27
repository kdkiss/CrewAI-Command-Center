# NewsNotesWebBriefGenerator Crew

Welcome to the NewsNotesWebBriefGenerator crew project, powered by [crewAI](https://crewai.com).
This template spins up a two-agent workflow that searches the web for a given topic and distills the top
findings into a concise Markdown briefing saved to `output/brief.md`.

## Installation

Ensure you have Python >=3.10 <3.14 installed on your system. This project uses
[UV](https://docs.astral.sh/uv/) for dependency management and package handling.

First, if you haven't already, install uv:

```bash
pip install uv
```

Next, navigate to your project directory and install the dependencies:

```bash
crewai install
```

### Customizing

**Add your `OPENAI_API_KEY` into the `.env` file**

- Modify `src/news_notes_web_brief_generator/config/agents.yaml` to adjust the agents' goals or backstories.
- Modify `src/news_notes_web_brief_generator/config/tasks.yaml` to tweak the tasks or expected outputs.
- Modify `src/news_notes_web_brief_generator/crew.py` to customize the workflow, tools, or LLM settings.
- Modify `src/news_notes_web_brief_generator/main.py` to tailor the runtime inputs for your topic.

## Running the Project

To kickstart your crew of AI agents and begin task execution, run this from the root folder of your project:

```bash
$ crewai run
```

This command initializes the NewsNotesWebBriefGenerator crew, assembling the agents and assigning them tasks as defined in your
configuration.

By default, the crew will search for the topic provided through the CLI or sample input and create
`output/brief.md` with a concise set of bullet points and source links.

## Understanding Your Crew

The NewsNotesWebBriefGenerator crew is composed of two AI agents that collaborate on a sequential process.
The Researcher uses Serper search to surface recent relevant coverage, while the Note-Taker reviews the pages
and crafts the final Markdown briefing. Agent capabilities are described in `config/agents.yaml` and task
expectations are defined in `config/tasks.yaml`.

## Support

For support, questions, or feedback regarding the NewsNotesWebBriefGenerator crew or crewAI:
- Visit the [documentation](https://docs.crewai.com)
- Reach out through the [GitHub repository](https://github.com/joaomdmoura/crewai)
- [Join the Discord](https://discord.com/invite/X4JWnZnxPb)
- [Chat with the docs](https://chat.g.pt/DWjSBZn)

Let's create concise news briefings with the power and simplicity of crewAI.
