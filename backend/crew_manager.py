"""High-level orchestration for crew management."""

from __future__ import annotations

import asyncio
import logging
import uuid

from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import find_dotenv, load_dotenv

from activity_store import ActivityStore
from agent_library import (
    USER_AGENT_LIBRARY_FILENAME,
    list_agent_library,
    load_user_agent_library,
    sanitize_agent_entry,
    save_user_agent_library,
)
from crew_broadcast import (
    CrewLogBroadcaster,
    LogDeduplicator,
    OperationTracker,
    categorize_log,
    extract_agent_name,
)
from crew_runtime import CrewRuntime
from crew_storage import CrewStorage, normalize_crew_identifier
from crew_templates import get_template, list_templates
from metadata_discovery import MetadataDiscovery


load_dotenv(find_dotenv())

logger = logging.getLogger(__name__)


class CrewManager:
    """Coordinate storage, runtime, and broadcasting collaborators."""

    def __init__(
        self,
        crews_folder: str,
        activity_store: Optional[ActivityStore] = None,
        *,
        storage: Optional[CrewStorage] = None,
        runtime: Optional[CrewRuntime] = None,
        broadcaster: Optional[CrewLogBroadcaster] = None,
        metadata_discovery: Optional[MetadataDiscovery] = None,
    ) -> None:
        self.crews_folder = Path(crews_folder)
        self.activity_store = activity_store
        self.metadata_discovery = metadata_discovery or MetadataDiscovery()

        self.storage = storage or CrewStorage(
            self.crews_folder, metadata_discovery=self.metadata_discovery
        )
        self.agent_library_path = self.crews_folder / USER_AGENT_LIBRARY_FILENAME

        self.broadcaster = broadcaster or CrewLogBroadcaster(
            activity_callback=self._record_activity_event
        )
        self.runtime = runtime or CrewRuntime(
            self.storage,
            self.broadcaster,
            activity_callback=self._record_activity_event,
        )

        self.event_loop: Optional[asyncio.AbstractEventLoop] = None
        self._schedule_cleanup()

    # ------------------------------------------------------------------
    # Compatibility shims
    # ------------------------------------------------------------------
    @property
    def running_crews(self):
        return self.runtime.running_crews

    @property
    def _cleanup_task(self):
        return self.runtime._cleanup_task

    @_cleanup_task.setter
    def _cleanup_task(self, value):
        self.runtime._cleanup_task = value

    @property
    def _cleanup_pending(self) -> bool:
        return self.runtime._cleanup_pending

    @_cleanup_pending.setter
    def _cleanup_pending(self, value: bool) -> None:
        self.runtime._cleanup_pending = value

    def _schedule_cleanup(self) -> None:
        if self._cleanup_task and not self._cleanup_task.done():
            return

        def _start_cleanup_task() -> None:
            if self._cleanup_task and not self._cleanup_task.done():
                return
            try:
                self._cleanup_task = asyncio.create_task(self._cleanup_worker())
            except Exception as exc:  # pragma: no cover
                self._cleanup_pending = True
                logger.warning("Could not schedule cleanup task: %s", exc)

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            if not self._cleanup_pending:
                logger.debug(
                    "Cleanup scheduling deferred because no running event loop is available"
                )
            self._cleanup_pending = True
            return

        self._cleanup_pending = False

        try:
            loop.call_soon(_start_cleanup_task)
        except RuntimeError as exc:
            self._cleanup_pending = True
            logger.warning("Could not schedule cleanup task immediately: %s", exc)

    async def _cleanup_worker(self) -> None:
        await self.runtime._cleanup_worker()

    # ------------------------------------------------------------------
    # Activity recording
    # ------------------------------------------------------------------
    def _record_activity_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        if not self.activity_store:
            return

        try:
            self.activity_store.add_event(event_type, payload)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.debug(
                "Failed to record %s event in activity store: %s", event_type, exc
            )

    # ------------------------------------------------------------------
    # Metadata and template helpers
    # ------------------------------------------------------------------
    def get_template_catalog(self) -> List[Dict[str, Any]]:
        return deepcopy(list_templates())

    def render_template(self, template_id: str) -> Dict[str, Any]:
        template = get_template(template_id)
        if template is None:
            raise ValueError(f"Unknown crew template '{template_id}'")

        metadata = template.get("metadata", {}) or {}
        agents = template.get("agents") or []
        tasks = template.get("tasks") or []

        agent_order = list(
            metadata.get("agent_order")
            or [agent.get("name", "") for agent in agents]
        )
        task_order = list(
            metadata.get("task_order") or [task.get("name", "") for task in tasks]
        )

        normalized_metadata = {
            "name": metadata.get("name", template.get("id")),
            "description": metadata.get("description", ""),
            "icon": metadata.get("icon", ""),
            "tags": list(metadata.get("tags", []) or []),
            "agent_order": agent_order,
            "task_order": task_order,
        }

        return {
            "id": template.get("id"),
            "name": normalized_metadata["name"],
            "description": normalized_metadata["description"],
            "icon": normalized_metadata["icon"],
            "tags": normalized_metadata["tags"],
            "agents": deepcopy(agents),
            "tasks": deepcopy(tasks),
            "agentOrder": list(agent_order),
            "taskOrder": list(task_order),
            "metadata": normalized_metadata,
        }

    # ------------------------------------------------------------------
    # Agent library helpers
    # ------------------------------------------------------------------
    def _load_user_agent_library(self) -> List[Dict[str, str]]:
        try:
            return load_user_agent_library(self.agent_library_path)
        except ValueError as exc:
            logger.warning(
                "Failed to parse user agent library from %s: %s",
                self.agent_library_path,
                exc,
            )
            return []

    def _persist_user_agent_library(self, entries: List[Dict[str, str]]) -> None:
        save_user_agent_library(self.agent_library_path, entries)

    def _build_agent_library_response(
        self, user_entries: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        curated_entries = [
            {**agent, "source": "curated"}
            for agent in list_agent_library()
        ]
        user_library = [
            {**entry, "source": "user", "userIndex": index}
            for index, entry in enumerate(user_entries)
        ]
        return curated_entries + user_library

    def get_agent_library(self) -> List[Dict[str, Any]]:
        user_defined = self._load_user_agent_library()
        return self._build_agent_library_response(user_defined)

    def add_agent_library_entry(self, entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        sanitized = sanitize_agent_entry(entry)
        user_entries = self._load_user_agent_library()
        user_entries.append(sanitized)
        self._persist_user_agent_library(user_entries)
        return self._build_agent_library_response(user_entries)

    def update_agent_library_entry(
        self, index: int, entry: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        sanitized = sanitize_agent_entry(entry)
        user_entries = self._load_user_agent_library()

        if index < 0 or index >= len(user_entries):
            raise ValueError("Agent entry not found.")

        user_entries[index] = sanitized
        self._persist_user_agent_library(user_entries)
        return self._build_agent_library_response(user_entries)

    def delete_agent_library_entry(self, index: int) -> List[Dict[str, Any]]:
        user_entries = self._load_user_agent_library()

        if index < 0 or index >= len(user_entries):
            raise ValueError("Agent entry not found.")

        user_entries.pop(index)
        self._persist_user_agent_library(user_entries)
        return self._build_agent_library_response(user_entries)

    # ------------------------------------------------------------------
    # Crew discovery and metadata
    # ------------------------------------------------------------------
    def get_crews(self) -> List[Dict[str, Any]]:
        return self.storage.get_crews(self.runtime.running_crews.keys())

    def _extract_inputs_from_main(self, main_py: Path) -> Dict[str, Dict[str, Any]]:
        original_hook = self.metadata_discovery.pattern_fallback_hook
        self.metadata_discovery.pattern_fallback_hook = self._extract_inputs_from_patterns
        try:
            return self.metadata_discovery.extract_inputs(main_py)
        finally:
            self.metadata_discovery.pattern_fallback_hook = original_hook

    def _extract_inputs_from_patterns(
        self, content: str, inputs: Dict[str, Dict[str, Any]]
    ) -> None:
        original_hook = self.metadata_discovery.pattern_fallback_hook
        self.metadata_discovery.pattern_fallback_hook = None
        try:
            self.metadata_discovery._extract_inputs_from_patterns(content, inputs)
        finally:
            self.metadata_discovery.pattern_fallback_hook = original_hook

    # ------------------------------------------------------------------
    # Runtime delegation
    # ------------------------------------------------------------------
    async def start_crew(self, crew_id: str, inputs: Dict[str, Any], sio) -> str:
        return await self.runtime.start_crew(crew_id, inputs, sio)

    async def _emit_crew_update(self, crew_id: str, sio):
        await self.runtime._emit_crew_update(crew_id, sio)

    def stop_crew(self, crew_id: str) -> None:
        self.runtime.stop_crew(crew_id)

    # ------------------------------------------------------------------
    # YAML and environment helpers
    # ------------------------------------------------------------------
    def get_yaml_content(self, crew_id: str, file_type: str) -> str:
        return self.storage.get_yaml_content(crew_id, file_type)

    def save_yaml_content(self, crew_id: str, file_type: str, content: str) -> None:
        self.storage.save_yaml_content(
            crew_id,
            file_type,
            content,
            atomic_writer=self._atomic_write,
        )

    def list_env_files(self, crew_id: str) -> List[str]:
        return self.storage.list_env_files(crew_id)

    def get_env_content(self, crew_id: str, env_name: str) -> str:
        return self.storage.get_env_content(crew_id, env_name)

    def save_env_content(self, crew_id: str, env_name: str, content: str) -> None:
        self.storage.save_env_content(
            crew_id,
            env_name,
            content,
            atomic_writer=self._atomic_write,
        )

    def _atomic_write(self, file_path: Path, content: str) -> None:
        self.storage._atomic_write(file_path, content)

    def _load_crew_info(self, crew_dir: Path):
        return self.storage._load_crew_info(
            crew_dir,
            self.runtime.running_crews.keys(),
        )

    # ------------------------------------------------------------------
    # Crew lifecycle APIs
    # ------------------------------------------------------------------
    def create_crew(self, crew_id: str, config: Dict[str, Any]) -> Dict[str, str]:
        return self.storage.create_crew(crew_id, config)

    def update_crew(self, crew_id: str, config: Dict[str, Any]) -> Dict[str, str]:
        return self.storage.update_crew(crew_id, config)

    def delete_crew(self, crew_id: str) -> Dict[str, str]:
        normalized_id = normalize_crew_identifier(crew_id)
        if normalized_id in self.runtime.running_crews:
            raise ValueError(
                f"Crew '{normalized_id}' is currently running and cannot be deleted"
            )
        return self.storage.delete_crew(normalized_id)


__all__ = [
    "CrewManager",
    "normalize_crew_identifier",
    "LogDeduplicator",
    "OperationTracker",
    "categorize_log",
    "extract_agent_name",
]

