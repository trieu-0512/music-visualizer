/**
 * Video preview page (`frontend`, task 12.3).
 *
 * First tries the authoring-time `preview-data.json` contract and drives the
 * dedicated ABC Remotion composition before an MP4 exists. Projects using the
 * generic config contract continue through `project-config.json`, lyrics, and
 * analysis as a fallback. Both modes use the same Remotion composition that is
 * used by the headless renderer, so web preview and output cannot drift apart.
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
import {
  AbcPreviewVideo,
  abcPreviewDurationInFrames,
} from "@music-visualizer/remotion/AbcPreviewVideo";
import type { AbcPreviewData } from "@music-visualizer/remotion/AbcPreviewVideo";
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
  PreviewRenderJob,
} from "../api/index.js";
import {
  PREVIEW_FORMATS,
  defaultPreviewFormatId,
  findPreviewFormat,
  apiBaseUrl,
  resolveAssetUrl,
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
  | { status: "abc-ready"; data: AbcPreviewData }
  | { status: "needs-config" }
  | { status: "error"; message: string };

type AbcRenderMode = "sample" | "full";
const ABC_RENDER_POLL_INTERVAL_MS = 1000;

function PreviewPage({ context }: PageProps): JSX.Element {
  const { client, projectId, navigate } = context;
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [formatId, setFormatId] = useState<string>("landscape");
  const [abcRenderMode, setAbcRenderMode] = useState<AbcRenderMode>("sample");
  const [abcRenderJob, setAbcRenderJob] = useState<PreviewRenderJob | null>(null);
  const [abcRenderStarting, setAbcRenderStarting] = useState(false);
  const [abcRenderError, setAbcRenderError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setState({ status: "loading" });
    try {
      // The ABC composition is an authoring artifact: it must be previewable
      // before the render worker has produced any video artifact.
      if (typeof client.getPreviewData === "function") {
        try {
          const rawPreview = await client.getPreviewData(projectId);
          if (!isAbcPreviewData(rawPreview)) {
            throw new Error("The preview-data.json artifact is malformed.");
          }
          setState({
            status: "abc-ready",
            data: resolveAbcPreviewDataUrls(client, projectId, rawPreview),
          });
          return;
        } catch (previewError) {
          // A regular project may not have an authoring preview artifact yet;
          // retain the existing config preview path in that case.
          if (
            !(previewError instanceof ApiClientError) ||
            !["ARTIFACT_NOT_READY", "NOT_FOUND"].includes(previewError.code)
          ) {
            throw previewError;
          }
        }
      }

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
    setAbcRenderJob(null);
    setAbcRenderError(null);
    setAbcRenderStarting(false);
    if (projectId) {
      void load();
    }
  }, [projectId, load]);

  useEffect(() => {
    if (
      !projectId ||
      !abcRenderJob ||
      !["running", "cancelling"].includes(abcRenderJob.status) ||
      typeof client.getPreviewRender !== "function"
    ) {
      return;
    }
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const fresh = await client.getPreviewRender(projectId, abcRenderJob.id);
        if (!cancelled) setAbcRenderJob(fresh);
      } catch (err) {
        if (!cancelled) setAbcRenderError(toMessage(err));
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), ABC_RENDER_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [abcRenderJob?.id, abcRenderJob?.status, client, projectId]);

  const startAbcRender = async (): Promise<void> => {
    if (!projectId || typeof client.startPreviewRender !== "function") return;
    setAbcRenderStarting(true);
    setAbcRenderError(null);
    try {
      const options =
        abcRenderMode === "sample"
          ? { maxDurationSeconds: 8, resolution: "fullhd" as const }
          : { resolution: "4k" as const };
      const job = await client.startPreviewRender(projectId, options);
      setAbcRenderJob(job);
    } catch (err) {
      setAbcRenderError(toMessage(err));
    } finally {
      setAbcRenderStarting(false);
    }
  };

  const cancelAbcRender = async (): Promise<void> => {
    if (
      !projectId ||
      !abcRenderJob ||
      typeof client.cancelPreviewRender !== "function" ||
      !["running", "cancelling"].includes(abcRenderJob.status)
    ) {
      return;
    }
    try {
      const job = await client.cancelPreviewRender(projectId, abcRenderJob.id);
      setAbcRenderJob(job);
    } catch (err) {
      setAbcRenderError(toMessage(err));
    }
  };

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

  const abcInputProps = useMemo(() => {
    if (state.status !== "abc-ready") return null;
    return { data: state.data };
  }, [state]);

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
        <div className="preview-ready preview-workspace">
          <aside className="preview-inspector" aria-label="Preview details">
            <span className="preview-kicker">COMPOSITION</span>
            <h3>{state.data.config.metadata.songName}</h3>
            <p className="preview-muted">Standard Remotion template</p>
            <div className="preview-detail-list">
              <span>Format</span><strong>{format.label}</strong>
              <span>Timeline</span><strong>{state.data.analysis.duration.toFixed(1)}s</strong>
              <span>Source</span><strong>Project artifacts</strong>
            </div>
          </aside>
          <div className="preview-canvas-column">
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
        </div>
      )}

      {state.status === "abc-ready" && abcInputProps && (
        <div className="preview-ready preview-workspace">
          <aside className="preview-inspector" aria-label="ABC preview details">
            <div className="preview-inspector-title">
              <span className="preview-kicker">REMOTION PREVIEW</span>
              <h3>{state.data.metadata.title ?? state.data.metadata.songCode ?? "ABC"}</h3>
            </div>
            <div className="preview-detail-list" aria-label="Preview essentials">
              <span>Format</span><strong>16:9</strong>
              <span>Assets</span><strong>{Object.keys(state.data.letters).length}/26</strong>
              <span>Background</span><strong>{state.data.layout.bgBlur === 0 ? "Static" : "Clear"}</strong>
            </div>
            <div className="preview-checklist" aria-label="Preview checks">
              <span><i aria-hidden="true" />Alpha assets</span>
              <span><i aria-hidden="true" />Fixed lyric stage</span>
              <span><i aria-hidden="true" />Equal-height pairing</span>
            </div>
            {typeof client.startPreviewRender === "function" && (
              <div className="preview-render-panel" aria-label="Render preview">
                <div className="preview-render-header">
                  <span className="preview-kicker">OUTPUT</span>
                  <span className="preview-render-engine">H.264 / CRF 18 / low load</span>
                </div>
                <div className="preview-render-segmented" role="group" aria-label="Render duration">
                  <button
                    type="button"
                    className={abcRenderMode === "sample" ? "is-selected" : ""}
                    aria-pressed={abcRenderMode === "sample"}
                    onClick={() => setAbcRenderMode("sample")}
                    disabled={abcRenderStarting || abcRenderJob?.status === "running" || abcRenderJob?.status === "cancelling"}
                  >
                    Sample 8s / 1080p
                  </button>
                  <button
                    type="button"
                    className={abcRenderMode === "full" ? "is-selected" : ""}
                    aria-pressed={abcRenderMode === "full"}
                    onClick={() => setAbcRenderMode("full")}
                    disabled={abcRenderStarting || abcRenderJob?.status === "running" || abcRenderJob?.status === "cancelling"}
                  >
                    Full song / 4K
                  </button>
                </div>
                <div className="preview-render-actions">
                  <button
                    type="button"
                    className="preview-render-primary"
                    onClick={() => void startAbcRender()}
                    disabled={abcRenderStarting || abcRenderJob?.status === "running" || abcRenderJob?.status === "cancelling"}
                  >
                    {abcRenderStarting ? "Starting..." : "Render"}
                  </button>
                  {(abcRenderJob?.status === "running" || abcRenderJob?.status === "cancelling") && (
                    <button
                      type="button"
                      className="preview-render-cancel"
                      onClick={() => void cancelAbcRender()}
                      disabled={abcRenderJob.status === "cancelling"}
                    >
                      {abcRenderJob.status === "cancelling" ? "Stopping..." : "Stop"}
                    </button>
                  )}
                </div>
                {abcRenderJob && (
                  <div className="preview-render-status" role="status" aria-live="polite">
                    <div className="preview-render-status-line">
                      <strong>{abcRenderJob.percent.toFixed(1)}%</strong>
                      <span>{formatRenderEta(abcRenderJob.etaMs)}</span>
                    </div>
                    <div
                      className="preview-render-progress"
                      role="progressbar"
                      aria-label="Render progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={abcRenderJob.percent}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, abcRenderJob.percent))}%` }} />
                    </div>
                    <span className="preview-render-stage">{abcRenderJob.stage}</span>
                    {abcRenderJob.status === "completed" && (
                      <a
                        className="preview-render-output"
                        href={previewRenderOutputHref(client, projectId, abcRenderJob)}
                        download
                      >
                        Open MP4
                      </a>
                    )}
                    {abcRenderJob.error && <span className="error">{abcRenderJob.error}</span>}
                  </div>
                )}
                {abcRenderError && <p className="error" role="alert">{abcRenderError}</p>}
              </div>
            )}
          </aside>
          <div className="preview-canvas-column">
            <div className="preview-canvas-heading">
              <div>
                <span className="preview-kicker">LIVE CANVAS</span>
                <p>Authoring composition</p>
              </div>
              <span className="preview-live-dot">LIVE</span>
            </div>
            <div
              className="preview-player preview-player-abc"
              data-testid="preview-player"
              data-preview-mode="abc"
              data-width={state.data.layout.canvasWidth}
              data-height={state.data.layout.canvasHeight}
            >
              <Player
                component={AbcPreviewVideo}
                inputProps={abcInputProps}
                durationInFrames={abcPreviewDurationInFrames(abcInputProps, FPS)}
                fps={FPS}
                compositionWidth={state.data.layout.canvasWidth}
                compositionHeight={state.data.layout.canvasHeight}
                controls
                acknowledgeRemotionLicense
                style={{
                  width: "100%",
                  aspectRatio: `${state.data.layout.canvasWidth} / ${state.data.layout.canvasHeight}`,
                }}
              />
            </div>
            <div className="preview-canvas-footer">
              <span>Remotion preview</span>
              <span>16:9 / 60 fps</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function isAbcPreviewData(value: unknown): value is AbcPreviewData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AbcPreviewData>;
  return (
    typeof candidate.metadata === "object" && candidate.metadata !== null &&
    typeof candidate.assets === "object" && candidate.assets !== null &&
    typeof candidate.letters === "object" && candidate.letters !== null &&
    Array.isArray(candidate.lines) &&
    typeof candidate.layout === "object" && candidate.layout !== null &&
    typeof candidate.layout.canvasWidth === "number" &&
    typeof candidate.layout.canvasHeight === "number"
  );
}

function resolveAbcPreviewDataUrls(
  client: Parameters<typeof resolveConfigAssetUrls>[0],
  projectId: string,
  data: AbcPreviewData,
): AbcPreviewData {
  const base = apiBaseUrl(client, projectId);
  const resolve = (path?: string): string | undefined =>
    path ? resolveAssetUrl(base, projectId, path) : path;
  return {
    ...data,
    assets: {
      ...data.assets,
      background: resolve(data.assets.background),
      backgroundRender: resolve(data.assets.backgroundRender),
      songLogo: resolve(data.assets.songLogo),
      audio: resolve(data.assets.audio),
    },
    letters: Object.fromEntries(
      Object.entries(data.letters).map(([key, pair]) => [
        key,
        {
          ...pair,
          letter: { ...pair.letter, src: resolve(pair.letter.src) ?? pair.letter.src },
          object: { ...pair.object, src: resolve(pair.object.src) ?? pair.object.src },
        },
      ]),
    ),
  };
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

function formatRenderEta(etaMs: number): string {
  if (!Number.isFinite(etaMs) || etaMs <= 0) return "ETA --";
  const totalSeconds = Math.ceil(etaMs / 1000);
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `ETA ${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `ETA ${minutes}m ${seconds}s` : `ETA ${seconds}s`;
}

function previewRenderOutputHref(
  client: PageProps["context"]["client"],
  projectId: string,
  job: PreviewRenderJob,
): string {
  if (/^(https?:|blob:|data:)/i.test(job.outputUrl)) return job.outputUrl;
  if (typeof client.previewRenderOutputUrl === "function") {
    return client.previewRenderOutputUrl(projectId, job.id);
  }
  return job.outputUrl;
}

export const pageRegistration: PageRegistration = {
  id: "preview",
  label: "Preview",
  order: 2,
  requiresProject: true,
  component: PreviewPage,
};

export default PreviewPage;
