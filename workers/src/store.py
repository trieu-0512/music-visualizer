"""Python view of the Asset_Store address space (Req 13.1, 13.2).

The Audio_Worker reads inputs and writes artifacts through the *same*
``(projectId, relativePath)`` address space that the Node ``LocalAssetStore``
uses. The local backend maps an address to
``{rootDir}/projects/{projectId}/{relativePath}`` (design: Storage layout), so
both runtimes resolve to identical files on disk.

No caller constructs filesystem paths directly; every access flows through this
view, which guards against path traversal so a ``projectId`` or ``relativePath``
can never escape the project's storage root.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

from src.config import AppConfig, StorageConfig, load_config


def _workspace_root() -> Path:
    # workers/src/store.py -> workspace root is two levels up, matching config.py.
    return Path(__file__).resolve().parents[2]


def _ensure_within(target: Path, base: Path) -> Path:
    """Return ``target`` if it lies within ``base``, else raise ``ValueError``.

    This is the path-traversal guard shared in spirit with the Node backend: a
    ``projectId`` or ``relativePath`` containing ``..`` (or absolute segments)
    that escapes the project root is rejected rather than silently resolved.
    """
    if not target.is_relative_to(base):
        raise ValueError(f"path escapes storage root: {target} not under {base}")
    return target


class AssetStore:
    """Local-filesystem view of the project address space.

    Mirrors the Node ``AssetStore`` surface the Python handlers require:
    ``read_to_temp``, ``write_json``, ``write_text``, ``read_json``,
    ``exists``, plus byte-level and listing helpers.
    """

    def __init__(self, root_dir: str | os.PathLike[str]) -> None:
        root = Path(root_dir)
        if not root.is_absolute():
            root = _workspace_root() / root
        self.root_dir = root
        self._projects_root = (root / "projects").resolve()

    # -- address resolution ------------------------------------------------

    def resolve_path(self, project_id: str, relative_path: str) -> Path:
        """Resolve ``(projectId, relativePath)`` to an absolute local path.

        Maps to ``{rootDir}/projects/{projectId}/{relativePath}`` and rejects
        any address that would escape the owning project's directory.
        """
        if not project_id:
            raise ValueError("projectId must be a non-empty string")
        if relative_path is None:
            raise ValueError("relativePath must be a string")

        project_base = (self._projects_root / project_id).resolve()
        _ensure_within(project_base, self._projects_root)

        target = (project_base / relative_path).resolve()
        _ensure_within(target, project_base)
        return target

    def resolve_url(self, project_id: str, relative_path: str) -> str:
        """Local backend resolves an address to an absolute filesystem path."""
        return str(self.resolve_path(project_id, relative_path))

    # -- existence / listing ----------------------------------------------

    def exists(self, project_id: str, relative_path: str) -> bool:
        return self.resolve_path(project_id, relative_path).exists()

    def list(self, project_id: str, prefix: str | None = None) -> list[str]:
        """List stored relative paths for a project, optionally under ``prefix``."""
        project_base = (self._projects_root / project_id).resolve()
        _ensure_within(project_base, self._projects_root)
        if not project_base.exists():
            return []
        results: list[str] = []
        for path in project_base.rglob("*"):
            if path.is_file():
                rel = path.relative_to(project_base).as_posix()
                if prefix is None or rel.startswith(prefix):
                    results.append(rel)
        results.sort()
        return results

    # -- writes ------------------------------------------------------------

    def write_bytes(self, project_id: str, relative_path: str, data: bytes) -> None:
        target = self.resolve_path(project_id, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def write_text(
        self, project_id: str, relative_path: str, text: str, *, encoding: str = "utf-8"
    ) -> None:
        target = self.resolve_path(project_id, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding=encoding)

    def write_json(self, project_id: str, relative_path: str, value: object) -> None:
        self.write_text(
            project_id,
            relative_path,
            json.dumps(value, ensure_ascii=False, indent=2),
        )

    # -- reads -------------------------------------------------------------

    def read_bytes(self, project_id: str, relative_path: str) -> bytes:
        return self.resolve_path(project_id, relative_path).read_bytes()

    def read_text(
        self, project_id: str, relative_path: str, *, encoding: str = "utf-8"
    ) -> str:
        return self.resolve_path(project_id, relative_path).read_text(encoding=encoding)

    def read_json(self, project_id: str, relative_path: str) -> object:
        return json.loads(self.read_text(project_id, relative_path))

    def read_to_temp(self, project_id: str, relative_path: str) -> str:
        """Copy a stored asset to a temp file and return its path.

        Handlers (e.g. ``handle_transcribe``) hand the temp path to external
        tools (WhisperX, librosa) that expect a real file on disk. The suffix is
        preserved so format detection by those tools still works.
        """
        source = self._resolve_existing_source(project_id, relative_path)
        if not source.is_file():
            raise FileNotFoundError(
                f"asset not found: ({project_id!r}, {relative_path!r})"
            )
        fd, tmp_name = tempfile.mkstemp(suffix=source.suffix)
        os.close(fd)
        shutil.copyfile(source, tmp_name)
        return tmp_name

    def _resolve_existing_source(self, project_id: str, relative_path: str) -> Path:
        """Resolve an exact path, or a single-extension variant for role stems.

        The Node API stores role uploads with their real extension
        (``assets/audio.mp3`` / ``assets/audio.wav``), while worker handlers use
        role stems like ``assets/audio``. When the exact file is absent and the
        requested path has no suffix, pick the first existing same-stem file.
        """
        target = self.resolve_path(project_id, relative_path)
        if target.is_file() or target.suffix:
            return target

        parent = target.parent
        if not parent.is_dir():
            return target

        candidates = sorted(path for path in parent.glob(f"{target.name}.*") if path.is_file())
        return candidates[0] if candidates else target

    # -- delete ------------------------------------------------------------

    def delete(self, project_id: str, relative_path: str) -> None:
        target = self.resolve_path(project_id, relative_path)
        if target.exists():
            target.unlink()


def create_asset_store(config: StorageConfig | AppConfig | None = None) -> AssetStore:
    """Build an :class:`AssetStore` from configuration (Req 13.4).

    Accepts a :class:`StorageConfig`, a full :class:`AppConfig`, or ``None`` to
    load the default startup configuration. Only the ``local`` backend is
    supported in the MVP; other backends raise, matching the Node factory.
    """
    if config is None:
        config = load_config()
    if isinstance(config, AppConfig):
        config = config.storage
    if config.backend != "local":
        raise ValueError(f"Unknown storage backend: {config.backend}")
    return AssetStore(config.root_dir)
