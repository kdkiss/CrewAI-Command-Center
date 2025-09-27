#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Best-effort load .env
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

from research_driven_how_to_guide_creator.tools.notion_tools import (
    NotionCreateSummaryPageTool,
)


def pick_file(arg_path: str | None) -> Path:
    if arg_path:
        p = Path(arg_path)
        if not p.exists():
            raise SystemExit(f"File not found: {arg_path}")
        return p
    # Fallback: pick most recent .md in cwd
    md_files = [p for p in Path('.').glob('*.md') if p.is_file()]
    if not md_files:
        raise SystemExit("No .md files found in current directory. Pass a path argument.")
    md_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return md_files[0]


def main():
    if not os.getenv("NOTION_API_KEY"):
        raise SystemExit("Set NOTION_API_KEY in .env before running this script.")

    arg_path = sys.argv[1] if len(sys.argv) > 1 else None
    path = pick_file(arg_path)

    # Build simple fields from file
    text = path.read_text(encoding='utf-8', errors='ignore')
    first_lines = "\n".join(text.splitlines()[:300])
    # Very light heuristics
    title = path.name
    words = first_lines.split()
    summary = " ".join(words[:120]) if words else "Summary not available."
    kdp_desc = " ".join(words[:250]) if words else "Description not available."
    # naive keywords: take unique lowercased words >3 chars from first 400 words
    kws = []
    seen = set()
    for w in words[:400]:
        t = ''.join(ch for ch in w.lower() if ch.isalnum() or ch in ['-'])
        if len(t) > 3 and t not in seen:
            seen.add(t)
            kws.append(t)
        if len(kws) >= 15:
            break
    keywords = ", ".join(kws) if kws else "ai, guide, tutorial"

    db_name = os.getenv("NOTION_DATABASE_NAME", "Digital Products DB")

    tool = NotionCreateSummaryPageTool()
    try:
        url = tool.run(
            title=title,
            filename=path.name,
            summary=summary,
            kdp_keywords=keywords,
            kdp_description=kdp_desc,
            database_name=db_name,
        )
        print(f"Created/updated Notion page: {url}")
    except Exception as e:
        print(f"Failed to create page: {e}")
        raise


if __name__ == "__main__":
    main()

