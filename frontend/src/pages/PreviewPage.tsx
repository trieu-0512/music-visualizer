/**
 * Video preview page (`frontend`, task 12.3).
 *
 * Fetches a project's `project-config.json` (via `client.getConfig`) plus the
 * `lyrics.json` and `audio-analysis.json` artifacts it references, then drives
 * the in-browser Remotion Player from those artifacts (Req 8.1). The Player is
 * bound to the format-agnostic `@music-visualizer/remotion` `Video` component,
 * which selects the template by `layout.template`; a landscape/portrait
 * selector switches the composition dimensions and template at runtime so the
 * preview matches the chosen `Video_Format` (Req 8.4).
 *
 * When the project has no generated config — `client.getConfig` throws
 * `ARTIFACT_NOT_READY` — the page shows a clear "configuration must be
 * generated before preview" message instead of the Player (Req 8.5).
 *
 * Asset paths in the config are project-relative storage paths; they are
 * rewritten to absolute API URLs before being handed to the Player (see
 * `components/previewAssets.ts`, which also documents the current
 * asset-serving limitation).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Player } from "@remotion/player";
import { Video } from "@music-visualizer/remotion/Video";
import type { VideoProps } from "@music-visualizer/remotion/Video";
import { FPS, durationInFrames } from "@music-visualizer/remotion/defaultProps";
import {
  validateAudioAnalysis,
  validateLyrics,
} from "@music-visualizer/shared";
import { ApiClientError } from "../api/index.js";
import type {
  AudioAnalysisJson,
  LyricsJson,
  ProjectConfigJson,
} from "../api/index.js";
import {
  PREVIEW_FORMATS,
  defaultPreviewFormatId,
  findPreviewFormat,
  resolveConfigAssetUrls,
  withTemplate,
} from "../components/previewAssets.js";
import type { PageProps, PageRegistration } from "./types.js";

/** The artifacts the preview is driven by, once all are loaded and valid. */
interface PreviewData {
  config: ProjectConfigJson;
  lyrics: LyricsJson;
  analysis: AudioAnalysisJson;
}

/** Distinguishes the "needs config" state from a generic load failure. */
type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: PreviewData }
  | { status: "needs-config" }
  | { status: "error"; message: string };

function PreviewPage({ context }: PageProps): JSX.Element {
  const { client, projectId, navigate } = context;
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [formatId, setFormatId] = useState<string>("landscape");

  const load = useCallback(async () => {
    if (!projectId) return;
    setState({ status: "loading" });
    try {
      const artifacts = await client.listArtifacts(projectId);
      if (!artifacts.artifacts.includes("project-config.json")) {
        setState({ status: "needs-config" });
        return;
      }

      const config = await client.getConfig(projectId);

      // Fetch the artifacts the composition is driven by (Req 8.1).
      const [lyricsRaw, analysisRaw] = await Promise.all([
        client.downloadArtifact(projectId, "lyrics.json").then(blobToJson),
        client.downloadArtifact(projectId, "audio-analysis.json").then(blobToJson),
      ]);

      const lyricsResult = validateLyrics(lyricsRaw);
      if (!lyricsResult.ok) {
        throw new Error("The lyrics.json artifact is malformed.");
      }
      const analysisResult = validateAudioAnalysis(analysisRaw);
      if (!analysisResult.ok) {
        throw new Error("The audio-analysis.json artifact is malformed.");
      }

      setFormatId(defaultPreviewFormatId(config.videoFormat));
      setState({
        status: "ready",
        data: {
          config,
          lyrics: lyricsResult.value,
          analysis: analysisResult.value,
        },
      });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "ARTIFACT_NOT_READY") {
        setState({ status: "needs-config" });
        return;
      }
      setState({ status: "error", message: toMessage(err) });
    }
  }, [client, projectId]);

  useEffect(() => {
    setState({ status: "idle" });
    if (projectId) {
      void load();
    }
  }, [projectId, load]);

  const format = findPreviewFormat(formatId);

  // Build the Player input props for the active format: rewrite asset paths to
  // loadable URLs and pin the template that matches the selected orientation.
  const inputProps = useMemo<VideoProps | null>(() => {
    if (state.status !== "ready") return null;
    const resolved = resolveConfigAssetUrls(client, projectId!, state.data.config);
    return {
      config: withTemplate(resolved, format.template),
      lyrics: state.data.lyrics,
      analysis: state.data.analysis,
    };
  }, [state, client, projectId, format.template]);

  if (!projectId) {
    return (
      <section className="page preview-page">
        <h2>Preview</h2>
        <p>Load a folder first to preview its video.</p>
        <button type="button" onClick={() => navigate("create")}>
          Go to folder load
        </button>
      </section>
    );
  }

  return (
    <section className="page preview-page">
      <h2>Preview</h2>
      <p>
        Previewing project <code>{projectId}</code>.
      </p>

      {state.status === "loading" && <p role="status">Loading preview…</p>}

      {state.status === "needs-config" && (
        <div className="preview-needs-config" role="status">
          <p className="not-ready">
            Configuration must be generated before preview. Generate the project
            configuration, then return here to preview the video.
          </p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state.status === "error" && (
        <div className="preview-error">
          <p className="error" role="alert">
            {state.message}
          </p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && inputProps && (
        <div className="preview-ready">
          <fieldset className="field preview-format">
            <legend>Preview format</legend>
            {PREVIEW_FORMATS.map((f) => (
              <label key={f.id} className="radio">
                <input
                  type="radio"
                  name="preview-format"
                  value={f.id}
                  checked={formatId === f.id}
                  onChange={() => setFormatId(f.id)}
                />
                {f.label}
              </label>
            ))}
          </fieldset>

          <div
            className="preview-player"
            data-testid="preview-player"
            data-template={format.template}
            data-width={format.width}
            data-height={format.height}
          >
            <Player
              component={Video}
              inputProps={inputProps}
              durationInFrames={durationInFrames(inputProps, FPS)}
              fps={FPS}
              compositionWidth={format.width}
              compositionHeight={format.height}
              controls
              acknowledgeRemotionLicense
              style={{ width: "100%", maxWidth: format.width, aspectRatio: `${format.width} / ${format.height}` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** Parse a downloaded artifact blob as JSON. */
async function blobToJson(blob: Blob): Promise<unknown> {
  const text = await blob.text();
  return JSON.parse(text) as unknown;
}

/** Turn a thrown value into a user-facing message, preferring API messages. */
function toMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Failed to load the preview.";
}

export const pageRegistration: PageRegistration = {
  id: "preview",
  label: "Preview",
  order: 2,
  requiresProject: true,
  component: PreviewPage,
};

export default PreviewPage;
