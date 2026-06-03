// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectCreatePage from "./ProjectCreatePage.js";
import type { ApiClient, FolderImportResult } from "../api/index.js";
import type { PageContext } from "./types.js";

afterEach(cleanup);

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function makeContext(client: Partial<ApiClient>): {
  context: PageContext;
  navigate: ReturnType<typeof vi.fn>;
  setProjectId: ReturnType<typeof vi.fn>;
} {
  const navigate = vi.fn();
  const setProjectId = vi.fn();
  const context: PageContext = {
    client: client as ApiClient,
    projectId: null,
    setProjectId,
    navigate,
  };
  return { context, navigate, setProjectId };
}

function importResult(projectId = "proj-123"): FolderImportResult {
  return {
    project: {
      projectId,
      songName: "Alphabet Song",
      singerName: "Kids Choir",
      videoFormat: "both",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    readiness: {
      projectId,
      ready: true,
      present: [],
      missing: [],
    },
    config: null,
    artifacts: [],
  };
}

function fileAt(path: string, data = "data"): File {
  const file = new File([data], path.split("/").at(-1) ?? "file.bin");
  Object.defineProperty(file, "webkitRelativePath", {
    value: path,
    configurable: true,
  });
  return file;
}

function songFiles(prefix: string): File[] {
  return [
    fileAt(`${prefix}/metadata.json`, JSON.stringify({
      songName: "Alphabet Song",
      singerName: "Kids Choir",
      videoFormat: "both",
    })),
    fileAt(`${prefix}/assets/audio.wav`),
    fileAt(`${prefix}/assets/background.png`),
    fileAt(`${prefix}/assets/song-logo.svg`),
    fileAt(`${prefix}/assets/channel-logo.svg`),
    fileAt(`${prefix}/assets/original-lyrics.txt`, "A is for apple"),
    ...LETTERS.map((letter) => fileAt(`${prefix}/assets/letters/${letter}.svg`)),
  ];
}

function directSongFiles(prefix: string): File[] {
  return [
    fileAt(`${prefix}/metadata.json`, JSON.stringify({
      songName: "Direct Song",
      singerName: "Direct Choir",
      videoFormat: "landscape",
    })),
    fileAt(`${prefix}/audio.wav`),
    fileAt(`${prefix}/background.png`),
    fileAt(`${prefix}/song-logo.svg`),
    fileAt(`${prefix}/channel-logo.svg`),
    fileAt(`${prefix}/lyrics.txt`, "A is for apple"),
    ...LETTERS.map((letter) => fileAt(`${prefix}/${letter}.svg`)),
  ];
}

describe("ProjectCreatePage folder import", () => {
  it("shows song profiles, checks one folder, loads metadata, and imports that song", async () => {
    const selectedFiles = songFiles("nhac-thieu-nhi/alphabet-song");
    const otherFiles = songFiles("nhac-thieu-nhi/counting-song");
    const importFolder = vi.fn<ApiClient["importFolder"]>(async () =>
      importResult("proj-123"),
    );
    const { context, setProjectId } = makeContext({ importFolder });

    render(<ProjectCreatePage context={context} />);
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("Music library folder"), [
      ...selectedFiles,
      ...otherFiles,
    ]);

    const profiles = within(screen.getByRole("list", { name: "Song profiles" }));
    expect(profiles.getByText("alphabet song")).toBeInTheDocument();
    expect(profiles.getByText("counting song")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Check" })[0]!);
    await screen.findByDisplayValue("Alphabet Song");
    expect(screen.getByDisplayValue("Kids Choir")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export format" })).toHaveValue("both");

    await user.click(screen.getByRole("button", { name: "Load selected song" }));

    await waitFor(() => expect(importFolder).toHaveBeenCalledTimes(1));
    expect(importFolder.mock.calls[0]![0]).toEqual(selectedFiles);
    expect(importFolder.mock.calls[0]![1]).toEqual({
      songName: "Alphabet Song",
      singerName: "Kids Choir",
      videoFormat: "both",
    });
    expect(setProjectId).toHaveBeenCalledWith("proj-123");
    expect(await screen.findByText("proj-123")).toBeInTheDocument();
  });

  it("warns about missing files and disables import for the checked profile", async () => {
    const files = songFiles("sample-song").filter(
      (file) =>
        (file as File & { webkitRelativePath: string }).webkitRelativePath !==
        "sample-song/assets/background.png",
    );
    const importFolder = vi.fn<ApiClient["importFolder"]>(async () => importResult());
    const { context } = makeContext({ importFolder });

    render(<ProjectCreatePage context={context} />);
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("Music library folder"), files);

    const missing = within(screen.getByRole("list", { name: "Missing required files" }));
    expect(missing.getByText("background")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load selected song" })).toBeDisabled();
    expect(importFolder).not.toHaveBeenCalled();
  });

  it("accepts a song folder whose required files are directly inside the folder", async () => {
    const files = directSongFiles("nhac-thieu-nhi/direct-song");
    const importFolder = vi.fn<ApiClient["importFolder"]>(async () =>
      importResult("proj-direct"),
    );
    const { context } = makeContext({ importFolder });

    render(<ProjectCreatePage context={context} />);
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("Music library folder"), files);

    await screen.findByDisplayValue("Direct Song");
    expect(screen.getByDisplayValue("Direct Choir")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export format" })).toHaveValue("landscape");
    expect(screen.getByText("All required files are present.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load selected song" }));
    await waitFor(() => expect(importFolder).toHaveBeenCalledTimes(1));
    expect(importFolder.mock.calls[0]![0]).toEqual(files);
  });

  it("shows the API error message when import fails", async () => {
    const importFolder = vi.fn<ApiClient["importFolder"]>(async () => {
      throw new Error("server exploded");
    });
    const { context, setProjectId } = makeContext({ importFolder });

    render(<ProjectCreatePage context={context} />);
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("Music library folder"), songFiles("sample-song"));
    await screen.findByDisplayValue("Alphabet Song");
    await user.click(screen.getByRole("button", { name: "Load selected song" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("server exploded");
    expect(setProjectId).not.toHaveBeenCalled();
  });
});
