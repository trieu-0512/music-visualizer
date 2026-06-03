// @vitest-environment jsdom
/**
 * Component tests for the assets/readiness page (task 12.2).
 *
 * Renders the page with a stubbed {@link ApiClient}, asserts the per-role
 * upload controls render (including the 26 letters), and that uploading a file
 * calls `uploadAsset` and re-fetches readiness so the present/missing display
 * updates (Req 2.1–2.8).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssetsPage from "./AssetsPage.js";
import type { ApiClient, AssetUploadResult, ReadinessReport } from "../api/index.js";
import type { PageContext } from "./types.js";

afterEach(cleanup);

function makeContext(client: Partial<ApiClient>, projectId: string | null): PageContext {
  return {
    client: client as ApiClient,
    projectId,
    setProjectId: vi.fn(),
    navigate: vi.fn(),
  };
}

describe("AssetsPage", () => {
  it("prompts to create a project when none is active", () => {
    const context = makeContext({}, null);
    render(<AssetsPage context={context} />);
    expect(screen.getByText("Load a folder first to inspect or replace its assets.")).toBeInTheDocument();
  });

  it("renders a control for every role including the 26 letters", async () => {
    const getReadiness = vi.fn<() => Promise<ReadinessReport>>(async () => ({
      projectId: "p1",
      ready: false,
      present: [],
      missing: ["audio"],
    }));
    const context = makeContext({ getReadiness }, "p1");

    render(<AssetsPage context={context} />);
    await waitFor(() => expect(getReadiness).toHaveBeenCalled());

    // 5 primary roles + 26 letters = 31 file inputs.
    const inputs = screen.getAllByLabelText(/Upload /);
    expect(inputs).toHaveLength(31);
    expect(screen.getByLabelText("Upload Letter Z")).toBeInTheDocument();
  });

  it("uploads a selected file and refreshes readiness to reflect the new asset", async () => {
    const reports: ReadinessReport[] = [
      { projectId: "p1", ready: false, present: [], missing: ["audio", "background"] },
      { projectId: "p1", ready: false, present: ["audio"], missing: ["background"] },
    ];
    let call = 0;
    const getReadiness = vi.fn(async () => reports[Math.min(call++, reports.length - 1)]!);
    const uploadAsset = vi.fn<() => Promise<AssetUploadResult>>(async () => ({
      projectId: "p1",
      role: "audio",
      path: "assets/audio.mp3",
    }));
    const context = makeContext({ getReadiness, uploadAsset }, "p1");

    render(<AssetsPage context={context} />);
    const user = userEvent.setup();
    await waitFor(() => expect(getReadiness).toHaveBeenCalledTimes(1));

    // Initially audio is missing.
    const missingList = within(screen.getByRole("list", { name: "Missing roles" }));
    expect(missingList.getByText("audio")).toBeInTheDocument();

    const file = new File(["data"], "song.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText("Upload Audio (MP3/WAV)"), file);

    await waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(1));
    expect(uploadAsset).toHaveBeenCalledWith("p1", "audio", file, "song.mp3");

    // Readiness refetched (initial load + post-upload refresh).
    await waitFor(() => expect(getReadiness).toHaveBeenCalledTimes(2));
    const present = within(await screen.findByRole("list", { name: "Present roles" }));
    expect(present.getByText("audio")).toBeInTheDocument();
  });
});
