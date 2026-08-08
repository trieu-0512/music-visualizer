// @vitest-environment jsdom
/**
 * Component tests for the jobs + artifacts page (task 12.4).
 *
 * Renders the page with a stubbed {@link ApiClient} and verifies that:
 *  - triggering a job calls `createJob` and shows the new job (Req 9.1, 12.1);
 *  - the tracked job is polled with `getJob`, transitioning from a non-terminal
 *    status to `completed`, after which the artifact list is refreshed
 *    (Req 12.2, 11.1);
 *  - available artifacts render as download links pointing at `artifactUrl`
 *    (Req 11.1, 11.2);
 *  - a PRECONDITION_FAILED error from `createJob` is surfaced to the user.
 *
 * Real timers are used with `waitFor` (timeout > the poll interval) so the
 * status transition is observed exactly as it happens at runtime.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsPage, { POLL_INTERVAL_MS } from "./JobsPage.js";
import { ApiClientError } from "../api/index.js";
import type { ApiClient, ArtifactList, Job, PipelineRun } from "../api/index.js";
import type { PageContext } from "./types.js";

afterEach(cleanup);

function makeContext(client: Partial<ApiClient>, projectId: string | null): PageContext {
  return {
    client: {
      listProjectJobs: async () => [],
      getPipeline: async () => null,
      ...client,
    } as ApiClient,
    projectId,
    setProjectId: vi.fn(),
    navigate: vi.fn(),
  };
}

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "job-1",
    projectId: "p1",
    type: "transcribe",
    status: "pending",
    params: {},
    artifacts: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("JobsPage", () => {
  it("prompts to create a project when none is active", () => {
    const context = makeContext({}, null);
    render(<JobsPage context={context} />);
    expect(
      screen.getByText("Load a folder first to run jobs and download artifacts."),
    ).toBeInTheDocument();
  });

  it("triggers a transcribe job via createJob and tracks it", async () => {
    const createJob = vi.fn<() => Promise<Job>>(async () =>
      makeJob({ id: "job-1", type: "transcribe", status: "pending" }),
    );
    const getJob = vi.fn<() => Promise<Job>>(async () =>
      makeJob({ id: "job-1", type: "transcribe", status: "running" }),
    );
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(async () => ({
      projectId: "p1",
      artifacts: [],
    }));
    const listProjectJobs = vi.fn<() => Promise<Job[]>>(async () => []);
    const context = makeContext(
      { createJob, getJob, listArtifacts, listProjectJobs },
      "p1",
    );

    render(<JobsPage context={context} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Transcribe" }));

    await waitFor(() => expect(createJob).toHaveBeenCalledTimes(1));
    expect(createJob).toHaveBeenCalledWith("p1", { type: "transcribe" });

    const list = within(await screen.findByRole("list", { name: "Job status" }));
    expect(list.getByText("Transcribe")).toBeInTheDocument();
  });

  it("starts a persistent backend pipeline and follows it to completion", async () => {
    const running: PipelineRun = {
      id: "run-1",
      projectId: "p1",
      status: "running",
      step: "transcribe-analyze",
      renderFormat: "both",
      jobs: { transcribe: "job-transcribe", analyze: "job-analyze" },
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    };
    const completed: PipelineRun = {
      ...running,
      status: "completed",
      step: "completed",
      jobs: { ...running.jobs, render: "job-render" },
      updatedAt: "2026-08-08T00:00:01.000Z",
    };
    const startPipeline = vi.fn(async () => running);
    let pipelineRead = 0;
    const getPipeline = vi.fn(async () => (pipelineRead++ === 0 ? null : completed));
    const listProjectJobs = vi.fn<() => Promise<Job[]>>(async () => []);
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(async () => ({
      projectId: "p1",
      artifacts: [],
    }));
    const context = makeContext(
      { startPipeline, getPipeline, listProjectJobs, listArtifacts },
      "p1",
    );

    render(<JobsPage context={context} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Run full pipeline" }));

    await waitFor(() => expect(startPipeline).toHaveBeenCalledWith("p1", { format: "both" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Pipeline status: Completed"),
    );
    expect(getPipeline).toHaveBeenCalled();
  });

  it("sends the selected format when triggering a render job", async () => {
    const createJob = vi.fn<() => Promise<Job>>(async () =>
      makeJob({ id: "job-r", type: "render", status: "completed" }),
    );
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(async () => ({
      projectId: "p1",
      artifacts: [],
    }));
    const context = makeContext({ createJob, listArtifacts }, "p1");

    render(<JobsPage context={context} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Render format"), "portrait");
    await user.click(screen.getByRole("button", { name: "Render" }));

    await waitFor(() => expect(createJob).toHaveBeenCalledTimes(1));
    expect(createJob).toHaveBeenCalledWith("p1", { type: "render", params: { format: "portrait" } });
  });

  it("polls getJob until the job completes and then refreshes artifacts", async () => {
    const createJob = vi.fn<() => Promise<Job>>(async () =>
      makeJob({ id: "job-1", type: "analyze", status: "pending" }),
    );
    // First poll: still running. Second poll: completed.
    const statuses: Job["status"][] = ["running", "completed"];
    let pollCall = 0;
    const getJob = vi.fn<() => Promise<Job>>(async () =>
      makeJob({
        id: "job-1",
        type: "analyze",
        status: statuses[Math.min(pollCall++, statuses.length - 1)]!,
      }),
    );
    // Artifacts appear only after the job completes.
    const artifactLists: ArtifactList[] = [
      { projectId: "p1", artifacts: [] },
      { projectId: "p1", artifacts: ["audio-analysis.json"] },
    ];
    let listCall = 0;
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(
      async () => artifactLists[Math.min(listCall++, artifactLists.length - 1)]!,
    );
    const artifactUrl = vi.fn(
      (projectId: string, name: string) => `http://api.test/projects/${projectId}/artifacts/${name}`,
    );
    const context = makeContext({ createJob, getJob, listArtifacts, artifactUrl }, "p1");

    render(<JobsPage context={context} />);
    const user = userEvent.setup();
    // Initial mount lists artifacts (empty).
    await waitFor(() => expect(listArtifacts).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await waitFor(() => expect(createJob).toHaveBeenCalledTimes(1));

    const timeout = POLL_INTERVAL_MS * 4;
    // The job eventually reaches the completed state via polling.
    const statusList = await screen.findByRole("list", { name: "Job status" });
    await waitFor(
      () => expect(within(statusList).getByText("completed")).toBeInTheDocument(),
      { timeout },
    );
    expect(getJob).toHaveBeenCalled();

    // After completion, artifacts are refreshed and rendered as download links.
    const link = await screen.findByRole("link", { name: "audio-analysis.json" });
    expect(link).toHaveAttribute(
      "href",
      "http://api.test/projects/p1/artifacts/audio-analysis.json",
    );
  });

  it("surfaces a PRECONDITION_FAILED error from createJob", async () => {
    const createJob = vi.fn<() => Promise<Job>>(async () => {
      throw new ApiClientError(
        "PRECONDITION_FAILED",
        "an Audio_Asset is required before transcription",
        412,
      );
    });
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(async () => ({
      projectId: "p1",
      artifacts: [],
    }));
    const context = makeContext({ createJob, listArtifacts }, "p1");

    render(<JobsPage context={context} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Transcribe" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("an Audio_Asset is required before transcription");
  });

  it("renders available artifacts as download links on mount", async () => {
    const listArtifacts = vi.fn<() => Promise<ArtifactList>>(async () => ({
      projectId: "p1",
      artifacts: ["lyrics.json", "final-9x16-fullhd-60fps.mp4"],
    }));
    const artifactUrl = vi.fn(
      (projectId: string, name: string) => `http://api.test/projects/${projectId}/artifacts/${name}`,
    );
    const context = makeContext({ listArtifacts, artifactUrl }, "p1");

    render(<JobsPage context={context} />);

    const list = within(await screen.findByRole("list", { name: "Available artifacts" }));
    expect(list.getByRole("link", { name: "lyrics.json" })).toHaveAttribute(
      "href",
      "http://api.test/projects/p1/artifacts/lyrics.json",
    );
    expect(list.getByRole("link", { name: "final-9x16-fullhd-60fps.mp4" })).toBeInTheDocument();
  });
});
