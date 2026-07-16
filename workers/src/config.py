"""Python view of the startup configuration (Req 13.4).

The Audio_Worker reads the same ``config/default.json`` as the Node areas so
the storage and queue backend selections stay consistent across the system.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

# Defaults match shared/src/config/types.ts QUEUE_CONFIG_DEFAULTS (PR-04c).
DEFAULT_LEASE_MS = 120_000
DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000
DEFAULT_MAX_REQUEUES_AUDIO = 1
DEFAULT_MAX_REQUEUES_RENDER = 0
DEFAULT_LEASE_RECOVERY_ENABLED = True


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
    lease_ms: int = DEFAULT_LEASE_MS
    heartbeat_interval_ms: int = DEFAULT_HEARTBEAT_INTERVAL_MS
    max_requeues_audio: int = DEFAULT_MAX_REQUEUES_AUDIO
    max_requeues_render: int = DEFAULT_MAX_REQUEUES_RENDER
    lease_recovery_enabled: bool = DEFAULT_LEASE_RECOVERY_ENABLED


@dataclass(frozen=True)
class AppConfig:
    storage: StorageConfig
    queue: QueueConfig


def _optional_positive_int(value: object, default: int) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        n = int(value)
        if n > 0:
            return n
    return default


def _optional_nonneg_int(value: object, default: int) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        n = int(value)
        if n >= 0:
            return n
    return default


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

    lease_recovery = queue.get("leaseRecoveryEnabled")
    if not isinstance(lease_recovery, bool):
        lease_recovery = DEFAULT_LEASE_RECOVERY_ENABLED

    return AppConfig(
        storage=StorageConfig(backend=storage["backend"], root_dir=root_dir),
        queue=QueueConfig(
            backend=queue["backend"],
            dir=queue_dir,
            lease_ms=_optional_positive_int(queue.get("leaseMs"), DEFAULT_LEASE_MS),
            heartbeat_interval_ms=_optional_positive_int(
                queue.get("heartbeatIntervalMs"), DEFAULT_HEARTBEAT_INTERVAL_MS
            ),
            max_requeues_audio=_optional_nonneg_int(
                queue.get("maxRequeuesAudio"), DEFAULT_MAX_REQUEUES_AUDIO
            ),
            max_requeues_render=_optional_nonneg_int(
                queue.get("maxRequeuesRender"), DEFAULT_MAX_REQUEUES_RENDER
            ),
            lease_recovery_enabled=lease_recovery,
        ),
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
