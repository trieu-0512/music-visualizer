"""Python view of the file-based Job_Queue (Req 12.1-12.4).

The Node ``FileJobQueue`` stores each job as ``{jobId}.json`` under
``storage/jobs/`` and claims a job atomically with a per-job ``O_EXCL`` lock
file when transitioning ``pending -> running`` (design: Job_Queue Interface).
This module is a compatible Python view that reads and writes the *same* JSON
record shape so the Audio_Worker and the Node API_Service share one queue
(Architecture Upgrade KD-1..KD-22 / PR-04a/b/c).
"""

from __future__ import annotations

import json
import os
import socket
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Union

from src.config import (
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    DEFAULT_LEASE_MS,
    DEFAULT_LEASE_RECOVERY_ENABLED,
    DEFAULT_MAX_REQUEUES_AUDIO,
    DEFAULT_MAX_REQUEUES_RENDER,
    AppConfig,
    QueueConfig,
    load_config,
)

JOB_TYPES = ("prepare-assets", "transcribe", "analyze", "render")
JOB_STATUSES = ("pending", "running", "completed", "failed")


class OwnershipError(Exception):
    """Raised when a fenced mutation does not match claim ownership (KD-14)."""


def default_worker_id(role: str = "audio-worker") -> str:
    """Build a stable worker id for this process (mirrors Node ``defaultWorkerId``)."""
    return f"{role}:{socket.gethostname()}:pid:{os.getpid()}"


def _now_iso() -> str:
    # Millisecond precision with a trailing 'Z', matching JS Date#toISOString.
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _workspace_root() -> Path:
    # workers/src/queue.py -> workspace root is two levels up, matching config.py.
    return Path(__file__).resolve().parents[2]


def _resolve_dir(dir_path: str | os.PathLike[str]) -> Path:
    path = Path(dir_path)
    if not path.is_absolute():
        path = _workspace_root() / path
    return path


def _parse_iso_ms(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        text = iso
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).timestamp() * 1000.0
    except (TypeError, ValueError):
        return None


def _now_ms(now: datetime | None = None) -> float:
    if now is None:
        return time.time() * 1000.0
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.timestamp() * 1000.0


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
    claimed_at: str | None = None
    heartbeat_at: str | None = None
    claimed_by: str | None = None
    claim_generation: int = 0
    requeue_count: int = 0

    def to_dict(self) -> dict:
        record: dict = {
            "id": self.id,
            "projectId": self.project_id,
            "type": self.type,
            "status": self.status,
            "params": self.params,
            "artifacts": self.artifacts,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "claimGeneration": self.claim_generation,
            "requeueCount": self.requeue_count,
        }
        if self.error is not None:
            record["error"] = self.error
        if self.claimed_at is not None:
            record["claimedAt"] = self.claimed_at
        if self.heartbeat_at is not None:
            record["heartbeatAt"] = self.heartbeat_at
        if self.claimed_by is not None:
            record["claimedBy"] = self.claimed_by
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
            claimed_at=data.get("claimedAt"),
            heartbeat_at=data.get("heartbeatAt"),
            claimed_by=data.get("claimedBy"),
            claim_generation=int(data.get("claimGeneration") or 0),
            requeue_count=int(data.get("requeueCount") or 0),
        )

    def clear_claim_fields(self) -> None:
        """Clear live claim fields; keep claim_generation / requeue_count."""
        self.claimed_at = None
        self.heartbeat_at = None
        self.claimed_by = None


def _ownership_matches(job: Job, worker_id: str, claim_generation: int) -> bool:
    return (
        job.status == "running"
        and job.claimed_by == worker_id
        and (job.claim_generation or 0) == claim_generation
    )


