"""Static and user-defined agent definitions for the agent library."""

from __future__ import annotations

import json
import logging
import os
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterable, List

# NOTE: These definitions are intentionally lightweight. They are meant to
# provide inspiration inside the UI for how to structure agents without being
# tied to any specific crew implementation. The wording mirrors common
# multi-agent patterns (research, writing, automation, etc.) so that new users
# can quickly drop them into a crew and adapt the details.
AGENT_LIBRARY: List[Dict[str, str]] = [
    {
        "name": "Discovery Researcher",
        "role": "Market Trend Analyst",
        "goal": "Identify the most important recent developments about {topic} and surface credible sources.",
        "backstory": (
            "You are a strategic researcher who keeps a meticulous source library. "
            "You excel at separating meaningful trends from noise and summarising "
            "why a signal matters."
        ),
    },
    {
        "name": "Insight Synthesizer",
        "role": "Executive Briefing Specialist",
        "goal": "Transform raw research notes into an actionable brief that highlights risks, opportunities, and next steps.",
        "backstory": (
            "You spent years preparing briefings for leadership teams. You connect "
            "the dots between disparate inputs and express them in clear, "
            "decision-ready narratives."
        ),
    },
    {
        "name": "Story Architect",
        "role": "Content Strategist",
        "goal": "Design a compelling outline tailored to the intended audience and campaign objectives.",
        "backstory": (
            "You have directed editorial calendars for global brands. Your outlines "
            "balance narrative flow with SEO considerations and stakeholder goals."
        ),
    },
    {
        "name": "Draft Artisan",
        "role": "Senior Copywriter",
        "goal": "Write an engaging long-form draft that faithfully follows the approved outline and tone guidelines.",
        "backstory": (
            "You bring a journalist's curiosity and a marketer's polish. You weave "
            "supporting data into approachable prose that keeps readers hooked."
        ),
    },
    {
        "name": "Quality Steward",
        "role": "Content Editor",
        "goal": "Review a draft for clarity, grammar, and brand consistency while leaving specific improvement suggestions.",
        "backstory": (
            "You are the final set of eyes before publication. You remove friction, "
            "highlight inconsistencies, and make sure every deliverable feels "
            "professional and on-message."
        ),
    },
    {
        "name": "Data Scout",
        "role": "Web Scraping Specialist",
        "goal": "Fetch structured data from supplied URLs while respecting rate limits and reporting collection issues.",
        "backstory": (
            "You automate evidence gathering. You know how to navigate unreliable "
            "sites, annotate anomalies, and capture metadata that is useful for "
            "downstream processing."
        ),
    },
    {
        "name": "Pattern Parser",
        "role": "Information Extraction Analyst",
        "goal": "Convert fetched documents into structured records with the key facts analysts will care about.",
        "backstory": (
            "You are obsessed with clean datasets. You design repeatable extraction "
            "rules, validate edge cases, and annotate any assumptions that need "
            "follow-up."
        ),
    },
    {
        "name": "Insight Reviewer",
        "role": "Data Quality Lead",
        "goal": "Audit structured outputs, highlight anomalies, and summarise the findings for stakeholders.",
        "backstory": (
            "You double-check that insights are trustworthy before they reach "
            "decision makers. You flag gaps, recommend follow-up tasks, and ensure "
            "nothing important was missed."
        ),
    },
]


def list_agent_library() -> List[Dict[str, str]]:
    """Return a deep copy of the curated agent library."""

    return deepcopy(AGENT_LIBRARY)


REQUIRED_AGENT_FIELDS: Iterable[str] = ("name", "role", "goal", "backstory")
USER_AGENT_LIBRARY_FILENAME = "agent_library.json"

logger = logging.getLogger(__name__)


def sanitize_agent_entry(entry: Any) -> Dict[str, str]:
    """Validate and normalize a user-supplied agent entry."""

    if not isinstance(entry, dict):
        raise ValueError("Agent entry must be an object")

    sanitized: Dict[str, str] = {}
    for field in REQUIRED_AGENT_FIELDS:
        value = entry.get(field)
        if not isinstance(value, str):
            raise ValueError(f"Agent '{field}' must be a string")

        normalized = value.strip()
        if not normalized:
            raise ValueError(f"Agent '{field}' cannot be empty")

        sanitized[field] = normalized

    return sanitized


def load_user_agent_library(path: Path) -> List[Dict[str, str]]:
    """Load user-defined agents from disk."""

    if not path.exists():
        return []

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid agent library file: {exc}") from exc

    if raw is None:
        return []

    if not isinstance(raw, list):
        raise ValueError("Agent library file must contain a list of entries")

    sanitized_entries: List[Dict[str, str]] = []
    for entry in raw:
        try:
            sanitized_entries.append(sanitize_agent_entry(entry))
        except ValueError as exc:
            logger.warning("Skipping invalid agent entry in library file: %s", exc)

    return sanitized_entries


def save_user_agent_library(path: Path, entries: Iterable[Dict[str, str]]) -> None:
    """Persist user-defined agent entries to disk."""

    path.parent.mkdir(parents=True, exist_ok=True)

    sanitized = [sanitize_agent_entry(entry) for entry in entries]
    payload = json.dumps(sanitized, indent=2, ensure_ascii=False)

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=str(path.parent),
            delete=False,
        ) as handle:
            handle.write(f"{payload}\n")
            tmp_path = Path(handle.name)

        os.replace(tmp_path, path)
    except Exception:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:  # pragma: no cover - best effort cleanup
                pass
        raise


__all__ = [
    "AGENT_LIBRARY",
    "REQUIRED_AGENT_FIELDS",
    "USER_AGENT_LIBRARY_FILENAME",
    "list_agent_library",
    "load_user_agent_library",
    "save_user_agent_library",
    "sanitize_agent_entry",
]
