"""Runtime orchestration for executing crews."""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import shutil
import subprocess
import sys
from typing import Any, Callable, Dict, Optional

from crew_broadcast import CrewLogBroadcaster
from crew_storage import CrewStorage, normalize_crew_identifier


logger = logging.getLogger(__name__)


class CrewRuntime:
    """Manage crew subprocess execution and lifecycle."""

    def __init__(
        self,
        storage: CrewStorage,
        broadcaster: CrewLogBroadcaster,
        *,
        activity_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        self.storage = storage
        self.broadcaster = broadcaster
        self._activity_callback = activity_callback
        self.running_crews: Dict[str, Dict[str, Any]] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._cleanup_pending = False

    # ------------------------------------------------------------------
    # Activity helper
    # ------------------------------------------------------------------
    def _record_activity(self, event_type: str, payload: Dict[str, Any]) -> None:
        if not self._activity_callback:
            return
        try:
            self._activity_callback(event_type, payload)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.debug("Failed to record %s event: %s", event_type, exc)

    # ------------------------------------------------------------------
    # Cleanup scheduling
    # ------------------------------------------------------------------
    async def _cleanup_worker(self) -> None:
        while True:
            try:
                await asyncio.sleep(30)
                self.broadcaster.cleanup()
                logger.debug("Performed periodic cleanup of log deduplicator and operation tracker")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in cleanup task: %s", exc)
                await asyncio.sleep(60)

    def schedule_cleanup(self) -> None:
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
                logger.debug("Cleanup scheduling deferred because no running event loop is available")
            self._cleanup_pending = True
            return

        self._cleanup_pending = False

        try:
            loop.call_soon(_start_cleanup_task)
        except RuntimeError as exc:
            self._cleanup_pending = True
            logger.warning("Could not schedule cleanup task immediately: %s", exc)

    # ------------------------------------------------------------------
    # Runtime lifecycle
    # ------------------------------------------------------------------
    async def start_crew(self, crew_id: str, inputs: Dict[str, Any], sio) -> str:
        normalized_id = normalize_crew_identifier(crew_id)
        if normalized_id in self.running_crews:
            raise Exception(f"Crew {normalized_id} is already running")

        crew_dir, pkg_dir, _ = self.storage.resolve_existing_config_dir(normalized_id)
        src_dir = crew_dir / "src"
        main_py = pkg_dir / "main.py"

        if not main_py.exists():
            raise Exception(
                f"Invalid crew directory structure for {normalized_id}: main.py not found in package directory {pkg_dir}"
            )

        crew_env_path = crew_dir / ".env"
        crew_env_vars: Dict[str, str] = {}
        if crew_env_path.exists():
            from dotenv import dotenv_values

            crew_env_vars = dotenv_values(crew_env_path)  # type: ignore[assignment]

        merged_env = os.environ.copy()
        merged_env.update({k: v for k, v in crew_env_vars.items() if v is not None})
        env = merged_env
        env["PYTHONUNBUFFERED"] = "1"

        for key, value in inputs.items():
            env[str(key).upper()] = str(value)

        uv_path = shutil.which("uv")
        if uv_path:
            rel_main_py = os.path.relpath(str(main_py), str(crew_dir))
            cmd = ["uv", "run", "python", rel_main_py]
            working_dir = crew_dir
        else:
            rel_main_py = os.path.relpath(str(main_py), str(pkg_dir))
            cmd = [sys.executable, "-u", rel_main_py]
            working_dir = pkg_dir
            env["PYTHONPATH"] = str(src_dir) + os.pathsep + env.get("PYTHONPATH", "")

        logger.info("Executing command: %s", " ".join(cmd))
        logger.info("Working directory (cwd): %s", working_dir)
        logger.info("Package directory: %s", pkg_dir.name)
        logger.info("Main.py path: %s", main_py)
        logger.info("Inputs: %s", inputs)

        logged_env = {
            k: v
            for k, v in env.items()
            if not any(token in k.upper() for token in ["KEY", "TOKEN", "PASSWORD", "SECRET"])
        }
        logger.info("Environment variables (partial): %s", logged_env)

        platform_system = platform.system()
        logger.info("Detected platform system: %s", platform_system)

        if platform_system == "Windows":
            process = await self._start_process_windows(cmd, working_dir, env)
        else:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(working_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

        process_id = str(getattr(process, "pid", ""))
        self.running_crews[normalized_id] = {
            "process": process,
            "process_id": process_id,
        }

        payload = {
            "crew_id": normalized_id,
            "process_id": process_id,
            "status": "started",
        }
        self._record_activity("crew_started", payload)
        await sio.emit("crew_started", payload)

        asyncio.create_task(
            self.broadcaster.stream_process_logs(
                normalized_id,
                process,
                sio,
                process_id=process_id,
                on_stop=lambda exit_payload: self._handle_process_exit(
                    exit_payload, sio
                ),
            )
        )

        return process_id

    async def _start_process_windows(self, cmd, working_dir, env):
        loop = asyncio.get_event_loop()

        def _launch() -> subprocess.Popen:
            return subprocess.Popen(
                cmd,
                cwd=str(working_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

        process = await loop.run_in_executor(None, _launch)

        class AsyncProcessWrapper:
            def __init__(self, popen: subprocess.Popen) -> None:
                self.process = popen
                self.stdout = popen.stdout
                self.stderr = popen.stderr

            @property
            def pid(self) -> int:
                return self.process.pid

            @property
            def returncode(self) -> Optional[int]:
                self.process.poll()
                return self.process.returncode

            def terminate(self) -> None:
                try:
                    self.process.terminate()
                except Exception as exc:
                    logger.warning("Error terminating process %s: %s", self.pid, exc)

            def kill(self) -> None:
                try:
                    self.process.kill()
                except Exception as exc:
                    logger.warning("Error killing process %s: %s", self.pid, exc)

        return AsyncProcessWrapper(process)

    async def _handle_process_exit(
        self, exit_payload: Dict[str, Any], sio, *, emit_update: bool = True
    ) -> None:
        crew_id = exit_payload.get("crew_id")
        process_id = exit_payload.get("process_id")
        exit_code = exit_payload.get("exit_code")

        tracked = self.running_crews.pop(crew_id, None)
        if not process_id and tracked:
            process_id = tracked.get("process_id")

        payload = {
            "crew_id": crew_id,
            "process_id": process_id,
            "exit_code": exit_code,
            "status": "stopped",
        }

        self._record_activity("crew_stopped", payload)

        try:
            await sio.emit("crew_stopped", payload)
        except Exception as exc:  # pragma: no cover - network errors
            logger.error("Error emitting crew_stopped for %s: %s", crew_id, exc)

        if emit_update:
            try:
                await self._emit_crew_update(crew_id, sio)
            except Exception as exc:  # pragma: no cover - best effort
                logger.error("Error emitting crew update for %s: %s", crew_id, exc)

    async def _emit_crew_update(self, crew_id: str, sio) -> None:
        try:
            crew_info = self.storage.load_crew(crew_id, self.running_crews.keys())
        except ValueError:
            return

        if not crew_info:
            return

        crew_payload = dict(crew_info)
        crew_payload["id"] = crew_payload.get("id", crew_id)
        crew_payload["status"] = (
            "running" if crew_payload["id"] in self.running_crews else "ready"
        )
        await sio.emit("crew_updated", crew_payload)

    def stop_crew(self, crew_id: str) -> None:
        normalized_id = normalize_crew_identifier(crew_id)

        crew_info = self.running_crews.get(normalized_id)
        if not crew_info:
            logger.warning("No running crew found with ID: %s", normalized_id)
            return

        process = crew_info.get("process")
        if not process:
            logger.warning("No process found for crew: %s", normalized_id)
            return

        try:
            pid = getattr(process, "pid", "unknown")
            logger.info("Terminating crew %s (pid=%s)", normalized_id, pid)

            if hasattr(process, "returncode") and process.returncode is not None:
                logger.info(
                    "Process for crew %s already terminated with code %s",
                    normalized_id,
                    process.returncode,
                )
                return

            process.terminate()
            logger.info("Terminate signal sent to crew %s", normalized_id)
        except Exception as exc:
            logger.warning(
                "terminate() failed for crew %s: %s; attempting kill()",
                normalized_id,
                exc,
            )
            try:
                if hasattr(process, "kill"):
                    process.kill()
                    logger.info("Kill signal sent to crew %s", normalized_id)
                else:
                    logger.error(
                        "Process for crew %s does not support kill() method",
                        normalized_id,
                    )
            except Exception as kill_exc:
                logger.error("kill() failed for crew %s: %s", normalized_id, kill_exc)

