# Crew Optional Dependencies

The backend `requirements.txt` now contains only the packages that every deployment needs. During the cleanup we audited the bundled crews for runtime imports of `chromadb`, `pypdf`, and `tiktoken` and did not find any direct usage under `crews/`.

## Findings

| Package | Crew usage | Notes |
|---------|------------|-------|
| `chromadb` | Not referenced | No bundled crew imports or configures ChromaDB today. Add it to the specific crew's packaging metadata if you introduce a vector-store workflow. |
| `pypdf` | Indirect (via `crewai[tools]`) | The `pdf_txt_spotlight_qa` crew depends on `crewai[tools]`, which already declares the PDF tooling extras. No additional install steps are required beyond that crew's `pyproject.toml`. |
| `tiktoken` | Not referenced | None of the included crews tokenise text directly; install this package only if a crew adds explicit token counting. |

When creating or updating crews, declare any additional dependencies inside the crew's own `pyproject.toml` (or a crew-specific `requirements.txt`). This keeps the backend lean while allowing each crew to stay self-contained.

## Installation tips

- Re-run `pip install -r backend/requirements.txt` after pulling these changes so your environment drops the removed optional packages.
- When a crew needs an extra dependency, install it from that crew's directory (e.g. `uv pip install -r pyproject.toml` for the PDF/TXT crew) or document a dedicated requirements file alongside the crew.

This approach keeps optional tooling discoverable without forcing every backend install to pull large ML/vector packages that most crews do not need.
