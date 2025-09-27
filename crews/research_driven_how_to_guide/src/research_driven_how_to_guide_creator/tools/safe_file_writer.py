from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Type

from pydantic import BaseModel, Field
from crewai.tools import BaseTool


class _WriteArgs(BaseModel):
    filename: str = Field(..., description="Filename to save under outputs/ (e.g., guide.md)")
    content: str = Field(..., description="Markdown content to write")
    overwrite: bool = Field(default=False, description="Overwrite if file exists")


class SafeFileWriterTool(BaseTool):
    """Writes markdown to the crew's outputs/ folder with safe naming.

    - Ensures files are saved under ./outputs
    - Adds .md extension if missing
    - If the file exists and overwrite is False, appends a numeric suffix
    """

    name: str = "Write markdown to outputs"
    description: str = (
        "Save markdown content to the project's outputs/ folder. "
        "Use a short, slug-like filename (e.g., how_to_topic.md)."
    )
    args_schema: Type[BaseModel] = _WriteArgs

    def _run(self, filename: str, content: str, overwrite: bool = False) -> str:
        # Normalize filename
        base = re.sub(r"[^A-Za-z0-9._\- ]+", "_", filename).strip()
        if not base:
            base = "output.md"
        if not base.lower().endswith(".md"):
            base = f"{base}.md"

        out_dir = Path("outputs")
        out_dir.mkdir(parents=True, exist_ok=True)
        target = out_dir / base

        if target.exists() and not overwrite:
            stem = target.stem
            suffix = target.suffix
            i = 1
            while True:
                candidate = out_dir / f"{stem}_{i}{suffix}"
                if not candidate.exists():
                    target = candidate
                    break
                i += 1

        try:
            target.write_text(content, encoding="utf-8")
            return f"Saved: {target}"
        except Exception as e:
            return f"Error: failed to save file: {e}"

