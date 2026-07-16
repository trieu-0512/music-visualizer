"""Python view of the file-based Job_Queue (Req 12.1-12.4).

The Node ``FileJobQueue`` stores each job as ``{jobId}.json`` under
``storage/jobs/`` and claims a job atomically with a per-job ``O_EXCL`` lock
file when transitioning ``pending -> running`` (design: Job_Queue Interface).
This module is a compatible Python view that reads and writes the *same* JSON
record shape so the Audio_Worker and the Node API_Service share one queue:

    {id, projectId, type, status, params, artifacts, error?, createdAt, updatedAt}

Statuses are ``pending`` / ``running`` / ``completed`` / ``failed``.
"""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from src.config import AppConfig, QueueConfig, load_config

JOB_TYPES = ("transcribe", "analyze", "render")
JOB_STATUSES = ("pending", "running", "completed", "failed")


def _now_iso() -> str:
    # Millisecond precision with a trailing 'Z', matching JS Date#toISOString.
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _workspace_root() -> Path:
    # workers/src/queue.py -> workspace root is two levels up, matching config.py.
    return Path(__file__).resolve().parents[2]


@dataclass
class Job:
    """A single queue job. Field names mirror the shared JSON record."""

    id: str
    project_id: str
    type: str
    status: str
    params: dict = field(default_factory=dict)
    artifacts: list[str] = field(default_factory=list)
    error: str | None = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        record = {
            "id": self.id,
            "projectId": self.project_id,
            "type": self.type,
            "status": self.status,
            "params": self.params,
            "artifacts": self.artifacts,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }
        if self.error is not None:
            record["error"] = self.error
        return record

    @classmethod
    def from_dict(cls, data: dict) -> "Job":
        return cls(
            id=data["id"],
            project_id=data["projectId"],
            type=data["type"],
            status=data["status"],
            params=data.get("params", {}),
            artifacts=data.get("artifacts", []),
            error=data.get("error"),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
        )


class JobQueue:
    """File-based queue view over ``storage/jobs/`` (Req 12)."""

    def __init__(self, dir: str | os.PathLike[str]) -> None:
        path = Path(dir)
        if not path.is_absolute():
            path = _workspace_root() / path
        self.dir = path
        self.dir.mkdir(parents=True, exist_ok=True)

    # -- paths -------------------------------------------------------------

    def _job_path(self, job_id: str) -> Path:
        return self.dir / f"{job_id}.json"

    def _lock_path(self, job_id: str) -> Path:
        return self.dir / f"{job_id}.lock"

    # -- persistence -------------------------------------------------------

    def _write_record(self, job: Job) -> None:
        # Write to a temp file then atomically replace so readers never observe
        # a partially written record.
        target = self._job_path(job.id)
        fd, tmp_name = tempfile.mkstemp(dir=str(self.dir), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(job.to_dict(), handle, ensure_ascii=False, indent=2)
            os.replace(tmp_name, target)
        except BaseException:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)
            raise

    def _read_record(self, job_id: str) -> Job | None:
        path = self._job_path(job_id)
        if not path.exists():
            return None
        return Job.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def _require(self, job_id: str) -> Job:
        job = self._read_record(job_id)
        if job is None:
            raise KeyError(f"job not found: {job_id}")
        return job

    # -- public API --------------------------------------------------------

    def enqueue(self, project_id: str, type: str, params: dict | None = None) -> Job:
        """Accept a new job in the ``pending`` state (Req 12.1)."""
        if type not in JOB_TYPES:
            raise ValueError(f"unknown job type: {type}")
        now = _now_iso()
        job = Job(
            id=uuid.uuid4().hex,
            project_id=project_id,
            type=type,
            status="pending",
            params=params or {},
            artifacts=[],
            created_at=now,
            updated_at=now,
        )
        self._write_record(job)
        return job

    def get(self, job_id: str) -> Job | None:
        """Return the job record, or ``None`` if unknown (Req 12.2)."""
        return self._read_record(job_id)

    def list_by_project(self, project_id: str) -> list[Job]:
        jobs = [
            job
            for path in self.dir.glob("*.json")
            if (job := self._read_record(path.stem)) is not None
            and job.project_id == project_id
        ]
        jobs.sort(key=lambda j: (j.created_at, j.id))
        return jobs

    def claim_next(self, types: list[str] | tuple[str, ...]) -> Job | None:
        """Claim the oldest pending job of one of ``types`` (Req 12.1).

        Hybrid claim protocol (Architecture Upgrade KD-1 / PR-03): create a
        per-job ``O_EXCL`` lock, re-read to confirm still ``pending``, write
        ``status=running``, and **hold the lock** until ``mark_completed`` /
        ``mark_failed``. Claim write failures always release the lock.
        """
        allowed = set(types)
        candidates = [
            job
            for path in self.dir.glob("*.json")
            if (job := self._read_record(path.stem)) is not None
            and job.status == "pending"
            and job.type in allowed
        ]
        candidates.sort(key=lambda j: (j.created_at, j.id))

        for candidate in candidates:
            try:
                fd = os.open(
                    self._lock_path(candidate.id),
                    os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                )
            except FileExistsError:
                # Another worker already holds the claim; try the next candidate.
                continue
            os.close(fd)
            try:
                fresh = self._read_record(candidate.id)
                if fresh is None or fresh.status != "pending":
                    self._release_lock(candidate.id)
                    continue
                fresh.status = "running"
                fresh.updated_at = _now_iso()
                self._write_record(fresh)
                return fresh
            except BaseException:
                self._release_lock(candidate.id)
                raise
        return None

    def mark_running(self, job_id: str) -> Job:
        """No-op when already ``running``; otherwise transition (Req 12.2).

        After hybrid claim, ``claim_next`` already wrote ``running``, so callers
        that still invoke this must not rewrite the record unnecessarily.
        """
        job = self._require(job_id)
        if job.status == "running":
            return job
        job.status = "running"
        job.updated_at = _now_iso()
        self._write_record(job)
        return job

    def mark_completed(self, job_id: str, artifacts: list[str]) -> Job:
        """Record completion and the produced artifact references (Req 12.3)."""
        job = self._require(job_id)
        job.status = "completed"
        job.artifacts = list(artifacts)
        job.error = None
        job.updated_at = _now_iso()
        self._write_record(job)
        self._release_lock(job_id)
        return job

    def mark_failed(self, job_id: str, error: str) -> Job:
        """Record failure and retain the error message (Req 12.4, 3.6, 6.7)."""
        job = self._require(job_id)
        job.status = "failed"
        job.error = error
        job.updated_at = _now_iso()
        self._write_record(job)
        self._release_lock(job_id)
        return job

    def _release_lock(self, job_id: str) -> None:
        lock = self._lock_path(job_id)
        if lock.exists():
            lock.unlink()


def create_job_queue(config: QueueConfig | AppConfig | None = None) -> JobQueue:
    """Build a :class:`JobQueue` from configuration (Req 13.4).

    Accepts a :class:`QueueConfig`, a full :class:`AppConfig`, or ``None`` to
    load the default startup configuration. Only the ``file`` backend is
    supported in the MVP, matching the Node factory.
    """
    if config is None:
        config = load_config()
    if isinstance(config, AppConfig):
        config = config.queue
    if config.backend != "file":
        raise ValueError(f"Unknown queue backend: {config.backend}")
    return JobQueue(config.dir)
