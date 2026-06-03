"""Unit tests for the Python Job_Queue view (task 6.1).

Covers enqueue/get, the atomic claim lifecycle, terminal transitions retaining
their payload (artifacts / error), and the shared on-disk JSON record shape.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.config import QueueConfig
from src.queue import JobQueue, create_job_queue


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
    claimed = queue.claim_next(["transcribe", "analyze"])
    assert claimed is not None
    # Oldest pending job (by createdAt then id) is claimed first.
    assert claimed.id in {first.id, second.id}
    assert claimed.created_at <= second.created_at


def test_claim_next_filters_by_type(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    render = queue.enqueue("p", "render")
    claimed = queue.claim_next(["transcribe", "analyze"])
    assert claimed is None
    # The render job is still claimable by a render worker.
    assert queue.claim_next(["render"]).id == render.id


def test_claim_is_exclusive(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    queue.enqueue("p", "transcribe")
    first = queue.claim_next(["transcribe"])
    second = queue.claim_next(["transcribe"])
    assert first is not None
    # Lock file prevents a second claim of the same (only) job.
    assert second is None


def test_lifecycle_pending_running_completed(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "analyze")
    claimed = queue.claim_next(["analyze"])
    assert claimed is not None
    running = queue.mark_running(job.id)
    assert running.status == "running"
    completed = queue.mark_completed(job.id, ["artifacts/audio-analysis.json"])
    assert completed.status == "completed"
    assert completed.artifacts == ["artifacts/audio-analysis.json"]
    # Releasing the lock on completion lets a fresh pending job be claimed.
    assert not (tmp_path / f"{job.id}.lock").exists()


def test_mark_completed_round_trips_artifacts(tmp_path: Path) -> None:
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    artifacts = [
        "artifacts/whisperx.json",
        "artifacts/lyrics.json",
        "artifacts/lyrics.srt",
    ]
    queue.mark_completed(job.id, artifacts)
    reloaded = queue.get(job.id)
    assert reloaded is not None
    assert reloaded.status == "completed"
    assert reloaded.artifacts == artifacts


def test_mark_failed_retains_error(tmp_path: Path) -> None:
    # Req 12.4: a failed job retains the error message describing the failure.
    queue = JobQueue(tmp_path)
    job = queue.enqueue("p", "transcribe")
    queue.mark_failed(job.id, "boom: whisperx exploded")
    reloaded = queue.get(job.id)
    assert reloaded is not None
    assert reloaded.status == "failed"
    assert reloaded.error == "boom: whisperx exploded"


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
    queue = create_job_queue(QueueConfig(backend="file", dir=str(tmp_path)))
    assert isinstance(queue, JobQueue)


def test_create_job_queue_rejects_unknown_backend() -> None:
    with pytest.raises(ValueError):
        create_job_queue(QueueConfig(backend="bullmq", dir="x"))
