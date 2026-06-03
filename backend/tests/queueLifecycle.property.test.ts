import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FileJobQueue, type Job, type JobType } from "../src/queue/JobQueue.js";

/**
 * Feature: music-visualizer, Property 14: Queue lifecycle invariants hold for
 * any number of jobs.
 *
 * For any sequence of enqueue requests, each enqueue creates a job with a
 * unique id and initial status `pending`, every job's status is always one of
 * `pending | running | completed | failed`, and all enqueued jobs (across one
 * or many projects) are retained and independently trackable.
 *
 * Validates: Requirements 12.1, 12.2, 15.3
 */

const JOB_TYPES: JobType[] = ["transcribe", "analyze", "render"];
const VALID_STATUSES = new Set(["pending", "running", "completed", "failed"]);

/** Mirror of {@link FileJobQueue}'s internal ordering: oldest-first, id breaks ties. */
function byCreatedThenId(a: Job, b: Job): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

const jobSpecArb = fc.record({
  // A small pool of project ids so the "one or many projects" cases are both
  // exercised: sometimes all jobs share a project, sometimes they spread out.
  projectId: fc.constantFrom("p0", "p1", "p2", "p3"),
  type: fc.constantFrom(...JOB_TYPES),
});

describe("Property 14: Queue lifecycle invariants hold for any number of jobs (Req 12.1, 12.2, 15.3)", () => {
  it("retains every enqueued job with a unique id, valid status, and correct claim ordering", async () => {
    await fc.assert(
      fc.asyncProperty(
        // "any number of jobs" — including zero — across one or many projects.
        fc.array(jobSpecArb, { minLength: 0, maxLength: 20 }),
        // The subset of types a worker is willing to claim (possibly empty).
        fc.uniqueArray(fc.constantFrom(...JOB_TYPES), { minLength: 0, maxLength: 3 }),
        async (specs, claimTypes) => {
          const dir = await mkdtemp(join(tmpdir(), "mv-queue-prop-"));
          const queue = new FileJobQueue(dir);
          try {
            // --- enqueue: each job starts pending with a unique id (Req 12.1) ---
            const enqueued: Job[] = [];
            for (const spec of specs) {
              const job = await queue.enqueue({
                projectId: spec.projectId,
                type: spec.type,
                params: {},
              });
              enqueued.push(job);
            }

            const ids = enqueued.map((j) => j.id);
            expect(new Set(ids).size).toBe(ids.length); // unique ids

            // Every enqueued job is retrievable and starts pending (Req 12.1, 12.2).
            for (const job of enqueued) {
              expect(job.status).toBe("pending");
              expect(job.artifacts).toEqual([]);
              expect(VALID_STATUSES.has(job.status)).toBe(true);
              expect(await queue.get(job.id)).toEqual(job);
            }

            // listByProject returns exactly that project's jobs, oldest-first.
            const projectIds = [...new Set(specs.map((s) => s.projectId))];
            let retained = 0;
            for (const pid of projectIds) {
              const expectedForProject = enqueued
                .filter((j) => j.projectId === pid)
                .sort(byCreatedThenId)
                .map((j) => j.id);
              const listed = await queue.listByProject(pid);
              expect(listed.map((j) => j.id)).toEqual(expectedForProject);
              retained += listed.length;
            }
            // Many jobs across many projects are all retained (Req 15.3).
            expect(retained).toBe(enqueued.length);

            // --- claim: pending -> running, oldest matching type, no double-claim (Req 12.2) ---
            let pendingModel = [...enqueued].sort(byCreatedThenId);
            const claimedIds = new Set<string>();
            // Bound the loop generously to guard against an unexpected infinite claim.
            for (let guard = 0; guard <= enqueued.length + 1; guard++) {
              const expected = pendingModel.find((j) => claimTypes.includes(j.type));
              const claimed = await queue.claimNext(claimTypes);

              if (expected === undefined) {
                // No pending job matches the requested types -> nothing to claim.
                expect(claimed).toBeNull();
                break;
              }

              expect(claimed).not.toBeNull();
              expect(claimed!.id).toBe(expected.id); // oldest pending matching type
              expect(claimed!.status).toBe("running"); // valid pending -> running progression
              expect(claimedIds.has(claimed!.id)).toBe(false); // never double-claimed
              claimedIds.add(claimed!.id);

              // The running status is persisted and independently trackable.
              const persisted = await queue.get(claimed!.id);
              expect(persisted!.status).toBe("running");

              pendingModel = pendingModel.filter((j) => j.id !== claimed!.id);
            }

            // --- final invariant: nothing lost, every status remains valid ---
            let finalCount = 0;
            for (const pid of projectIds) {
              const listed = await queue.listByProject(pid);
              for (const job of listed) {
                expect(VALID_STATUSES.has(job.status)).toBe(true);
              }
              finalCount += listed.length;
            }
            expect(finalCount).toBe(enqueued.length);
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
    // This property is filesystem-heavy: each of the 100 runs creates a temp
    // queue dir and performs up to ~20 enqueue/claim cycles (write-temp +
    // rename + readdir + lock per op). In isolation it finishes in ~3-4s, but
    // when the whole backend suite runs concurrently the shared filesystem is
    // contended and it can exceed Vitest's 5s default. We give it generous
    // headroom rather than weakening coverage (numRuns stays at 100).
  }, 60_000);
});
