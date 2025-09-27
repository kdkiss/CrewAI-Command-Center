"""Predefined crew templates and helper utilities for the backend."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

CREW_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "research": {
        "id": "research",
        "metadata": {
            "name": "Insight Research Crew",
            "description": (
                "Two-step research workflow that collects high quality sources and "
                "turns them into an executive-ready brief."
            ),
            "icon": "🧠",
            "tags": ["analysis", "multi-agent", "knowledge"],
            "agent_order": ["Lead Researcher", "Insight Analyst"],
            "task_order": ["gather_sources", "synthesize_brief"],
        },
        "agents": [
            {
                "name": "Lead Researcher",
                "role": "Senior Trend Researcher",
                "goal": "Discover authoritative and timely information about {topic}.",
                "backstory": (
                    "You thrive on diving deep into emerging domains. Your reports combine "
                    "primary sources, vetted experts, and timely statistics to reveal new angles."
                ),
            },
            {
                "name": "Insight Analyst",
                "role": "Insight Analyst",
                "goal": "Transform research notes into a structured briefing with actionable insights.",
                "backstory": (
                    "You excel at translating dense research into clear narratives. You highlight what "
                    "matters, why it matters, and how stakeholders should respond."
                ),
            },
        ],
        "tasks": [
            {
                "name": "gather_sources",
                "description": (
                    "Collect at least eight authoritative sources covering {topic}. Focus on recency, "
                    "credibility, and diversity of perspectives. Capture key facts, statistics, and representative quotes."
                ),
                "expected_output": (
                    "A markdown table with each source, publication date, url, and two bullet highlights."
                ),
                "agent": "Lead Researcher",
            },
            {
                "name": "synthesize_brief",
                "description": (
                    "Review the gathered sources and craft a structured briefing for an executive audience. "
                    "Summarize trends, notable signals, and recommended next steps."
                ),
                "expected_output": (
                    "A five-section executive brief in markdown with context, opportunities, risks, key metrics, and recommended actions."
                ),
                "agent": "Insight Analyst",
                "dependencies": ["gather_sources"],
            },
        ],
    },
    "writing": {
        "id": "writing",
        "metadata": {
            "name": "Editorial Writing Crew",
            "description": (
                "Collaborative writing system that produces polished long-form articles with peer review."
            ),
            "icon": "✍️",
            "tags": ["content", "writing", "editorial"],
            "agent_order": ["Content Strategist", "Draft Writer", "Copy Editor"],
            "task_order": ["develop_outline", "draft_article", "editorial_review"],
        },
        "agents": [
            {
                "name": "Content Strategist",
                "role": "Content Strategist",
                "goal": "Design an outline that addresses the target audience and campaign goals.",
                "backstory": (
                    "You plan editorial strategies for brands. You define the narrative arc, supporting points, "
                    "and keywords that will resonate with the intended reader."
                ),
            },
            {
                "name": "Draft Writer",
                "role": "Senior Copywriter",
                "goal": "Write engaging long-form copy that follows the approved outline.",
                "backstory": (
                    "You have a journalist's instinct for storytelling. You write in a conversational, trustworthy tone "
                    "while weaving in supporting data."
                ),
            },
            {
                "name": "Copy Editor",
                "role": "Copy Editor",
                "goal": "Polish the draft for clarity, grammar, and brand consistency.",
                "backstory": (
                    "You ensure every publication meets style guidelines. You trim redundancy, tighten prose, and surface "
                    "opportunities for stronger transitions."
                ),
            },
        ],
        "tasks": [
            {
                "name": "develop_outline",
                "description": (
                    "Design a detailed outline for an article about {topic}. Identify the reader persona, the "
                    "core argument, and three supporting sections with bullet talking points."
                ),
                "expected_output": (
                    "Markdown outline with title, persona overview, thesis statement, and ordered section headings with bullets."
                ),
                "agent": "Content Strategist",
            },
            {
                "name": "draft_article",
                "description": (
                    "Write a 1200-1500 word article using the approved outline. Blend storytelling with practical advice "
                    "and cite credible references."
                ),
                "expected_output": (
                    "Polished markdown article including introduction, body sections aligned to the outline, conclusion, and CTA."
                ),
                "agent": "Draft Writer",
                "dependencies": ["develop_outline"],
            },
            {
                "name": "editorial_review",
                "description": (
                    "Edit the draft for clarity, tone, and grammar. Suggest improvements, ensure transitions flow, and verify facts."
                ),
                "expected_output": (
                    "Edited markdown article plus a revision summary highlighting changes and outstanding questions."
                ),
                "agent": "Copy Editor",
                "dependencies": ["draft_article"],
            },
        ],
    },
    "scraping": {
        "id": "scraping",
        "metadata": {
            "name": "Web Scraping Crew",
            "description": (
                "Automates collection of structured insights from a list of URLs with quality checks."
            ),
            "icon": "🕸️",
            "tags": ["automation", "data", "scraping"],
            "agent_order": ["Discovery Bot", "Parsing Specialist", "Quality Reviewer"],
            "task_order": ["collect_pages", "parse_content", "quality_audit"],
        },
        "agents": [
            {
                "name": "Discovery Bot",
                "role": "URL Discovery Agent",
                "goal": "Fetch HTML content for each provided URL and capture response metadata.",
                "backstory": (
                    "You specialize in respectful web scraping. You respect robots.txt, apply throttling, and note unexpected responses."
                ),
            },
            {
                "name": "Parsing Specialist",
                "role": "Content Parsing Expert",
                "goal": "Extract structured insights from the fetched HTML payloads.",
                "backstory": (
                    "You transform messy markup into clean datasets. You identify selectors, isolate key facts, and normalize values."
                ),
            },
            {
                "name": "Quality Reviewer",
                "role": "Data Quality Reviewer",
                "goal": "Validate extracted data and summarize findings for stakeholders.",
                "backstory": (
                    "You audit datasets to ensure completeness and reliability. You flag anomalies and recommend follow-up actions."
                ),
            },
        ],
        "tasks": [
            {
                "name": "collect_pages",
                "description": (
                    "Retrieve HTML for each url in {urls}. Respect crawl-delay best practices and report status codes."
                ),
                "expected_output": (
                    "JSON list where each entry includes url, status_code, content_length, and truncated html preview."
                ),
                "agent": "Discovery Bot",
            },
            {
                "name": "parse_content",
                "description": (
                    "Extract the main headline, publish date, author (if present), and two key insights from each fetched page."
                ),
                "expected_output": (
                    "JSON list aligning with input urls containing headline, summary bullets, publish_date, and author."
                ),
                "agent": "Parsing Specialist",
                "dependencies": ["collect_pages"],
            },
            {
                "name": "quality_audit",
                "description": (
                    "Review parsed data for completeness. Highlight missing fields, suspicious values, and notable insights."
                ),
                "expected_output": (
                    "Markdown report with summary statistics, anomalies, and recommended follow-up actions."
                ),
                "agent": "Quality Reviewer",
                "dependencies": ["parse_content"],
            },
        ],
    },
    "summarization": {
        "id": "summarization",
        "metadata": {
            "name": "Summarization Crew",
            "description": (
                "Generates concise multi-format summaries from verbose source material."
            ),
            "icon": "📝",
            "tags": ["summaries", "productivity"],
            "agent_order": ["Key Point Miner", "Executive Summarizer"],
            "task_order": ["extract_key_points", "compose_summary"],
        },
        "agents": [
            {
                "name": "Key Point Miner",
                "role": "Key Point Miner",
                "goal": "Identify the most impactful statements and statistics from the source material.",
                "backstory": (
                    "You digest long-form content quickly and surface the arguments, data, and quotes that carry the narrative."
                ),
            },
            {
                "name": "Executive Summarizer",
                "role": "Executive Summary Writer",
                "goal": "Produce layered summaries tailored to busy decision makers.",
                "backstory": (
                    "You convert dense notes into short, scannable summaries with optional deep dives for curious readers."
                ),
            },
        ],
        "tasks": [
            {
                "name": "extract_key_points",
                "description": (
                    "Read the provided material in {source_format} and capture all critical arguments, data points, and voices."
                ),
                "expected_output": (
                    "Bullet list of key points grouped by theme, each with supporting evidence or quotation."
                ),
                "agent": "Key Point Miner",
            },
            {
                "name": "compose_summary",
                "description": (
                    "Transform key points into layered summaries: an executive overview, paragraph summary, and bulleted highlights."
                ),
                "expected_output": (
                    "Markdown output with sections for tl;dr, one-paragraph summary, five bullet highlights, and suggested follow-ups."
                ),
                "agent": "Executive Summarizer",
                "dependencies": ["extract_key_points"],
            },
        ],
    },
}


def list_templates() -> List[Dict[str, Any]]:
    """Return catalog metadata for all available templates."""

    catalog: List[Dict[str, Any]] = []

    for template in CREW_TEMPLATES.values():
        metadata = template.get("metadata", {})
        catalog.append(
            {
                "id": template.get("id"),
                "name": metadata.get("name", template.get("id")),
                "description": metadata.get("description", ""),
                "icon": metadata.get("icon", ""),
                "tags": list(metadata.get("tags", []) or []),
                "agentCount": len(template.get("agents", []) or []),
                "taskCount": len(template.get("tasks", []) or []),
            }
        )

    return deepcopy(catalog)


def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Return a deep copy of the template definition for ``template_id`` if it exists."""

    template = CREW_TEMPLATES.get(template_id)
    if template is None:
        return None
    return deepcopy(template)


__all__ = ["CREW_TEMPLATES", "get_template", "list_templates"]
