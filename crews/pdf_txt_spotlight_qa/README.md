# PDF + TXT Spotlight Q&A Crew

This crew combines PDF and plain-text semantic search to answer focused questions with precise references.

## Installation

Ensure you have Python >=3.10,<3.14 and [uv](https://docs.astral.sh/uv/) available.

```bash
pip install uv
```

Then install the project dependencies from this crew directory:

```bash
uv pip install -r pyproject.toml
```

Alternatively, use the crewAI helper:

```bash
crewai install
```

## Configuration

Populate the `.env` file with your model credentials, e.g.:

```
OPENAI_API_KEY=sk-...
```

Key customization files:

- `src/pdf_txt_spotlight_qa/config/agents.yaml`
- `src/pdf_txt_spotlight_qa/config/tasks.yaml`
- `src/pdf_txt_spotlight_qa/crew.py`
- `src/pdf_txt_spotlight_qa/main.py`

## Workflow

1. The **Doc Reader** agent gathers the most relevant snippets from the provided PDF and TXT appendix using semantic search tools.
2. The **Answerer** agent synthesizes the findings into `output/answers.md`, including page or section callouts.

Default inputs (defined in `main.py`):

```json
{"pdf": "docs/paper.pdf", "txt": "docs/appendix.txt", "query": "evaluation metrics"}
```

## Run

From this crew folder (or the repository root) execute:

```bash
crewai run
```

The command kicks off the sequential crew, producing `output/answers.md` with cited insights.
