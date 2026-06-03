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
  let dir: string;
  let queue: FileJobQueue;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mv-jobqueue-terminal-"));
    queue = new FileJobQueue(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // Property 15: Terminal job transitions round-trip their payload.
  it("round-trips the payload of completed and failed transitions through get()", async () => {
    await fc.assert(
      fc.asyncProperty(jobInputArb, terminalTransitionArb, async (input, transition) => {
        const job = await queue.enqueue(input);

        if (transition.kind === "completed") {
          const returned = await queue.markCompleted(job.id, transition.artifacts);
          // The value returned by the transition reflects the terminal state.
          expect(returned.status).toBe("completed");
          expect(returned.artifacts).toEqual(transition.artifacts);

          // Re-read from disk: persistence retains status and the exact list.
          const persisted = await queue.get(job.id);
          expect(persisted).not.toBeNull();
          expect(persisted?.status).toBe("completed");
          expect(persisted?.artifacts).toEqual(transition.artifacts);
        } else {
          const returned = await queue.markFailed(job.id, transition.error);
          expect(returned.status).toBe("failed");
          expect(returned.error).toBe(transition.error);

          // Re-read from disk: persistence retains status and the exact message.
          const persisted = await queue.get(job.id);
          expect(persisted).not.toBeNull();
          expect(persisted?.status).toBe("failed");
          expect(persisted?.error).toBe(transition.error);
        }
      }),
      { numRuns: 200 },
    );
  }, 30_000);
});
