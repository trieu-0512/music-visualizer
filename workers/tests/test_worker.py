"""Unit tests for the Audio_Worker claim/dispatch loop (task 6.1 / PR-04).

Covers type dispatch, completion with produced artifacts, and try/except
failure recording on the job (Req 3.6, 6.7, 12.4).
"""

from __future__ import annotations

from pathlib import Path

import pytest

import src.worker as worker
from src.queue import Job, JobQueue
from src.store import AssetStore

WORKER_ID = "test-audio-worker"


@pytest.fixture
def env(tmp_path: Path) -> tuple[JobQueue, AssetStore]:
    queue = JobQueue(tmp_path / "jobs")
    # Keep tests fast: no background heartbeats during process_job.
    queue.heartbeat_interval_ms = 0
    store = AssetStore(tmp_path / "storage")
    return queue, store


@pytest.fixture(autouse=True)
def clean_dispatch():
    # Each test controls DISPATCH explicitly; restore it afterwards.
    saved = dict(worker.DISPATCH)
    worker.DISPATCH.clear()
    yield
    worker.DISPATCH.clear()
    worker.DISPATCH.update(saved)


def test_process_job_dispatches_by_type_and_completes(env) -> None:
    queue, store = env
    seen: list[str] = []

    def handle_transcribe(job: Job, s: AssetStore) -> list[str]:
        seen.append(job.type)
        s.write_json(job.project_id, "artifacts/lyrics.json", {"ok": True})
        return ["artifacts/lyrics.json"]

    worker.register_handler("transcribe", handle_transcribe)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_ID)
    assert claimed is not None

    worker.process_job(claimed, queue, store, worker_id=WORKER_ID)

    assert seen == ["transcribe"]
    done = queue.get(job.id)
    assert done is not None
    assert done.status == "completed"
    assert done.artifacts == ["artifacts/lyrics.json"]
    assert store.read_json("p", "artifacts/lyrics.json") == {"ok": True}


def test_process_job_records_failure_on_handler_exception(env) -> None:
    # Req 3.6, 6.7, 12.4: a handler exception is caught and recorded on the job.
    queue, store = env

    def boom(job: Job, s: AssetStore) -> list[str]:
        raise RuntimeError("whisperx failed to decode audio")

    worker.register_handler("transcribe", boom)
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_ID)
    assert claimed is not None

    worker.process_job(claimed, queue, store, worker_id=WORKER_ID)

    failed = queue.get(job.id)
    assert failed is not None
    assert failed.status == "failed"
    assert failed.error == "whisperx failed to decode audio"


def test_process_job_fails_when_no_handler_registered(env) -> None:
    queue, store = env
    job = queue.enqueue("p", "analyze")
    claimed = queue.claim_next(["analyze"], WORKER_ID)
    assert claimed is not None

    worker.process_job(claimed, queue, store, worker_id=WORKER_ID)

    failed = queue.get(job.id)
    assert failed is not None
    assert failed.status == "failed"
    assert "no handler registered" in (failed.error or "")


def test_run_worker_processes_until_stop(env) -> None:
    queue, store = env
    calls: list[str] = []

    def handle_analyze(job: Job, s: AssetStore) -> list[str]:
        calls.append(job.id)
        return ["artifacts/audio-analysis.json"]

    worker.register_handler("analyze", handle_analyze)
    job = queue.enqueue("p", "analyze")

    # Stop once the job is no longer pending so the loop terminates.
    def stop() -> bool:
        current = queue.get(job.id)
        return current is not None and current.status != "pending"

    worker.run_worker(
        queue,
        store,
        job_types=["analyze"],
        poll_interval=0,
        stop=stop,
        worker_id=WORKER_ID,
    )

    assert calls == [job.id]
    done = queue.get(job.id)
    assert done is not None and done.status == "completed"
    assert done.claimed_by is None


def test_run_worker_stops_immediately_when_stop_true(env) -> None:
    queue, store = env
    # No handlers needed: stop() is true on entry, so the loop returns at once.
    worker.run_worker(
        queue,
        store,
        job_types=["analyze"],
        poll_interval=0,
        stop=lambda: True,
        worker_id=WORKER_ID,
    )


def test_process_job_uses_claim_ownership(env) -> None:
    queue, store = env
    worker.register_handler(
        "transcribe", lambda job, s: ["artifacts/lyrics.json"]
    )
    job = queue.enqueue("p", "transcribe")
    claimed = queue.claim_next(["transcribe"], WORKER_ID)
    assert claimed is not None
    assert claimed.claimed_by == WORKER_ID

    worker.process_job(claimed, queue, store)

    done = queue.get(job.id)
    assert done is not None
    assert done.status == "completed"
