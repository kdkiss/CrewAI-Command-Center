# Academic Essay Humanizer Crew

This crew rewrites AI-generated drafts into polished academic prose and applies a selected citation style such as APA or MLA.

## Structure Overview

```
academic-essay-humanizer/            # Crew directory (uses hyphens)
├── src/academic_essay_humanizer/   # Python package (uses underscores)
│   ├── main.py                     # Entry point with run/train/replay/test
│   ├── crew.py                     # Crew definition with agents and tasks
│   ├── __init__.py                 # Package marker
│   └── config/                     # Configuration directory
│       ├── agents.yaml             # Agent configurations
│       └── tasks.yaml              # Task configurations
├── pyproject.toml                  # Poetry project configuration
└── README.md                       # This file
```

## Key Features Demonstrated

1. **Draft Humanization**: converts AI drafts into natural academic writing
2. **Citation Style Enforcement**: ensures APA or MLA formatting
3. **Proper Directory Structure**: follows CrewAI best practices with correct hyphen vs underscore usage
4. **Working CrewAI Implementation**: functional crew with agents and tasks

## Usage with Control Panel

1. **Discovery**: the control panel will automatically detect this crew
2. **Input Parameters**: only `draft_text` and `citation_style` from the `run()` function are displayed
3. **Configuration Editing**: both `agents.yaml` and `tasks.yaml` are editable via the "Edit Config" button
4. **Execution**: run the crew directly from the control panel

## Important Notes

### Input Parameter Rules
- Only inputs in the `run()` function appear in the control panel UI
- Inputs in `train()` and `test()` are for internal use only
- Each input has a default value and is marked as required

### Configuration Structure
- Configuration files reside in `src/academic_essay_humanizer/config/`
- Both `agents.yaml` and `tasks.yaml` must exist for editing

### Directory Naming Convention
- Use hyphens for crew directory names: `academic-essay-humanizer`
- Use underscores for Python package names: `academic_essay_humanizer`

## Testing the Setup

1. Start the CrewAI control panel server
2. Navigate to the dashboard and locate "Academic Essay Humanizer"
3. Verify that only `draft_text` and `citation_style` inputs are shown
4. Click "Edit Config" to modify the agents and tasks
5. Run the crew to test the execution flow

## Command-line Smoke Test

You can quickly verify the CLI entry point without the control panel. The script now
defaults to `run()` and accepts `key=value` overrides while also honoring environment
variables. For example:

```bash
cd crews/academic-essay-humanizer/src/academic_essay_humanizer
export DRAFT_TEXT="My custom draft from the environment"
python main.py citation_style=MLA
```

The example above launches the crew, uses the draft text supplied through the
`DRAFT_TEXT` environment variable, and overrides the citation style via the CLI
argument. Running `python main.py` without additional arguments will use the baked-in
defaults when no overrides are supplied.

## Customization

To adapt this crew for your own needs:

1. Copy this directory
2. Update `pyproject.toml` with your crew information
3. Modify `agents.yaml` and `tasks.yaml`
4. Adjust the `run()` inputs as required
5. Customize the `crew.py` logic
6. Test with the control panel
