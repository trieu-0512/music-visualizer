"""Python view of the startup configuration (Req 13.4).

The Audio_Worker reads the same ``config/default.json`` as the Node areas so
the storage and queue backend selections stay consistent across the system.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


def _workspace_root() -> Path:
    # This file lives at workers/src/config.py, so the workspace root is two
    # levels up. Independent of the current working directory.
    return Path(__file__).resolve().parents[2]


def _default_config_path() -> Path:
    return _workspace_root() / "config" / "default.json"


@dataclass(frozen=True)
class StorageConfig:
    backend: str
    root_dir: str


@dataclass(frozen=True)
class QueueConfig:
    backend: str
    dir: str


@dataclass(frozen=True)
class AppConfig:
    storage: StorageConfig
    queue: QueueConfig


def parse_config(data: object) -> AppConfig:
    if not isinstance(data, dict):
        raise ValueError("config must be a JSON object")

    storage = data.get("storage")
    if not isinstance(storage, dict):
        raise ValueError("config.storage must be an object")
    if storage.get("backend") != "local":
        raise ValueError("config.storage.backend must be 'local'")
    root_dir = storage.get("rootDir")
    if not isinstance(root_dir, str) or not root_dir:
        raise ValueError("config.storage.rootDir must be a non-empty string")

    queue = data.get("queue")
    if not isinstance(queue, dict):
        raise ValueError("config.queue must be an object")
    if queue.get("backend") != "file":
        raise ValueError("config.queue.backend must be 'file'")
    queue_dir = queue.get("dir")
    if not isinstance(queue_dir, str) or not queue_dir:
        raise ValueError("config.queue.dir must be a non-empty string")

    return AppConfig(
        storage=StorageConfig(backend=storage["backend"], root_dir=root_dir),
        queue=QueueConfig(backend=queue["backend"], dir=queue_dir),
    )


def load_config(config_path: str | os.PathLike[str] | None = None) -> AppConfig:
    """Load the application configuration at startup (Req 13.4).

    Resolution order: explicit ``config_path`` -> ``MV_CONFIG`` env var ->
    ``config/default.json`` at the workspace root.
    """
    candidate = config_path or os.environ.get("MV_CONFIG") or _default_config_path()
    path = Path(candidate)
    if not path.is_absolute():
        path = _workspace_root() / path
    data = json.loads(path.read_text(encoding="utf-8"))
    return parse_config(data)
