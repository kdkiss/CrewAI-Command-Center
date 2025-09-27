import os
from typing import List, Optional, Type
from datetime import datetime
from pydantic import BaseModel, Field
from crewai.tools import BaseTool


class _RecentMarkdownArgs(BaseModel):
    directory: str = Field(
        default=".", description="Directory to scan (non-recursive) for .md files"
    )
    max_results: int = Field(
        default=5, description="Maximum number of recent files to return"
    )


class RecentMarkdownFinderTool(BaseTool):
    name: str = "Find recent markdown files"
    description: str = (
        "Lists the most recently modified Markdown files in the given directory (non-recursive). "
        "Avoids heavy directory walks that can overflow the LLM context."
    )
    args_schema: Type[BaseModel] = _RecentMarkdownArgs

    def _run(self, directory: str = ".", max_results: int = 5) -> str:
        try:
            entries: List[tuple[str, float]] = []
            with os.scandir(directory) as it:
                for entry in it:
                    if not entry.is_file():
                        continue
                    if not entry.name.lower().endswith(".md"):
                        continue
                    try:
                        mtime = entry.stat().st_mtime
                        entries.append((entry.path, mtime))
                    except Exception:
                        continue
            entries.sort(key=lambda x: x[1], reverse=True)
            top = entries[: max(1, max_results)]
            lines = []
            for path, mtime in top:
                dt = datetime.fromtimestamp(mtime).isoformat()
                lines.append(f"{path} | modified: {dt}")
            if not lines:
                return "No markdown files found in directory."
            return "\n".join(lines)
        except Exception as e:
            return f"Error scanning directory: {e}"


class _FileExcerptArgs(BaseModel):
    file_path: str = Field(..., description="Path to the file to read")
    max_chars: int = Field(
        default=6000,
        description="Maximum number of characters to return from the start of the file",
    )


class ReadFileExcerptTool(BaseTool):
    name: str = "Read file excerpt"
    description: str = (
        "Reads only the first N characters of a file (default 6000) to keep prompts small. "
        "Use this instead of full file reads when summarizing."
    )
    args_schema: Type[BaseModel] = _FileExcerptArgs

    def _run(self, file_path: str, max_chars: int = 6000) -> str:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                data = f.read(max_chars)
                return data
        except FileNotFoundError:
            return f"Error: File not found at path: {file_path}"
        except PermissionError:
            return f"Error: Permission denied when trying to read file: {file_path}"
        except Exception as e:
            return f"Error: Failed to read excerpt from {file_path}. {str(e)}"
