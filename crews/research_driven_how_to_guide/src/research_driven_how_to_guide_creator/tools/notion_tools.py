import os
import requests
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from crewai.tools import BaseTool


NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = os.getenv("NOTION_VERSION", "2022-06-28")


class _NotionCreateSummaryArgs(BaseModel):
    title: str = Field(..., description="Title to use for the Notion page")
    filename: Optional[str] = Field(
        default=None, description="Saved filename (e.g., my-guide.md) to record and prefer as title"
    )
    summary: str = Field(..., description="80–120 word summary of the guide")
    # Deprecated in current flow: we no longer upload keywords/description to Notion
    kdp_keywords: Union[str, List[str]] | None = Field(
        default=None, description="Deprecated: no longer uploaded to Notion"
    )
    kdp_description: Optional[str] = Field(
        default=None, description="Deprecated: no longer uploaded to Notion"
    )
    database_name: Optional[str] = Field(
        default="Digital Products DB",
        description="Target Notion database name to search for",
    )


class NotionCreateSummaryPageTool(BaseTool):
    name: str = "notion_create_summary_page"
    description: str = (
        "Create a concise summary page in a Notion database. "
        "Searches for the database by name (default 'Digital Products DB'), "
        "ensures needed properties exist (Summary, Keywords, KDP Description), "
        "creates the page, and returns the Notion page URL. Requires NOTION_API_KEY."
    )
    args_schema: type[BaseModel] = _NotionCreateSummaryArgs

    def _headers(self, token: str):
        return {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    def _search_database(self, token: str, name: str) -> Optional[dict]:
        url = f"{NOTION_API_BASE}/search"
        payload = {
            "query": name,
            "filter": {"property": "object", "value": "database"},
        }
        r = requests.post(url, headers=self._headers(token), json=payload, timeout=30)
        try:
            r.raise_for_status()
        except requests.HTTPError:
            raise RuntimeError(f"Notion search failed: {r.status_code} {r.text}")
        data = r.json()
        q = name.strip().lower()
        exact_match = None
        contains_matches = []
        for res in data.get("results", []):
            title_arr = res.get("title", [])
            title_text = "".join([t.get("plain_text", "") for t in title_arr])
            norm = title_text.strip().lower()
            if norm == q:
                exact_match = res
                break
            if q and q in norm:
                contains_matches.append(res)
        if exact_match is not None:
            return exact_match
        # Safe fallback: if there's exactly one partial match, use it; else None
        if len(contains_matches) == 1:
            return contains_matches[0]
        return None

    def _retrieve_database(self, token: str, database_id: str) -> Optional[dict]:
        url = f"{NOTION_API_BASE}/databases/{database_id}"
        r = requests.get(url, headers=self._headers(token), timeout=30)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 404:
            return None
        raise RuntimeError(f"Failed to retrieve database {database_id}: {r.status_code} {r.text}")

    def _get_title_property_name(self, database: dict) -> str:
        properties: dict = database.get("properties", {})
        for prop_name, prop in properties.items():
            if prop.get("type") == "title":
                return prop_name
        # Default Notion title property name
        return "Name"

    def _get_existing_property_names(self, database: dict) -> set[str]:
        props = database.get("properties", {})
        return set(props.keys())

    def _ensure_properties(self, token: str, database_id: str, database: dict):
        # Ensure rich_text properties exist: Summary, Filename
        props = database.get("properties", {})
        missing = {}
        for prop_name in ["Summary", "Filename"]:
            if prop_name not in props:
                missing[prop_name] = {"rich_text": {}}
        if not missing:
            return
        # Try to patch database to add missing properties. Ignore failures.
        url = f"{NOTION_API_BASE}/databases/{database_id}"
        payload = {"properties": missing}
        try:
            r = requests.patch(url, headers=self._headers(token), json=payload, timeout=30)
            # Don't raise; lack of permission should still allow page creation with body fallback
            if r.status_code >= 400:
                # Best-effort logging via exception message; continue anyway
                raise RuntimeError(f"Failed to add DB properties: {r.status_code} {r.text}")
        except Exception:
            # Swallow to allow body-only fallback
            return

    def _create_page(
        self,
        token: str,
        database_id: str,
        title_prop: str,
        title: str,
        filename: Optional[str],
        summary: str,
        existing_props: set[str],
    ) -> dict:
        url = f"{NOTION_API_BASE}/pages"
        properties = {
            title_prop: {"title": [{"type": "text", "text": {"content": title[:200]}}]},
        }
        # Only include DB properties that actually exist to avoid 400s
        if "Summary" in existing_props:
            properties["Summary"] = {"rich_text": [{"type": "text", "text": {"content": summary[:2000]}}]}
        if filename and ("Filename" in existing_props):
            properties["Filename"] = {"rich_text": [{"type": "text", "text": {"content": filename[:200]}}]}
        payload = {
            "parent": {"database_id": database_id},
            "properties": properties,
            # Also add a simple body for portability
            "children": [
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Summary"}}]},
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": summary}}]},
                },
            ],
        }
        r = requests.post(url, headers=self._headers(token), json=payload, timeout=30)
        try:
            r.raise_for_status()
        except requests.HTTPError:
            raise RuntimeError(f"Failed to create Notion page: {r.status_code} {r.text}")
        return r.json()

    def _find_page_by_title(
        self, token: str, database_id: str, title_prop: str, title: str
    ) -> Optional[dict]:
        url = f"{NOTION_API_BASE}/databases/{database_id}/query"
        payload = {
            "filter": {
                "property": title_prop,
                "title": {"equals": title},
            }
        }
        r = requests.post(url, headers=self._headers(token), json=payload, timeout=30)
        if r.status_code != 200:
            return None
        data = r.json()
        results = data.get("results", [])
        return results[0] if results else None

    def _update_page_properties(
        self,
        token: str,
        page_id: str,
        summary: str,
        filename: Optional[str],
        existing_props: set[str],
    ) -> dict:
        url = f"{NOTION_API_BASE}/pages/{page_id}"
        properties = {}
        if "Summary" in existing_props:
            properties["Summary"] = {"rich_text": [{"type": "text", "text": {"content": summary[:2000]}}]}
        if filename and ("Filename" in existing_props):
            properties["Filename"] = {"rich_text": [{"type": "text", "text": {"content": filename[:200]}}]}
        payload = {"properties": properties}
        r = requests.patch(url, headers=self._headers(token), json=payload, timeout=30)
        try:
            r.raise_for_status()
        except requests.HTTPError:
            raise RuntimeError(f"Failed to update Notion page {page_id}: {r.status_code} {r.text}")
        return r.json()

    def _run(
        self,
        title: str,
        summary: str,
        kdp_keywords: Union[str, List[str]],
        kdp_description: str,
        database_name: Optional[str] = None,
    ) -> str:
        token = os.getenv("NOTION_API_KEY")
        if not token:
            raise RuntimeError(
                "NOTION_API_KEY is not set. Add it to your environment/.env to enable Notion uploads."
            )
        # Prefer explicit database ID if provided
        env_db_id = os.getenv("NOTION_DATABASE_ID")
        env_db_name = os.getenv("NOTION_DATABASE_NAME")
        db_name = env_db_name or database_name or "Digital Products DB"

        # Deprecated fields are ignored for upload; keep for compatibility
        keywords_value = ""

        # Locate database
        database: Optional[dict] = None
        if env_db_id:
            database = self._retrieve_database(token, env_db_id)
            if not database:
                raise RuntimeError(
                    "NOTION_DATABASE_ID was provided but could not be retrieved. Verify the ID and integration access."
                )
        else:
            database = self._search_database(token, db_name)
            if not database:
                raise RuntimeError(
                    f"Could not find Notion database named '{db_name}'. Set NOTION_DATABASE_ID to avoid ambiguity."
                )
        database_id = database.get("id")
        title_prop = self._get_title_property_name(database)

        # Ensure properties exist (best-effort) and refresh DB to know what's available
        self._ensure_properties(token, database_id, database)
        database = self._retrieve_database(token, database_id) or database
        existing_props = self._get_existing_property_names(database)

        # Choose final display title: prefer filename, else title
        display_title = (os.path.basename(filename) if isinstance(filename, str) else None) or title

        # Idempotency: if a page with the same title exists, update it instead of creating a new one
        existing = self._find_page_by_title(token, database_id, title_prop, display_title)
        if existing:
            page = self._update_page_properties(
                token,
                existing.get("id"),
                summary,
                filename,
                existing_props,
            )
            page_url = page.get("url") or existing.get("url")
            return page_url or f"Updated page {existing.get('id','')}"

        # Create page
        page = self._create_page(
            token,
            database_id,
            title_prop,
            display_title,
            filename,
            summary,
            existing_props,
        )
        page_url = page.get("url")
        if not page_url:
            # As a fallback, build a URL-like reference
            page_id = page.get("id", "")
            return f"Created page with id {page_id}"
        return page_url
