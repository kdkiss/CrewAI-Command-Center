"""Metadata extraction utilities for Crew configurations."""

from __future__ import annotations

import ast
import logging
import re
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple


logger = logging.getLogger(__name__)


class MetadataDiscovery:
    """Parse crew source files to discover runtime metadata."""

    def __init__(self) -> None:
        self.pattern_fallback_hook: Optional[
            Callable[[str, Dict[str, Dict[str, Any]]], None]
        ] = None

    def extract_inputs(self, main_py: Path) -> Dict[str, Dict[str, Any]]:
        """Extract input parameter metadata from a crew's ``main.py`` file."""

        inputs: Dict[str, Dict[str, Any]] = {}
        if not main_py.exists():
            return inputs

        try:
            content = main_py.read_text(encoding="utf-8")
        except Exception as exc:  # pragma: no cover - defensive read
            logger.warning("Failed reading %s for input discovery: %s", main_py, exc)
            return inputs

        try:
            tree = ast.parse(content)
        except SyntaxError as exc:
            logger.warning("Syntax error parsing %s: %s", main_py, exc)
            self._extract_inputs_from_patterns(content, inputs)
            return inputs

        helper_defaults = self._collect_helper_default_dicts(tree)

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "run":
                inputs_dict = self._extract_inputs_from_assignments(
                    node, inputs, helper_defaults
                )
                if inputs_dict:
                    return inputs_dict

                self._extract_inputs_from_signature(node, inputs)
                if inputs:
                    break

        if not inputs:
            self._extract_inputs_from_patterns(content, inputs)

        return inputs

    # ------------------------------------------------------------------
    # AST helpers
    # ------------------------------------------------------------------
    def _extract_inputs_from_assignments(
        self,
        node: ast.FunctionDef,
        inputs: Dict[str, Dict[str, Any]],
        helper_defaults: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if len(stmt.targets) != 1 or not isinstance(stmt.targets[0], ast.Name):
                continue

            target_name = stmt.targets[0].id
            normalized_target = target_name.lower()
            is_inputs_dict = target_name == "inputs" or target_name.endswith("_inputs")
            is_defaults_dict = normalized_target in {
                "defaults",
                "default_inputs",
                "input_defaults",
            } or (
                normalized_target.endswith("_defaults") and "input" in normalized_target
            )

            if not (is_inputs_dict or is_defaults_dict):
                continue

            if isinstance(stmt.value, ast.Dict):
                for key, value in zip(stmt.value.keys, stmt.value.values):
                    if key is None:
                        helper_name = self._extract_helper_call_name(value)
                        if helper_name and helper_name in helper_defaults:
                            self._merge_input_metadata(inputs, helper_defaults[helper_name])
                        continue

                    if not isinstance(key, ast.Constant):
                        continue

                    param_name = key.value
                    default_value, param_type, required = self._interpret_default_from_node(
                        value
                    )
                    inputs[param_name] = {
                        "description": f"Parameter: {param_name}",
                        "type": param_type,
                        "default": default_value,
                        "required": required,
                    }

            if inputs:
                return inputs

        return inputs

    def _extract_inputs_from_signature(
        self, node: ast.FunctionDef, inputs: Dict[str, Dict[str, Any]]
    ) -> None:
        for arg_index, arg in enumerate(node.args.args):
            if not isinstance(arg, ast.arg):
                continue

            param_name = arg.arg
            param_type = "str"
            if arg.annotation:
                if isinstance(arg.annotation, ast.Name):
                    param_type = arg.annotation.id
                elif isinstance(arg.annotation, ast.Constant):
                    param_type = str(arg.annotation.value)

            default_index = arg_index - (len(node.args.args) - len(node.args.defaults))
            default_value = None
            if 0 <= default_index < len(node.args.defaults):
                default_node = node.args.defaults[default_index]
                default_value, _, _ = self._interpret_default_from_node(default_node)

            description = f"Parameter: {param_name}"

            inputs[param_name] = {
                "description": description,
                "type": param_type,
                "default": default_value,
                "required": default_value is None,
            }

    def _collect_helper_default_dicts(self, tree: ast.AST) -> Dict[str, Dict[str, Any]]:
        helper_defaults: Dict[str, Dict[str, Any]] = {}

        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign):
                continue
            if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
                continue

            target_name = node.targets[0].id
            if not target_name.endswith("_defaults"):
                continue

            if isinstance(node.value, ast.Dict):
                helper_defaults[target_name] = self._build_metadata_from_dict(node.value)

        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue
            return_stmts = [stmt for stmt in node.body if isinstance(stmt, ast.Return)]
            if not return_stmts:
                continue
            return_stmt = return_stmts[0]
            if isinstance(return_stmt.value, ast.Dict):
                helper_defaults[node.name] = self._build_metadata_from_dict(
                    return_stmt.value
                )

        return helper_defaults

    def _build_metadata_from_dict(self, dict_node: ast.Dict) -> Dict[str, Dict[str, Any]]:
        metadata: Dict[str, Dict[str, Any]] = {}
        for key, value in zip(dict_node.keys, dict_node.values):
            if not isinstance(key, ast.Constant):
                continue

            param_name = key.value
            default_value, inferred_type, required = self._interpret_default_from_node(value)
            metadata[param_name] = {
                "description": f"Parameter: {param_name}",
                "type": inferred_type,
                "default": default_value,
                "required": required,
            }

        return metadata

    def _interpret_default_from_node(
        self, node: ast.AST
    ) -> Tuple[Any, str, bool]:
        if isinstance(node, ast.Constant):
            value = node.value
            return value, type(value).__name__, value is None
        if isinstance(node, ast.NameConstant):  # pragma: no cover - Py<3.8 compatibility
            value = node.value
            return value, type(value).__name__, value is None
        if isinstance(node, ast.Call):
            func_name = self._extract_helper_call_name(node)
            if func_name in {"getenv", "os.getenv"}:
                if len(node.args) > 1 and isinstance(node.args[1], ast.Constant):
                    default = node.args[1].value
                    return default, "str", default is None
                return None, "str", True
            unparsed_call = self._safe_unparse(node)
            if unparsed_call is not None:
                return unparsed_call, "str", False

        unparsed = self._safe_unparse(node)
        if unparsed is not None:
            return unparsed, "str", False
        return None, "str", True

    def _safe_unparse(self, node: ast.AST) -> Optional[str]:
        try:
            return ast.unparse(node)  # type: ignore[attr-defined]
        except Exception:
            return None

    def _extract_helper_call_name(self, node: ast.AST) -> Optional[str]:
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name):
                return func.id
            if isinstance(func, ast.Attribute):
                return func.attr
        return None

    def _merge_input_metadata(
        self,
        inputs: Dict[str, Dict[str, Any]],
        defaults: Dict[str, Dict[str, Any]],
    ) -> None:
        for key, meta in defaults.items():
            existing = inputs.get(key)
            if not existing:
                inputs[key] = dict(meta)
                continue

            if existing.get("default") in {None, ""} and meta.get("default") not in {None, ""}:
                existing["default"] = meta.get("default")
            if not existing.get("description") and meta.get("description"):
                existing["description"] = meta["description"]
            if not existing.get("type") and meta.get("type"):
                existing["type"] = meta["type"]
            if existing.get("required", True) and not meta.get("required", True):
                existing["required"] = False

    # ------------------------------------------------------------------
    # Pattern matching fallback
    # ------------------------------------------------------------------
    def _extract_inputs_from_patterns(
        self, content: str, inputs: Dict[str, Dict[str, Any]]
    ) -> None:
        pair_pattern = r"(['\"][^'\"]*['\"])\s*:\s*([^,}]*)"
        inputs_dict_pattern = r"(\w*inputs)\s*=\s*\{([^}]*)\}"

        if self.pattern_fallback_hook:
            self.pattern_fallback_hook(content, inputs)
            return

        match = re.search(inputs_dict_pattern, content, re.DOTALL)
        if match:
            var_name = match.group(1)
            if var_name == "inputs" or var_name.endswith("inputs"):
                inputs_content = match.group(2)
                for pair in re.finditer(pair_pattern, inputs_content):
                    key = pair.group(1).strip("\"'")
                    value_str = pair.group(2).strip()
                    getenv_match = re.search(
                        r"os\.getenv\s*\(\s*[\"\']([^\"\']*)[\"\'](?:\s*,\s*[\"\']([^\"\']*)[\"\']\s*)?\)",
                        value_str,
                    )
                    if getenv_match:
                        default_value = getenv_match.group(2)
                        param_type = "str"
                        required = default_value is None
                    else:
                        try:
                            evaluated = ast.literal_eval(value_str)
                        except Exception:
                            evaluated = None
                            param_type = "str"
                            required = True
                        else:
                            param_type = type(evaluated).__name__
                            required = False
                        default_value = evaluated

                    inputs[key] = {
                        "description": f"Parameter: {key}",
                        "type": param_type,
                        "default": default_value,
                        "required": required,
                    }

        if inputs:
            return

        param_patterns = {
            "topic": {
                "patterns": ["topic", "subject", "query"],
                "description": "Enter research topic",
                "type": "str",
                "default": None,
                "required": True,
            },
            "target_audience": {
                "patterns": ["audience", "target", "customer"],
                "description": "Define target audience",
                "type": "str",
                "default": None,
                "required": True,
            },
            "output_file": {
                "patterns": ["output", "file", "save_to"],
                "description": "Output file path",
                "type": "str",
                "default": "output/results.txt",
                "required": False,
            },
            "iterations": {
                "patterns": ["iterations", "num_iterations", "max_iter"],
                "description": "Number of iterations",
                "type": "int",
                "default": 3,
                "required": False,
            },
            "verbose": {
                "patterns": ["verbose", "debug", "log_level"],
                "description": "Enable verbose logging",
                "type": "bool",
                "default": False,
                "required": False,
            },
        }

        content_lower = content.lower()
        for key, info in param_patterns.items():
            if any(pattern in content_lower for pattern in info["patterns"]) and key not in inputs:
                inputs[key] = {
                    "description": info["description"],
                    "type": info["type"],
                    "default": info.get("default"),
                    "required": bool(info.get("required", False)),
                }

        if not inputs:
            inputs.update(
                {
                    "topic": {
                        "description": "Enter research topic",
                        "type": "str",
                        "default": None,
                        "required": True,
                    },
                    "target_audience": {
                        "description": "Define target audience",
                        "type": "str",
                        "default": None,
                        "required": True,
                    },
                }
            )

    def extract_inputs_from_patterns(
        self, content: str, inputs: Dict[str, Dict[str, Any]]
    ) -> None:
        self._extract_inputs_from_patterns(content, inputs)

