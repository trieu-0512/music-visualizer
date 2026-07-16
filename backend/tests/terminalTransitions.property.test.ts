import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { FileJobQueue, type JobType } from "../src/queue/JobQueue.js";

/**
 * Feature: music-visualizer, Property 15: Terminal job transitions round-trip
 * their payload.
 *
 * For any artifact list, marking a job completed then reading it returns status
 * `completed` with exactly that artifact list (Req 12.3); and for any error
 * string, marking a job failed then reading it returns status `failed` with
 * exactly that error message retained (Req 12.4). The round-trip is confirmed
 * by re-reading the persisted record through `get()`.
 *
 * Validates: Requirements 12.3, 12.4
 */

// Arbitrary job inputs covering all job types and arbitrary params payloads.
const jobInputArb = fc.record({
  projectId: fc.string({ minLength: 1 }),
  type: fc.constantFrom<JobType>("transcribe", "analyze", "render"),
  params: fc.dictionary(
    fc.string(),
    fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
    ),
  ),
});

// A terminal transition is either a completion carrying an arbitrary artifact
// list, or a failure carrying an arbitrary error message.
const terminalTransitionArb = fc.oneof(
  fc.record({
    kind: fc.constant<"completed">("completed"),
    artifacts: fc.array(fc.string()),
  }),
  fc.record({
    kind: fc.constant<"failed">("failed"),
    error: fc.string(),
  }),
);

describe("FileJobQueue terminal transitions (Req 12.3, 12.4)", () => {
  // Property 15: Terminal job transitions round-trip their payload.
  // Fresh queue dir per sample so recoverStale on claim stays O(1).
  it("round-trips the payload of completed and failed transitions through get()", async () => {
    await fc.assert(
      fc.asyncProperty(jobInputArb, terminalTransitionArb, async (input, transition) => {
        const dir = await mkdtemp(join(tmpdir(), "mv-jobqueue-terminal-"));
        const queue = new FileJobQueue({
          backend: "file",
          dir,
          leaseRecoveryEnabled: false,
        });
        try {
          const job = await queue.enqueue(input);
          const claimed = await queue.claimNext([input.type], { workerId: "prop-test" });
          expect(claimed?.id).toBe(job.id);
          const opts = {
            workerId: claimed!.claimedBy!,
            claimGeneration: claimed!.claimGeneration ?? 0,
          };

          if (transition.kind === "completed") {
            const returned = await queue.markCompleted(job.id, transition.artifacts, opts);
            expect(returned.status).toBe("completed");
            expect(returned.artifacts).toEqual(transition.artifacts);

            const persisted = await queue.get(job.id);
            expect(persisted).not.toBeNull();
            expect(persisted?.status).toBe("completed");
            expect(persisted?.artifacts).toEqual(transition.artifacts);
          } else {
            const returned = await queue.markFailed(job.id, transition.error, opts);
            expect(returned.status).toBe("failed");
            expect(returned.error).toBe(transition.error);

            const persisted = await queue.get(job.id);
            expect(persisted).not.toBeNull();
            expect(persisted?.status).toBe("failed");
            expect(persisted?.error).toBe(transition.error);
          }
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  }, 60_000);
});
