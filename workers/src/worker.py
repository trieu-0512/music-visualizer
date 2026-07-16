"""Audio_Worker claim loop and type dispatch (Req 3.6, 6.7, 12.4).

The worker is a long-running loop that claims ``transcribe`` / ``analyze`` jobs
from the Job_Queue and dispatches by type. Each handler reads inputs and writes
artifacts through the Python :class:`~src.store.AssetStore` view of the
Asset_Store address space, returning the list of produced artifact paths.

Every handler invocation is wrapped in ``try/except`` so that any failure is
recorded on the job via ``mark_failed`` with a descriptive message (Req 3.6 for
transcription, Req 6.7-style failure handling for analysis, Req 12.4 for the
queue retaining the error), rather than crashing the loop.

Handler modules are loaded lazily. Import failures are **not** swallowed: they
are logged and a failing stub is registered so jobs get a clear error message
(Architecture Upgrade KD-11 / PR-03b). Set ``MV_STRICT_HANDLERS=1`` to fail
fast on worker boot when a default handler cannot be imported.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Callable, Protocol

from src.queue import (
    Job,
    JobQueue,
    OwnershipError,
    create_job_queue,
    default_worker_id,
)
from src.store import AssetStore, create_asset_store

logger = logging.getLogger(__name__)

# Seconds to sleep when the queue has no claimable job, before polling again.
POLL_INTERVAL = 1.0

# The job types this worker is responsible for. Render jobs are handled by a
# separate render worker (task 10.6).
WORKER_JOB_TYPES = ["transcribe", "analyze"]


class Handler(Protocol):
    """A job handler: read inputs, write artifacts, return their paths."""

    def __call__(self, job: Job, store: AssetStore) -> list[str]: ...


# Registry of type -> handler. Populated lazily by ``_load_default_handlers`` so
# that the heavy WhisperX/librosa imports only happen when a job of that type is
# actually dispatched. Tests and later tasks may also register directly.
DISPATCH: dict[str, Handler] = {}


def register_handler(job_type: str, handler: Handler) -> None:
    """Register (or replace) the handler for a job type."""
    DISPATCH[job_type] = handler


def _failing_handler(job_type: str, reason: str) -> Handler:
    """Return a handler that always fails with an install/import guidance message."""

    def handler(_job: Job, _store: AssetStore) -> list[str]:
        raise RuntimeError(
            f"Handler for '{job_type}' is unavailable: {reason}. "
            "Install worker dependencies (see workers/requirements.txt) and restart."
        )

    return handler


def _load_default_handlers() -> None:
    """Lazily wire the real handlers from their modules if not yet registered.

    Imports are performed inside the function so that the dispatch seam stays
    usable (and testable) without always loading heavy audio stacks. Import
    failures log at error level and register a failing stub (KD-11).
    """
    strict = os.environ.get("MV_STRICT_HANDLERS", "").strip() in {"1", "true", "TRUE", "yes"}

    if "transcribe" not in DISPATCH:
        try:
            from src.transcribe import handle_transcribe  # type: ignore

            register_handler("transcribe", handle_transcribe)
        except Exception as exc:
            logger.error("Failed to load transcribe handler: %s", exc, exc_info=True)
            if strict:
                raise
            register_handler("transcribe", _failing_handler("transcribe", str(exc)))

    if "analyze" not in DISPATCH:
        try:
            from src.analyze import handle_analyze  # type: ignore

            register_handler("analyze", handle_analyze)
        except Exception as exc:
            logger.error("Failed to load analyze handler: %s", exc, exc_info=True)
            if strict:
                raise
            register_handler("analyze", _failing_handler("analyze", str(exc)))


def _ownership_from_job(job: Job, worker_id: str) -> tuple[str, int]:
    return (job.claimed_by or worker_id, job.claim_generation or 0)


def process_job(
    job: Job,
    queue: JobQueue,
    store: AssetStore,
    *,
    worker_id: str | None = None,
) -> None:
    """Run a single claimed job, recording success or failure on it.

    Hybrid claim already set status to ``running`` under lock; ``mark_running``
    is a no-op when already running. Ownership opts come from the claimed job
    (KD-22). A heartbeat loop runs while the handler executes (PR-04c).
    """
    wid = worker_id or job.claimed_by or default_worker_id()
    own_worker_id, claim_generation = _ownership_from_job(job, wid)

    stop_heartbeat = threading.Event()
    interval_ms = getattr(queue, "heartbeat_interval_ms", 15_000) or 0

    def _heartbeat_loop() -> None:
        # First beat after one interval (claim already set heartbeatAt).
        while not stop_heartbeat.wait(interval_ms / 1000.0):
            try:
                queue.heartbeat(job.id, own_worker_id, claim_generation)
            except OwnershipError:
                break
            except Exception:
                logger.warning(
                    "heartbeat failed for job %s", job.id, exc_info=True
                )

    heartbeat_thread: threading.Thread | None = None
    if interval_ms > 0:
        heartbeat_thread = threading.Thread(
            target=_heartbeat_loop,
            name=f"heartbeat-{job.id}",
            daemon=True,
        )
        heartbeat_thread.start()

    try:
        # No-op rewrite when claim_next already transitioned to running (PR-03).
        queue.mark_running(job.id)
        handler = DISPATCH.get(job.type)
        if handler is None:
            raise KeyError(f"no handler registered for job type: {job.type}")
        artifacts = handler(job, store)
        queue.mark_completed(job.id, artifacts, own_worker_id, claim_generation)
    except Exception as exc:  # Req 3.6, 6.7, 12.4 failure handling
        try:
            queue.mark_failed(job.id, str(exc), own_worker_id, claim_generation)
        except OwnershipError:
            # Claim stolen after recover — do not clobber the new owner.
            logger.warning(
                "mark_failed ownership lost for job %s: %s", job.id, exc
            )
    finally:
        stop_heartbeat.set()
        if heartbeat_thread is not None:
            heartbeat_thread.join(timeout=1.0)


def run_worker(
    queue: JobQueue | None = None,
    store: AssetStore | None = None,
    *,
    job_types: list[str] | None = None,
    poll_interval: float = POLL_INTERVAL,
    stop: Callable[[], bool] | None = None,
    worker_id: str | None = None,
) -> None:
    """Run the claim/dispatch loop until ``stop`` returns ``True``.

    ``queue`` and ``store`` default to instances built from startup config
    (Req 13.4). ``stop`` is an optional predicate that lets callers and tests
    end the loop deterministically; when omitted the loop runs forever.

    Boot calls ``recover_stale`` once (PR-04b). Claims pass a stable
    ``worker_id`` and handlers heartbeats while running (PR-04c).
    """
    queue = queue or create_job_queue()
    store = store or create_asset_store()
    types = job_types or WORKER_JOB_TYPES
    wid = worker_id or default_worker_id()
    _load_default_handlers()

    # Boot recover (orphanOnly or full depending on queue config) — KD-15.
    try:
        queue.recover_stale()
    except Exception:
        logger.warning("boot recover_stale failed", exc_info=True)

    while True:
        if stop is not None and stop():
            return
        job = queue.claim_next(types, wid)
        if job is None:
            if stop is not None and stop():
                return
            time.sleep(poll_interval)
            continue
        process_job(job, queue, store, worker_id=wid)


if __name__ == "__main__":  # pragma: no cover - manual entry point
    logging.basicConfig(level=logging.INFO)
    run_worker()
