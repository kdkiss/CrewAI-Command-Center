"""Filesystem and YAML storage helpers for crew management."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

import yaml

from metadata_discovery import MetadataDiscovery


MODULE_IMPORT_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

logger = logging.getLogger(__name__)


def normalize_crew_identifier(raw_id: str) -> str:
    """Normalize a crew identifier for safe filesystem and module usage."""

    if not isinstance(raw_id, str):
        raise ValueError("Crew ID must be a string")

    candidate = raw_id.strip()
    if not candidate:
        raise ValueError("Crew ID cannot be empty")

    normalized = candidate.replace("-", "_").replace(".", "_")
    if not normalized:
        raise ValueError("Crew ID cannot be empty")

    if not (normalized[0].isalpha() or normalized[0] == "_"):
        raise ValueError(
            f"Invalid crew ID '{raw_id}'. Crew IDs must start with a letter or underscore."
        )

    if not MODULE_IMPORT_NAME.fullmatch(normalized):
        raise ValueError(
            f"Invalid crew ID '{raw_id}'. Crew IDs may only contain letters, numbers, hyphens,"
            " periods, or underscores."
        )

    return normalized


class CrewStorage:
    """Encapsulate filesystem access for crews."""

    def __init__(
        self,
        crews_folder: Path | str,
        *,
        metadata_discovery: Optional[MetadataDiscovery] = None,
    ) -> None:
        self.crews_folder = Path(crews_folder)
        self.crews_folder.mkdir(exist_ok=True)
        self.metadata_discovery = metadata_discovery or MetadataDiscovery()

    # ------------------------------------------------------------------
    # Directory discovery
    # ------------------------------------------------------------------
    def find_existing_crew_dir(self, normalized_id: str) -> Optional[Path]:
        candidate = self.crews_folder / normalized_id
        if candidate.exists() and candidate.is_dir():
            return candidate

        try:
            entries = list(self.crews_folder.iterdir())
        except FileNotFoundError:
            return None

        for entry in entries:
            if not entry.is_dir():
                continue
            try:
                if normalize_crew_identifier(entry.name) == normalized_id:
                    return entry
            except ValueError:
                continue

        return None

    def resolve_crew_dir(self, crew_id: str) -> Tuple[str, Path]:
        normalized_id = normalize_crew_identifier(crew_id)
        crew_dir = self.find_existing_crew_dir(normalized_id)
        if crew_dir is None:
            raise ValueError(f"Crew '{crew_id}' does not exist")
        return normalized_id, crew_dir

    def resolve_existing_config_dir(self, crew_id: str) -> Tuple[Path, Path, Path]:
        normalized_id, crew_dir = self.resolve_crew_dir(crew_id)

        src_dir = crew_dir / "src"
        if not src_dir.exists() or not src_dir.is_dir():
            raise ValueError(
                f"Invalid crew directory structure for {crew_id}: missing src directory"
            )

        preferred_pkg_dir = src_dir / normalized_id
        if preferred_pkg_dir.exists() and preferred_pkg_dir.is_dir():
            pkg_dir = preferred_pkg_dir
        else:
            pkg_dirs = [path for path in src_dir.iterdir() if path.is_dir()]
            if len(pkg_dirs) != 1:
                raise ValueError(
                    f"Invalid crew directory structure for {crew_id}: expected exactly one package directory in src"
                )
            pkg_dir = pkg_dirs[0]

        config_dir = pkg_dir / "config"
        return crew_dir, pkg_dir, config_dir

    # ------------------------------------------------------------------
    # Crew listing and metadata loading
    # ------------------------------------------------------------------
    def get_crews(self, running_ids: Iterable[str]) -> List[Dict[str, Any]]:
        running_set = set(running_ids)
        crews: List[Dict[str, Any]] = []

        try:
            crew_dirs = list(self.crews_folder.iterdir())
        except Exception as exc:
            logger.error("Error listing crews folder: %s", exc)
            return crews

        for crew_dir in crew_dirs:
            if not crew_dir.is_dir():
                continue

            info = self._load_crew_info(crew_dir, running_set)
            if info:
                crews.append(info)

        return crews

    def _load_crew_info(
        self, crew_dir: Path, running_ids: Iterable[str] | None = None
    ) -> Optional[Dict[str, Any]]:
        running_set = set(running_ids or [])

        src_dir = crew_dir / "src"
        if not src_dir.exists() or not src_dir.is_dir():
            return None

        pkg_dirs = [d for d in src_dir.iterdir() if d.is_dir()]
        if len(pkg_dirs) != 1:
            return None

        pkg_dir = pkg_dirs[0]
        config_dir = pkg_dir / "config"
        agents_file = config_dir / "agents.yaml"
        tasks_file = config_dir / "tasks.yaml"
        main_py = pkg_dir / "main.py"

        missing_files = []
        if not agents_file.exists():
            missing_files.append("config/agents.yaml")
        if not tasks_file.exists():
            missing_files.append("config/tasks.yaml")
        if not main_py.exists():
            missing_files.append("main.py")

        if missing_files:
            logger.warning(
                "Missing required files in %s: %s",
                crew_dir.name,
                ", ".join(missing_files),
            )
            return None

        try:
            agents_config = yaml.safe_load(agents_file.read_text()) or {}
        except Exception as exc:
            logger.warning("Failed loading agents from %s: %s", agents_file, exc)
            agents_config = {}

        agents: List[str] = []
        if isinstance(agents_config, dict):
            for agent_name, agent_config in agents_config.items():
                if isinstance(agent_config, dict):
                    required_fields = ["role", "goal", "backstory"]
                    missing_fields = [
                        field
                        for field in required_fields
                        if not agent_config.get(field)
                    ]
                    if missing_fields:
                        logger.warning(
                            "Agent '%s' missing required fields: %s",
                            agent_name,
                            ", ".join(missing_fields),
                        )
                agents.append(agent_name)

        try:
            tasks_config = yaml.safe_load(tasks_file.read_text()) or {}
        except Exception as exc:
            logger.warning("Failed loading tasks from %s: %s", tasks_file, exc)
            tasks_config = {}

        tasks: List[str] = []
        if isinstance(tasks_config, dict):
            for task_name, task_config in tasks_config.items():
                if isinstance(task_config, dict):
                    required_fields = ["description", "expected_output"]
                    missing_fields = [
                        field
                        for field in required_fields
                        if not task_config.get(field)
                    ]
                    if missing_fields:
                        logger.warning(
                            "Task '%s' missing required fields: %s",
                            task_name,
                            ", ".join(missing_fields),
                        )
                tasks.append(task_name)

        inputs = self.metadata_discovery.extract_inputs(main_py)

        metadata = self._load_metadata(config_dir, crew_dir.name, agents, tasks)
        ordered_agents = self._ensure_order(metadata["agent_order"], agents)
        ordered_tasks = self._ensure_order(metadata["task_order"], tasks)

        status = "running" if crew_dir.name in running_set else "ready"

        return {
            "id": crew_dir.name,
            "name": metadata["name"],
            "description": metadata["description"],
            "icon": metadata.get("icon"),
            "status": status,
            "agents": ordered_agents,
            "tasks": ordered_tasks,
            "agent_order": metadata["agent_order"],
            "task_order": metadata["task_order"],
            "inputs": inputs,
        }

    def load_crew(
        self, crew_id: str, running_ids: Iterable[str]
    ) -> Optional[Dict[str, Any]]:
        normalized_id, crew_dir = self.resolve_crew_dir(crew_id)
        info = self._load_crew_info(crew_dir, running_ids)
        if info:
            info["id"] = normalized_id
        return info

    def _ensure_order(self, preferred: Iterable[str], available: Iterable[str]) -> List[str]:
        preferred_list = [name for name in preferred if name in available]
        for name in available:
            if name not in preferred_list:
                preferred_list.append(name)
        return preferred_list

    def _metadata_defaults(
        self,
        crew_id: str,
        agents: List[str],
        tasks: List[str],
    ) -> Dict[str, Any]:
        return {
            "name": crew_id,
            "description": "",
            "icon": "",
            "agent_order": list(agents),
            "task_order": list(tasks),
        }

    def _metadata_path(self, config_dir: Path) -> Path:
        return config_dir / "crew.json"

    def _normalize_order(self, raw_order: Any, available: List[str]) -> List[str]:
        normalized: List[str] = []
        available_set = set(available)

        if isinstance(raw_order, str):
            candidate_iterable = [raw_order]
        elif isinstance(raw_order, (list, tuple)):
            candidate_iterable = list(raw_order)
        else:
            candidate_iterable = []

        for candidate in candidate_iterable:
            if not isinstance(candidate, str):
                continue
            name = candidate.strip()
            if not name or name not in available_set:
                continue
            if name not in normalized:
                normalized.append(name)

        for name in available:
            if name not in normalized:
                normalized.append(name)

        return normalized

    def _load_metadata(
        self,
        config_dir: Path,
        crew_id: str,
        agents: List[str],
        tasks: List[str],
    ) -> Dict[str, Any]:
        metadata_path = self._metadata_path(config_dir)
        defaults = self._metadata_defaults(crew_id, agents, tasks)

        if not metadata_path.exists():
            return defaults

        try:
            data = json.loads(metadata_path.read_text()) or {}
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON in metadata file %s: %s", metadata_path, exc)
            return defaults
        except Exception as exc:
            logger.warning("Could not read metadata file %s: %s", metadata_path, exc)
            return defaults

        if not isinstance(data, dict):
            logger.warning("Metadata in %s is not a dictionary", metadata_path)
            return defaults

        metadata: Dict[str, Any] = {}
        metadata["name"] = str(data.get("name") or crew_id)
        metadata["description"] = str(data.get("description") or "")
        icon_value = data.get("icon", "")
        if icon_value is None:
            icon_value = ""
        metadata["icon"] = str(icon_value)

        agent_order_value = data.get("agent_order")
        if agent_order_value is None and "agentOrder" in data:
            agent_order_value = data["agentOrder"]
        metadata["agent_order"] = self._normalize_order(agent_order_value, agents)

        task_order_value = data.get("task_order")
        if task_order_value is None and "taskOrder" in data:
            task_order_value = data["taskOrder"]
        metadata["task_order"] = self._normalize_order(task_order_value, tasks)

        return metadata

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------
    def validate_and_normalize_agents(
        self,
        agents: Any,
        *,
        allow_missing: bool = False,
    ) -> Tuple[Optional[Dict[str, Dict[str, Any]]], List[str]]:
        if agents is None:
            if allow_missing:
                return None, []
            raise ValueError("Invalid configuration: 'agents' must be provided")

        if isinstance(agents, dict):
            items = list(agents.items())
        elif isinstance(agents, list):
            items = []
            for entry in agents:
                if not isinstance(entry, dict):
                    raise ValueError("Each agent definition must be an object")
                name = entry.get("name")
                items.append((name, entry))
        else:
            raise ValueError("Invalid configuration: 'agents' must be a dictionary or list")

        normalized: Dict[str, Dict[str, Any]] = {}
        order: List[str] = []

        for key, value in items:
            if not isinstance(value, dict):
                raise ValueError("Each agent definition must be an object")

            name = str(value.get("name") or (key if key is not None else "")).strip()
            if not name:
                raise ValueError("Each agent must include a non-empty name")

            if name in normalized:
                raise ValueError(f"Duplicate agent name '{name}' in configuration")

            normalized_value = {**value, "name": name}
            required_fields = ["name", "role", "goal", "backstory"]
            missing = [field for field in required_fields if not normalized_value.get(field)]
            if missing:
                raise ValueError(
                    f"Agent '{name}' missing required fields: {', '.join(missing)}"
                )

            normalized[name] = normalized_value
            order.append(name)

        return normalized, order

    def validate_and_normalize_tasks(
        self,
        tasks: Any,
        *,
        allow_missing: bool = False,
    ) -> Tuple[Optional[Dict[str, Dict[str, Any]]], List[str]]:
        if tasks is None:
            if allow_missing:
                return None, []
            raise ValueError("Invalid configuration: 'tasks' must be provided")

        if isinstance(tasks, dict):
            items = list(tasks.items())
        elif isinstance(tasks, list):
            items = []
            for entry in tasks:
                if not isinstance(entry, dict):
                    raise ValueError("Each task definition must be an object")
                name = entry.get("name")
                items.append((name, entry))
        else:
            raise ValueError("Invalid configuration: 'tasks' must be a dictionary or list")

        normalized: Dict[str, Dict[str, Any]] = {}
        order: List[str] = []

        for key, value in items:
            if not isinstance(value, dict):
                raise ValueError("Each task definition must be an object")

            name = str(value.get("name") or (key if key is not None else "")).strip()
            if not name:
                raise ValueError("Each task must include a non-empty name")

            if name in normalized:
                raise ValueError(f"Duplicate task name '{name}' in configuration")

            normalized_value = {**value, "name": name}
            required_fields = ["name", "description", "expected_output"]
            missing = [field for field in required_fields if not normalized_value.get(field)]
            if missing:
                raise ValueError(
                    f"Task '{name}' missing required fields: {', '.join(missing)}"
                )

            normalized[name] = normalized_value
            order.append(name)

        return normalized, order

    def normalize_metadata(
        self,
        crew_id: str,
        metadata_source: Dict[str, Any],
        agent_names: List[str],
        task_names: List[str],
    ) -> Dict[str, Any]:
        metadata = {
            "name": metadata_source.get("name", crew_id),
            "description": metadata_source.get("description", ""),
            "icon": metadata_source.get("icon", ""),
        }

        agent_order_raw = metadata_source.get("agent_order")
        if agent_order_raw is None:
            agent_order_raw = metadata_source.get("agentOrder")
        metadata["agent_order"] = self._normalize_order(agent_order_raw, agent_names)

        task_order_raw = metadata_source.get("task_order")
        if task_order_raw is None:
            task_order_raw = metadata_source.get("taskOrder")
        metadata["task_order"] = self._normalize_order(task_order_raw, task_names)

        return metadata

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _atomic_write(self, file_path: Path, content: str) -> None:
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=file_path.parent, delete=False
            ) as temp_file:
                temp_path = Path(temp_file.name)
                temp_file.write(content)
                temp_file.flush()
                os.fsync(temp_file.fileno())

            shutil.move(str(temp_path), str(file_path))
        except Exception as exc:
            logger.error("Error during atomic write to %s: %s", file_path, exc)
            if "temp_path" in locals() and temp_path.exists():
                temp_path.unlink()
            raise

    def _atomic_write_json(self, file_path: Path, payload: Dict[str, Any]) -> None:
        content = json.dumps(payload, indent=2, ensure_ascii=False)
        if not content.endswith("\n"):
            content = f"{content}\n"
        self._atomic_write(file_path, content)

    def _write_agents_yaml(
        self,
        config_dir: Path,
        agents: Optional[Dict[str, Dict[str, Any]]],
        order: List[str],
    ) -> None:
        ordered_agents: Dict[str, Dict[str, Any]] = {}
        if agents:
            for name in order:
                if name not in agents:
                    continue
                ordered_agents[name] = dict(agents[name])

        yaml_content = yaml.dump(
            ordered_agents,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )
        self._atomic_write(config_dir / "agents.yaml", yaml_content)

    def _write_tasks_yaml(
        self,
        config_dir: Path,
        tasks: Optional[Dict[str, Dict[str, Any]]],
        order: List[str],
    ) -> None:
        ordered_tasks: Dict[str, Dict[str, Any]] = {}
        if tasks:
            for name in order:
                if name not in tasks:
                    continue
                ordered_tasks[name] = {
                    key: value for key, value in tasks[name].items() if key != "name"
                }

        yaml_content = yaml.dump(
            ordered_tasks,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )
        self._atomic_write(config_dir / "tasks.yaml", yaml_content)

    # ------------------------------------------------------------------
    # Environment file helpers
    # ------------------------------------------------------------------
    def list_env_files(self, crew_id: str) -> List[str]:
        normalized_id, crew_dir = self.resolve_crew_dir(crew_id)
        ignore_dirs = {".venv", "node_modules", "__pycache__"}
        env_files: List[str] = []

        for root, dirs, files in os.walk(crew_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file_name in files:
                if not self._is_env_filename(file_name):
                    continue
                full_path = Path(root) / file_name
                relative_path = full_path.relative_to(crew_dir).as_posix()
                env_files.append(relative_path)

        return sorted(env_files)

    def get_env_content(self, crew_id: str, env_name: str) -> str:
        normalized_id, crew_dir = self.resolve_crew_dir(crew_id)
        env_path = (crew_dir / env_name).resolve()
        crew_root = crew_dir.resolve()
        if crew_root not in env_path.parents:
            raise ValueError("Invalid environment file path")

        if not env_path.exists() or not env_path.is_file():
            return ""

        try:
            return env_path.read_text(encoding="utf-8")
        except Exception as exc:
            raise Exception(f"Error reading {env_name} for crew {normalized_id}: {exc}")

    def save_env_content(
        self,
        crew_id: str,
        env_name: str,
        content: str,
        *,
        atomic_writer: Optional[Callable[[Path, str], None]] = None,
    ) -> None:
        normalized_id, crew_dir = self.resolve_crew_dir(crew_id)
        env_path = (crew_dir / env_name).resolve()
        crew_root = crew_dir.resolve()
        if crew_root not in env_path.parents:
            raise ValueError("Invalid environment file path")

        env_path.parent.mkdir(parents=True, exist_ok=True)
        self._validate_env_content(content)
        writer = atomic_writer or self._atomic_write
        writer(env_path, content)
        logger.info("Saved environment file '%s' for crew '%s'", env_name, normalized_id)

    @staticmethod
    def _is_env_filename(file_name: str) -> bool:
        if not file_name:
            return False
        if file_name == ".env":
            return True
        if file_name.startswith(".env.") and not file_name.endswith(
            (".example", ".template", ".sample", ".dist")
        ):
            return True
        return False

    @staticmethod
    def _validate_env_content(content: str) -> None:
        invalid_lines: List[int] = []
        for index, raw_line in enumerate(content.splitlines(), start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower().startswith("export "):
                line = line[7:].lstrip()
            if "=" not in line:
                invalid_lines.append(index)
                continue
            key, _ = line.split("=", 1)
            key = key.strip()
            if not key or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
                invalid_lines.append(index)

        if invalid_lines:
            formatted = ", ".join(str(num) for num in invalid_lines)
            raise ValueError(
                f"Invalid environment variable declaration on line(s): {formatted}"
            )

    # ------------------------------------------------------------------
    # Crew creation/update helpers
    # ------------------------------------------------------------------
    def _run_crewai_cli(self, normalized_id: str) -> None:
        commands = [
            ["crewai", "create", "crew", normalized_id],
            [sys.executable or "python", "-m", "crewai", "create", "crew", normalized_id],
        ]

        last_exc: Optional[BaseException] = None

        for command in commands:
            try:
                result = subprocess.run(
                    command,
                    cwd=self.crews_folder,
                    check=True,
                    capture_output=True,
                    text=True,
                )
            except FileNotFoundError as exc:
                last_exc = exc
                logger.debug("CrewAI CLI command not found: %s", command[0])
                continue
            except subprocess.CalledProcessError as exc:
                stderr_output = (exc.stderr or "").strip()
                if stderr_output:
                    logger.error(
                        "CrewAI CLI command '%s' failed with error: %s",
                        " ".join(command),
                        stderr_output,
                    )
                else:
                    logger.error(
                        "CrewAI CLI command '%s' failed with return code %s",
                        " ".join(command),
                        exc.returncode,
                    )
                raise RuntimeError(
                    f"CrewAI CLI failed to create crew '{normalized_id}'"
                ) from exc
            else:
                stderr_output = (result.stderr or "").strip()
                if stderr_output:
                    logger.debug(
                        "CrewAI CLI stderr for '%s': %s",
                        normalized_id,
                        stderr_output,
                    )
                return

        raise RuntimeError(
            f"CrewAI CLI is not available to create crew '{normalized_id}'"
        ) from last_exc

    def _prepare_new_crew_directory(self, normalized_id: str) -> Path:
        crew_dir = self.crews_folder / normalized_id
        if not crew_dir.exists():
            self._run_crewai_cli(normalized_id)

        located_dir = self.find_existing_crew_dir(normalized_id)
        if located_dir is None:
            raise RuntimeError(
                f"CrewAI CLI did not create an accessible directory for crew '{normalized_id}'"
            )

        if located_dir.name != normalized_id:
            normalized_dir = self.crews_folder / normalized_id
            located_dir.rename(normalized_dir)
            located_dir = normalized_dir

        src_dir = located_dir / "src"
        src_dir.mkdir(parents=True, exist_ok=True)

        pkg_dir = src_dir / normalized_id
        if not pkg_dir.exists():
            candidate_dir: Optional[Path] = None
            for child in src_dir.iterdir():
                if not child.is_dir():
                    continue
                try:
                    if normalize_crew_identifier(child.name) == normalized_id:
                        candidate_dir = child
                        break
                except ValueError:
                    continue

            if candidate_dir is not None and candidate_dir != pkg_dir:
                candidate_dir.rename(pkg_dir)
            else:
                pkg_dir.mkdir(parents=True, exist_ok=True)

        return located_dir

    def _generate_main_py_content(self, crew_id: str) -> str:
        module_name = normalize_crew_identifier(crew_id)
        class_name = "".join(word.capitalize() for word in module_name.split("_"))
        if not class_name.endswith("Crew"):
            class_name += "Crew"

        content = f'''#!/usr/bin/env python3
"""
{crew_id} Crew - Auto-generated main entry point
"""

import os
import sys
from pathlib import Path

print("DEBUG: main.py started", file=sys.stderr)

sys.path.insert(0, str(Path(__file__).parent.parent))

print(f"DEBUG: sys.path: {{sys.path}}", file=sys.stderr)

try:
    from {module_name}.crew import {class_name}
except ImportError as exc:
    print(f"ERROR: Failed to import crew components: {{exc}}", file=sys.stderr)
    sys.exit(1)


def run(**inputs):
    """Entry point for running the {class_name}."""
    try:
        crew = {class_name}().crew()
        result = crew.kickoff(inputs=inputs)
        print(f"Crew '{crew_id}' completed successfully")
        print(f"Result: {{result}}")
    except Exception as exc:
        error_msg = f"Error running {crew_id} crew: {{exc}}"
        print(error_msg, file=sys.stderr)
        raise Exception(error_msg) from exc


if __name__ == "__main__":
    try:
        import argparse

        parser = argparse.ArgumentParser(description=f"Run the {crew_id} crew")
        parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
        args, unknown = parser.parse_known_args()

        inputs = {{}}
        for arg in unknown:
            if "=" in arg:
                key, value = arg.split("=", 1)
                inputs[key] = value

        run(**inputs)
    except Exception as exc:
        print(f"ERROR: Unhandled exception in main execution block: {{exc}}", file=sys.stderr)
        sys.exit(1)
'''

        return textwrap.dedent(content)

    # ------------------------------------------------------------------
    # Public APIs for create/update/delete
    # ------------------------------------------------------------------
    def create_crew(self, crew_id: str, config: Dict[str, Any]) -> Dict[str, str]:
        normalized_id = normalize_crew_identifier(crew_id)
        if self.find_existing_crew_dir(normalized_id):
            raise ValueError(f"Crew '{normalized_id}' already exists")

        agents_config, agent_names = self.validate_and_normalize_agents(
            config.get("agents")
        )
        tasks_config, task_names = self.validate_and_normalize_tasks(config.get("tasks"))

        metadata_source: Dict[str, Any] = {}
        if isinstance(config, dict):
            for key in (
                "name",
                "description",
                "icon",
                "agent_order",
                "agentOrder",
                "task_order",
                "taskOrder",
            ):
                if key in config:
                    metadata_source[key] = config[key]

        provided_metadata = config.get("metadata") if isinstance(config, dict) else None
        if isinstance(provided_metadata, dict):
            metadata_source.update(provided_metadata)

        metadata = self.normalize_metadata(
            normalized_id, metadata_source, agent_names, task_names
        )

        crew_dir = self._prepare_new_crew_directory(normalized_id)
        src_dir = crew_dir / "src"
        pkg_dir = src_dir / normalized_id
        config_dir = pkg_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)

        main_py_file = pkg_dir / "main.py"
        if not main_py_file.exists():
            main_py_content = self._generate_main_py_content(normalized_id)
            self._atomic_write(main_py_file, main_py_content)

        self._write_agents_yaml(config_dir, agents_config, metadata["agent_order"])
        self._write_tasks_yaml(config_dir, tasks_config, metadata["task_order"])
        self._atomic_write_json(self._metadata_path(config_dir), metadata)

        logger.info(
            "Successfully created crew '%s' with %d agents and %d tasks",
            normalized_id,
            len(agents_config or {}),
            len(tasks_config or {}),
        )
        return {"status": "success", "message": f"Crew {normalized_id} created successfully"}

    def update_crew(self, crew_id: str, config: Dict[str, Any]) -> Dict[str, str]:
        normalized_id = normalize_crew_identifier(crew_id)

        agents_config, agent_names = self.validate_and_normalize_agents(
            config.get("agents")
        )
        tasks_config, task_names = self.validate_and_normalize_tasks(config.get("tasks"))

        metadata_source: Dict[str, Any] = {}
        if isinstance(config, dict):
            for key in (
                "name",
                "description",
                "icon",
                "agent_order",
                "agentOrder",
                "task_order",
                "taskOrder",
            ):
                if key in config:
                    metadata_source[key] = config[key]

        provided_metadata = config.get("metadata") if isinstance(config, dict) else None
        if isinstance(provided_metadata, dict):
            metadata_source.update(provided_metadata)

        metadata = self.normalize_metadata(
            normalized_id, metadata_source, agent_names, task_names
        )

        _, _, config_dir = self.resolve_existing_config_dir(normalized_id)
        config_dir.mkdir(parents=True, exist_ok=True)

        self._write_agents_yaml(config_dir, agents_config, metadata["agent_order"])
        self._write_tasks_yaml(config_dir, tasks_config, metadata["task_order"])
        self._atomic_write_json(self._metadata_path(config_dir), metadata)

        logger.info(
            "Updated crew '%s' with %d agents and %d tasks",
            normalized_id,
            len(agents_config or {}),
            len(tasks_config or {}),
        )
        return {"status": "success", "message": f"Crew {normalized_id} updated successfully"}

    def delete_crew(self, crew_id: str) -> Dict[str, str]:
        normalized_id = normalize_crew_identifier(crew_id)
        _, crew_dir = self.resolve_crew_dir(normalized_id)
        shutil.rmtree(crew_dir)
        logger.info("Deleted crew '%s'", normalized_id)
        return {"status": "success", "message": f"Crew {normalized_id} deleted successfully"}

    # ------------------------------------------------------------------
    # YAML helpers exposed for API endpoints
    # ------------------------------------------------------------------
    def get_yaml_content(self, crew_id: str, file_type: str) -> str:
        _, _, config_dir = self.resolve_existing_config_dir(crew_id)
        normalized_id = normalize_crew_identifier(crew_id)
        yaml_file = config_dir / f"{file_type}.yaml"
        if not yaml_file.exists():
            return ""
        try:
            return yaml_file.read_text(encoding="utf-8")
        except Exception as exc:
            raise Exception(
                f"Error reading {file_type}.yaml for crew {normalized_id}: {exc}"
            )

    def save_yaml_content(
        self,
        crew_id: str,
        file_type: str,
        content: str,
        *,
        atomic_writer: Optional[Callable[[Path, str], None]] = None,
    ) -> None:
        _, _, config_dir = self.resolve_existing_config_dir(crew_id)
        normalized_id = normalize_crew_identifier(crew_id)
        yaml_file = config_dir / f"{file_type}.yaml"
        config_dir.mkdir(parents=True, exist_ok=True)
        if content.strip():
            try:
                yaml.safe_load(content)
            except yaml.YAMLError as exc:
                raise ValueError(
                    f"Invalid YAML syntax in {file_type}.yaml for crew {normalized_id}: {exc}"
                )
        writer = atomic_writer or self._atomic_write
        writer(yaml_file, content)