class JobQueue:
    """File-based queue view over ``storage/jobs/`` (Req 12, hybrid claim)."""

    def __init__(
        self,
        dir_or_config: Union[str, os.PathLike[str], QueueConfig],
    ) -> None:
        """Accept a directory path (tests) or full :class:`QueueConfig` (KD-16)."""
        if isinstance(dir_or_config, QueueConfig):
            self.dir = _resolve_dir(dir_or_config.dir)
            self.lease_ms = dir_or_config.lease_ms
            self.heartbeat_interval_ms = dir_or_config.heartbeat_interval_ms
            self.max_requeues_audio = dir_or_config.max_requeues_audio
            self.max_requeues_render = dir_or_config.max_requeues_render
            self.lease_recovery_enabled = dir_or_config.lease_recovery_enabled
            self.config = dir_or_config
        else:
            self.dir = _resolve_dir(dir_or_config)
            self.lease_ms = DEFAULT_LEASE_MS
            self.heartbeat_interval_ms = DEFAULT_HEARTBEAT_INTERVAL_MS
            self.max_requeues_audio = DEFAULT_MAX_REQUEUES_AUDIO
            self.max_requeues_render = DEFAULT_MAX_REQUEUES_RENDER
            self.lease_recovery_enabled = DEFAULT_LEASE_RECOVERY_ENABLED
            self.config = QueueConfig(
                backend="file",
                dir=str(dir_or_config),
                lease_ms=self.lease_ms,
                heartbeat_interval_ms=self.heartbeat_interval_ms,
                max_requeues_audio=self.max_requeues_audio,
                max_requeues_render=self.max_requeues_render,
                lease_recovery_enabled=self.lease_recovery_enabled,
            )
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

    def _release_lock(self, job_id: str) -> None:
        lock = self._lock_path(job_id)
        try:
            lock.unlink(missing_ok=True)  # type: ignore[call-arg]
        except TypeError:
            # Python < 3.8 compatibility path (not expected on modern venv).
            if lock.exists():
                lock.unlink()

    def _lock_exists(self, job_id: str) -> bool:
        return self._lock_path(job_id).exists()

    def _try_lock(self, job_id: str) -> bool:
        try:
            fd = os.open(
                self._lock_path(job_id),
                os.O_CREAT | os.O_EXCL | os.O_WRONLY,
            )
        except FileExistsError:
            return False
        os.close(fd)
        return True

    def _lock_age_ms(self, job_id: str, now_ms: float) -> float:
        path = self._lock_path(job_id)
        try:
            mtime_ms = path.stat().st_mtime * 1000.0
            return now_ms - mtime_ms
        except OSError:
            return float("inf")

    def touch_lock_age(self, job_id: str, age_ms: int) -> None:
        """Test helper: force a lock file mtime into the past."""
        path = self._lock_path(job_id)
        past = time.time() - (age_ms / 1000.0)
        os.utime(path, (past, past))

    def _max_requeues_for(self, job_type: str) -> int:
        if job_type == "render":
            return self.max_requeues_render
        return self.max_requeues_audio

    def _lease_expired(self, job: Job, now_ms: float) -> bool:
        anchor = (
            _parse_iso_ms(job.heartbeat_at)
            or _parse_iso_ms(job.claimed_at)
            or _parse_iso_ms(job.updated_at)
            or 0.0
        )
        return (now_ms - anchor) > self.lease_ms

    def _may_break_lock(
        self,
        mode: str,
        job: Job | None,
        job_id: str,
        now_ms: float,
    ) -> bool:
        if job is None:
            return True
        if job.status in ("completed", "failed"):
            return self._lock_exists(job_id)
        if job.status == "pending":
            if not self._lock_exists(job_id):
                return False
            return self._lock_age_ms(job_id, now_ms) > self.lease_ms
        if job.status == "running":
            if mode == "orphanOnly":
                return False
            return self._lease_expired(job, now_ms)
        return False

    def _all_job_ids_and_lock_stems(self) -> list[str]:
        ids: set[str] = set()
        if not self.dir.exists():
            return []
        for name in os.listdir(self.dir):
            if name.endswith(".json"):
                ids.add(name[: -len(".json")])
            elif name.endswith(".lock"):
                ids.add(name[: -len(".lock")])
        return list(ids)

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

    def claim_next(
        self,
        types: list[str] | tuple[str, ...],
        worker_id: str,
    ) -> Job | None:
        """Claim the oldest pending job of one of ``types`` (Req 12.1, KD-1).

        Hybrid claim protocol: recover_stale first, create a per-job ``O_EXCL``
        lock, re-read to confirm still ``pending``, write ``status=running`` with
        claim metadata, and **hold the lock** until terminal transition.
        """
        if not worker_id:
            raise ValueError("claim_next requires worker_id")

        self.recover_stale()

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
            if not self._try_lock(candidate.id):
                continue
            try:
                fresh = self._read_record(candidate.id)
                if fresh is None or fresh.status != "pending":
                    self._release_lock(candidate.id)
                    continue
                now = _now_iso()
                fresh.status = "running"
                fresh.claimed_at = now
                fresh.heartbeat_at = now
                fresh.claimed_by = worker_id
                fresh.claim_generation = fresh.claim_generation or 0
                fresh.updated_at = now
                self._write_record(fresh)
                return fresh
            except BaseException:
                self._release_lock(candidate.id)
                raise
        return None

    def heartbeat(
        self,
        job_id: str,
        worker_id: str,
        claim_generation: int,
    ) -> Job:
        """Update heartbeatAt when ownership matches (KD-14)."""
        current = self._require(job_id)
        if not _ownership_matches(current, worker_id, claim_generation):
            raise OwnershipError(
                f"heartbeat ownership mismatch for job {job_id} "
                f"(status={current.status}, claimedBy={current.claimed_by}, "
                f"gen={current.claim_generation})"
            )
        now = _now_iso()
        current.heartbeat_at = now
        current.updated_at = now
        self._write_record(current)
        return current

    def mark_running(self, job_id: str) -> Job:
        """No-op when already ``running`` without stripping fields (KD-17).

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

    def mark_completed(
        self,
        job_id: str,
        artifacts: list[str],
        worker_id: str,
        claim_generation: int,
    ) -> Job:
        """Record completion with ownership fencing (Req 12.3, KD-14)."""
        job = self._require(job_id)
        if not _ownership_matches(job, worker_id, claim_generation):
            raise OwnershipError(
                f"markCompleted ownership mismatch for job {job_id}"
            )
        job.clear_claim_fields()
        job.status = "completed"
        job.artifacts = list(artifacts)
        job.error = None
        job.updated_at = _now_iso()
        self._write_record(job)
        self._release_lock(job_id)
        return job

    def mark_failed(
        self,
        job_id: str,
        error: str,
        worker_id: str,
        claim_generation: int,
    ) -> Job:
        """Record failure with ownership fencing (Req 12.4, KD-14)."""
        job = self._require(job_id)
        if not _ownership_matches(job, worker_id, claim_generation):
            raise OwnershipError(
                f"markFailed ownership mismatch for job {job_id}"
            )
        job.clear_claim_fields()
        job.status = "failed"
        job.error = error
        job.updated_at = _now_iso()
        self._write_record(job)
        self._release_lock(job_id)
        return job

    def recover_stale(self, now: datetime | None = None) -> list[Job]:
        """Heal orphan locks and optionally requeue/fail expired running (KD-20).

        ``lease_recovery_enabled=False`` → orphanOnly (never steal running).
        ``lease_recovery_enabled=True`` → full KD-4 on expired leases.
        """
        now_ms = _now_ms(now)
        mode = "full" if self.lease_recovery_enabled else "orphanOnly"
        affected: list[Job] = []

        for job_id in self._all_job_ids_and_lock_stems():
            job = self._read_record(job_id)
            lock_present = self._lock_exists(job_id)

            if lock_present and self._may_break_lock(mode, job, job_id, now_ms):
                self._release_lock(job_id)

            if not self._try_lock(job_id):
                continue

            try:
                fresh = self._read_record(job_id)

                if mode == "orphanOnly":
                    # Clean locks only; never KD-4 running jobs.
                    self._release_lock(job_id)
                    if fresh is None or fresh.status != "running":
                        if fresh is not None:
                            affected.append(fresh)
                    continue

                # full mode
                if fresh is None:
                    self._release_lock(job_id)
                    continue
                if fresh.status in ("completed", "failed"):
                    self._release_lock(job_id)
                    affected.append(fresh)
                    continue
                if fresh.status == "pending":
                    self._release_lock(job_id)
                    affected.append(fresh)
                    continue

                # running
                if not self._lease_expired(fresh, now_ms):
                    self._release_lock(job_id)
                    continue

                max_rq = self._max_requeues_for(fresh.type)
                requeues = fresh.requeue_count or 0
                if requeues >= max_rq:
                    fresh.clear_claim_fields()
                    fresh.status = "failed"
                    fresh.error = "stale lease expired"
                    fresh.updated_at = (
                        now.isoformat().replace("+00:00", "Z")
                        if now is not None
                        else _now_iso()
                    )
                    self._write_record(fresh)
                    self._release_lock(job_id)
                    affected.append(fresh)
                else:
                    gen = (fresh.claim_generation or 0) + 1
                    fresh.clear_claim_fields()
                    fresh.status = "pending"
                    fresh.requeue_count = requeues + 1
                    fresh.claim_generation = gen
                    fresh.error = None
                    fresh.updated_at = (
                        now.isoformat().replace("+00:00", "Z")
                        if now is not None
                        else _now_iso()
                    )
                    self._write_record(fresh)
                    self._release_lock(job_id)
                    affected.append(fresh)
            except BaseException:
                self._release_lock(job_id)
                # Match Node: swallow per-job errors and continue scanning.
                continue

        return affected


def create_job_queue(config: QueueConfig | AppConfig | None = None) -> JobQueue:
    """Build a :class:`JobQueue` from configuration (Req 13.4).

    Accepts a :class:`QueueConfig`, a full :class:`AppConfig`, or ``None`` to
    load the default startup configuration. Only the ``file`` backend is
    supported in the MVP, matching the Node factory. Passes the full
    :class:`QueueConfig` so lease defaults are preserved (KD-16).
    """
    if config is None:
        config = load_config()
    if isinstance(config, AppConfig):
        config = config.queue
    if config.backend != "file":
        raise ValueError(f"Unknown queue backend: {config.backend}")
    return JobQueue(config)
