"""Unit tests for the Python Job_Queue view (task 6.1 / PR-04a/b/c).

Covers enqueue/get, the atomic claim lifecycle, ownership fencing, terminal
transitions retaining their payload (artifacts / error), stale recovery, and
the shared on-disk JSON record shape.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from src.config import QueueConfig
from src.queue import JobQueue, OwnershipError, create_job_queue

WORKER_A = "test-worker-a"
WORKER_B = "test-worker-b"


def test_enqueue_creates_pending_job_record(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("proj1", "transcribe", {"foo": "bar"})
    assert job.status == "pending"
    assert job.project_id == "proj1"
    assert job.type == "transcribe"
    assert job.params == {"foo": "bar"}
    assert job.artifacts == []
    # Persisted with the shared record shape used by the Node FileJobQueue.
    record = json.loads((tmp_path / f"{job.id}.json").read_text(encoding="utf-8"))
    assert record == {
        "id": job.id,
        "projectId": "proj1",
        "type": "transcribe",
        "status": "pending",
        "params": {"foo": "bar"},
        "artifacts": [],
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
        "claimGeneration": 0,
        "requeueCount": 0,
    }


def test_get_returns_none_for_unknown(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    assert queue.get("missing") is None


def test_enqueue_rejects_unknown_type(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    with pytest.raises(ValueError):
        queue.enqueue("p", "frobnicate")


def test_claim_next_returns_oldest_matching_type(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    first = queue.enqueue("p", "transcribe")
    second = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe", "analyze"], WORKER_A)
    assert claimed is not None
    # Oldest pending job (by createdAt then id) is claimed first.
    assert claimed.id in {first.id, second.id}
    assert claimed.created_at <= second.created_at
    # Hybrid claim: disk status is running and lock is held.
    assert claimed.status == "running"
    assert claimed.claimed_by == WORKER_A
    assert claimed.claim_generation == 0
    assert claimed.claimed_at is not None
    assert claimed.heartbeat_at is not None
    assert (tmp_path / f"{claimed.id}.lock").exists()
    reloaded = queue.get(claimed.id)
    assert reloaded is not None
    assert reloaded.status == "running"
    assert reloaded.claimed_by == WORKER_A


def test_claim_next_requires_worker_id(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    queue.enqueue("p", "transcribe")
    with pytest.raises(ValueError):
        queue.claim_next(["transcribe"], "")


def test_claim_next_filters_by_type(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    render = queue.enqueue("p", "render")
    claimed = queue.claim_next(["transcribe", "analyze"], WORKER_A)
    assert claimed is None
    # The render job is still claimable by a render worker.
    assert queue.claim_next(["render"], WORKER_A).id == render.id


def test_claim_is_exclusive(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    queue.enqueue("p", "transcribe")
    first = queue.claim_next(["transcribe"], WORKER_A)
    second = queue.claim_next(["transcribe"], WORKER_B)
    assert first is not None
    # Lock file prevents a second claim of the same (only) job.
    assert second is None


def test_lifecycle_pending_running_completed(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "analyze")
    claimed = queue.claim_next(["analyze"], WORKER_A)
    assert claimed is not None
    assert claimed.status == "running"
    assert (tmp_path / f"{job.id}.lock").exists()
    # mark_running is a no-op rewrite when already running (fields preserved).
    running = queue.mark_running(job.id)
    assert running.status == "running"
    assert running.claimed_by == WORKER_A
    completed = queue.mark_completed(
        job.id,
        ["artifacts/audio-analysis.json"],
        WORKER_A,
        claimed.claim_generation,
    )
    assert completed.status == "completed"
    assert completed.artifacts == ["artifacts/audio-analysis.json"]
    assert completed.claimed_by is None
    # Releasing the lock on completion lets a fresh pending job be claimed.
    assert not (tmp_path / f"{job.id}.lock").exists()


def test_mark_completed_round_trips_artifacts(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_A)
    assert claimed is not None
    artifacts = [
        "artifacts/whisperx.json",
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
    ]
    queue.mark_completed(job.id, artifacts, WORKER_A, claimed.claim_generation)
    reloaded = queue.get(job.id)
    assert reloaded is not None
    assert reloaded.status == "completed"
    assert reloaded.artifacts == artifacts
    assert reloaded.claimed_by is None
    assert reloaded.claim_generation == 0


def test_mark_failed_retains_error(tmp_path: Path) -> None:
    # Req 12.4: a failed job retains the error message describing the failure.
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_A)
    assert claimed is not None
    queue.mark_failed(
        job.id, "boom: whisperx exploded", WORKER_A, claimed.claim_generation
    )
    reloaded = queue.get(job.id)
    assert reloaded is not None
    assert reloaded.status == "failed"
    assert reloaded.error == "boom: whisperx exploded"


def test_mark_completed_rejects_wrong_owner(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "render")
    claimed = queue.claim_next(["render"], WORKER_A)
    assert claimed is not None
    with pytest.raises(OwnershipError):
        queue.mark_completed(job.id, [], WORKER_B, 0)


def test_heartbeat_updates_without_stripping_claim(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_A)
    assert claimed is not None
    beat = queue.heartbeat(job.id, WORKER_A, claimed.claim_generation)
    assert beat.claimed_by == WORKER_A
    assert beat.heartbeat_at is not None
    with pytest.raises(OwnershipError):
        queue.heartbeat(job.id, WORKER_B, claimed.claim_generation)


def test_mark_running_unknown_job_raises(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    with pytest.raises(KeyError):
        queue.mark_running("missing")


def test_list_by_project_isolates_and_orders(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    a1 = queue.enqueue("a", "transcribe")
    a2 = queue.enqueue("a", "analyze")
    queue.enqueue("b", "transcribe")
    listed = queue.list_by_project("a")
    assert {j.id for j in listed} == {a1.id, a2.id}
    # Ordered by ascending (createdAt, id).
    assert listed == sorted(listed, key=lambda j: (j.created_at, j.id))


def test_create_job_queue_from_queue_config(tmp_path: Path) -> None:
    queue = create_job_queue(
        QueueConfig(
            backend="file",
            dir=str(tmp_path),
            lease_ms=60_000,
            lease_recovery_enabled=False,
        )
    )
    assert isinstance(queue, JobQueue)
    assert queue.lease_ms == 60_000
    assert queue.lease_recovery_enabled is False


def test_create_job_queue_rejects_unknown_backend() -> None:
    with pytest.raises(ValueError):
        create_job_queue(QueueConfig(backend="bullmq", dir="x"))


def test_job_queue_dir_string_applies_defaults(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    assert queue.lease_ms == 120_000
    assert queue.heartbeat_interval_ms == 15_000
    assert queue.max_requeues_audio == 1
    assert queue.max_requeues_render == 0
    assert queue.lease_recovery_enabled is True


def test_recover_stale_orphan_only_clears_pending_lock(tmp_path: Path) -> None:
    queue = JobQueue(
        QueueConfig(
            backend="file",
            dir=str(tmp_path),
            lease_ms=120_000,
            lease_recovery_enabled=False,
        )
    )
    pending = queue.enqueue("p", "transcribe")
    lock = tmp_path / f"{pending.id}.lock"
    lock.write_text("", encoding="utf-8")
    queue.touch_lock_age(pending.id, 200_000)

    running_job = queue.enqueue("p", "analyze")
    claimed = queue.claim_next(["analyze"], WORKER_A)
    assert claimed is not None
    assert claimed.id == running_job.id

    affected = queue.recover_stale()
    assert not lock.exists()
    still = queue.get(running_job.id)
    assert still is not None
    assert still.status == "running"
    assert (tmp_path / f"{running_job.id}.lock").exists()
    assert any(j.id == pending.id for j in affected)


def test_recover_stale_full_fails_expired_render(tmp_path: Path) -> None:
    queue = JobQueue(
        QueueConfig(
            backend="file",
            dir=str(tmp_path),
            lease_ms=1000,
            lease_recovery_enabled=True,
            max_requeues_render=0,
            max_requeues_audio=1,
        )
    )
    job = queue.enqueue("p", "render")
    claimed = queue.claim_next(["render"], WORKER_A)
    assert claimed is not None

    stale_time = (datetime.now(timezone.utc) - timedelta(seconds=60)).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )
    record = json.loads((tmp_path / f"{job.id}.json").read_text(encoding="utf-8"))
    record["claimedAt"] = stale_time
    record["heartbeatAt"] = stale_time
    (tmp_path / f"{job.id}.json").write_text(
        json.dumps(record, indent=2), encoding="utf-8"
    )

    queue.recover_stale()
    after = queue.get(job.id)
    assert after is not None
    assert after.status == "failed"
    assert after.error is not None and "stale lease" in after.error.lower()
    assert not (tmp_path / f"{job.id}.lock").exists()


def test_late_mark_completed_after_reclaim_is_fenced(tmp_path: Path) -> None:
    queue = JobQueue(
        QueueConfig(
            backend="file",
            dir=str(tmp_path),
            lease_ms=1000,
            lease_recovery_enabled=True,
            max_requeues_audio=1,
            max_requeues_render=0,
        )
    )
    job = queue.enqueue("p", "transcribe")
    first = queue.claim_next(["transcribe"], WORKER_A)
    assert first is not None

    stale_time = (datetime.now(timezone.utc) - timedelta(seconds=60)).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )
    record = json.loads((tmp_path / f"{job.id}.json").read_text(encoding="utf-8"))
    record["claimedAt"] = stale_time
    record["heartbeatAt"] = stale_time
    (tmp_path / f"{job.id}.json").write_text(
        json.dumps(record, indent=2), encoding="utf-8"
    )

    queue.recover_stale()
    second = queue.claim_next(["transcribe"], WORKER_B)
    assert second is not None
    assert second.claimed_by == WORKER_B
    assert second.claim_generation == 1

    with pytest.raises(OwnershipError):
        queue.mark_completed(
            job.id, ["x"], WORKER_A, first.claim_generation
        )
    final = queue.get(job.id)
    assert final is not None
    assert final.status == "running"
    assert final.claimed_by == WORKER_B


def test_claim_fields_round_trip_in_json(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_A)
    assert claimed is not None
    raw = json.loads((tmp_path / f"{job.id}.json").read_text(encoding="utf-8"))
    assert raw["claimedBy"] == WORKER_A
    assert "claimedAt" in raw
    assert "heartbeatAt" in raw
    assert raw["claimGeneration"] == 0
    reloaded = queue.get(job.id)
    assert reloaded is not None
    assert reloaded.claimed_by == WORKER_A
    # Heartbeat must not strip claim fields.
    queue.heartbeat(job.id, WORKER_A, 0)
    again = queue.get(job.id)
    assert again is not None
    assert again.claimed_by == WORKER_A
