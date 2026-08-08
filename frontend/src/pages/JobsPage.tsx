/**
 * Jobs + artifacts page (`frontend`).
 *
 * Lets the user trigger processing/render jobs individually or run the full
 * prepare-assets -> transcribe/analyze -> config -> render pipeline via `client.createJob` (Req 9.1, 12.1). PRECONDITION_FAILED
 * responses (no Audio_Asset, or no Project_Config_Json for render) are surfaced
 * with their API message so the user knows what is missing.
 *
 * After a job is created it is tracked and polled with `client.getJob` on an
 * interval, displaying the lifecycle status - pending / running / completed /
 * failed - and the recorded error on failure; polling stops once every tracked
 * job reaches a terminal state (Req 12.2). When a job completes, the artifact
 * list is refreshed.
 *
 * The available artifacts (`client.listArtifacts`) are listed as download links
 * pointing at `client.artifactUrl`, so the user can fetch any generated output
 * for the project (Req 11.1, 11.2).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { ApiClientError } from "../api/index.js";
import type {
  ArtifactName,
  CreateJobRequest,
  Job,
  JobStatus,
  JobType,
  PipelineRun,
  VideoFormat,
} from "../api/index.js";
import { JobStatusList } from "../components/JobStatusList.js";
import type { PageProps, PageRegistration } from "./types.js";

/** How often (ms) tracked, non-terminal jobs are re-polled for status. */
export const POLL_INTERVAL_MS = 1500;
/** Faster polling used by the one-click sequential pipeline controller. */
export const PIPELINE_POLL_INTERVAL_MS = 750;

const JOB_TYPES: { type: JobType; label: string }[] = [
  { type: "prepare-assets", label: "Prepare ABC assets" },
  { type: "transcribe", label: "Transcribe" },
  { type: "analyze", label: "Analyze" },
  { type: "render", label: "Render" },
];

const RENDER_FORMATS: { value: VideoFormat; label: string }[] = [
  { value: "landscape", label: "Landscape (Full HD, 2K, 4K)" },
  { value: "portrait", label: "Portrait (Full HD, 2K, 4K)" },
  { value: "both", label: "Both (all outputs)" },
];

/** A job is terminal once it can no longer change state (Req 12.2). */
function isTerminal(status: JobStatus): boolean {
  return status === "completed" || status === "failed";
}

function pipelineStepLabel(run: PipelineRun): string {
  const labels: Record<PipelineRun["step"], string> = {
    "prepare-assets": "Preparing ABC assets",
    "transcribe-analyze": "Transcribing and analyzing audio",
    "build-config": "Building render config",
    render: "Rendering video",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[run.step];
}

function JobsPage({ context }: PageProps): JSX.Element {
  const { client, projectId, navigate } = context;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [busyType, setBusyType] = useState<JobType | null>(null);
  const [buildingConfig, setBuildingConfig] = useState(false);
  const [pipelineRun, setPipelineRun] = useState<PipelineRun | null>(null);
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const pipelineRunning = pipelineStarting || pipelineRun?.status === "running";
  const pipelineStep = pipelineRun ? pipelineStepLabel(pipelineRun) : null;
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [renderFormat, setRenderFormat] = useState<VideoFormat>("both");

  const [artifacts, setArtifacts] = useState<ArtifactName[]>([]);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  // Keep the latest jobs accessible to the polling callback without making it
  // re-subscribe on every status change.
  const jobsRef = useRef<Job[]>(jobs);
  jobsRef.current = jobs;

  const refreshArtifacts = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setArtifactError(null);
    try {
      const list = await client.listArtifacts(projectId);
      setArtifacts(list.artifacts);
    } catch (err) {
      setArtifactError(toMessage(err, "Failed to list artifacts."));
    }
  }, [client, projectId]);

  // Reset state and load artifacts, jobs, and persistent pipeline state when the project changes.
  useEffect(() => {
    setJobs([]);
    setPipelineRun(null);
    setPipelineStarting(false);
    setArtifacts([]);
    setTriggerError(null);
    setArtifactError(null);
    if (!projectId) return;

    void refreshArtifacts();

    let cancelled = false;
    void client.getPipeline(projectId).then((run) => {
      if (!cancelled) setPipelineRun(run);
    }).catch(() => {
      // Pipeline hydration is optional; the page still supports individual jobs.
    });
    void (async () => {
      try {
        const existing = await client.listProjectJobs(projectId);
        if (!cancelled) {
          // Newest first for display; API order is not specified.
          setJobs(
            [...existing].sort((a, b) =>
              a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
            ),
          );
        }
      } catch {
        // Listing is optional hydration; ignore failures (e.g. offline API).
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshArtifacts, client]);

  // Poll every tracked, non-terminal job once and merge the fresh status in.
  const pollOnce = useCallback(async (): Promise<void> => {
    const active = jobsRef.current.filter((job) => !isTerminal(job.status));
    if (active.length === 0) return;

    const updates = await Promise.all(
      active.map(async (job) => {
        try {
          return await client.getJob(job.id);
        } catch {
          // Transient status read failure: keep the last known state.
          return null;
        }
      }),
    );

    const fresh = updates.filter((job): job is Job => job !== null);
    if (fresh.length === 0) return;

    // A job that was non-terminal and is now completed should refresh artifacts.
    const justCompleted = fresh.some(
      (job) =>
        job.status === "completed" &&
        jobsRef.current.some((prev) => prev.id === job.id && !isTerminal(prev.status)),
    );

    setJobs((prev) =>
      prev.map((job) => fresh.find((updated) => updated.id === job.id) ?? job),
    );

    if (justCompleted) {
      void refreshArtifacts();
    }
  }, [client, refreshArtifacts]);

  const hasActiveJobs = jobs.some((job) => !isTerminal(job.status));

  // Run the poll loop only while at least one tracked job is non-terminal.
  useEffect(() => {
    if (!hasActiveJobs) return;
    const handle = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [hasActiveJobs, pollOnce]);

  useEffect(() => {
    if (!projectId || pipelineRun?.status !== "running") return;
    let cancelled = false;

    const pollPipeline = async (): Promise<void> => {
      try {
        const [run, existingJobs] = await Promise.all([
          client.getPipeline(projectId),
          client.listProjectJobs(projectId),
        ]);
        if (cancelled) return;
        setPipelineRun(run);
        setJobs(
          [...existingJobs].sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
          ),
        );
        if (run?.status === "completed") {
          void refreshArtifacts();
        } else if (run?.status === "failed") {
          setTriggerError(run.error ?? "Full pipeline failed.");
          void refreshArtifacts();
        }
      } catch (err) {
        if (!cancelled) setTriggerError(toMessage(err, "Failed to refresh pipeline status."));
      }
    };

    void pollPipeline();
    const handle = setInterval(() => void pollPipeline(), PIPELINE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [client, pipelineRun?.status, projectId, refreshArtifacts]);

  const rememberJob = useCallback((job: Job): void => {
    setJobs((prev) => [job, ...prev.filter((existing) => existing.id !== job.id)]);
  }, []);

  const triggerJob = useCallback(
    async (type: JobType): Promise<void> => {
      if (!projectId) return;
      setTriggerError(null);
      setBusyType(type);
      try {
        const request: CreateJobRequest =
          type === "render" ? { type, params: { format: renderFormat } } : { type };
        const job = await client.createJob(projectId, request);
        rememberJob(job);
      } catch (err) {
        setTriggerError(toMessage(err, "Failed to start the job."));
      } finally {
        setBusyType(null);
      }
    },
    [client, projectId, rememberJob, renderFormat],
  );

  const handleBuildConfig = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setTriggerError(null);
    setBuildingConfig(true);
    try {
      await client.buildConfig(projectId);
      await refreshArtifacts();
    } catch (err) {
      setTriggerError(toMessage(err, "Failed to build config."));
    } finally {
      setBuildingConfig(false);
    }
  }, [client, projectId, refreshArtifacts]);

  const handleRunFullPipeline = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setTriggerError(null);
    setPipelineStarting(true);
    try {
      const run = await client.startPipeline(projectId, { format: renderFormat });
      setPipelineRun(run);
      const existing = await client.listProjectJobs(projectId);
      setJobs(
        [...existing].sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
        ),
      );
    } catch (err) {
      setTriggerError(toMessage(err, "Failed to start the full pipeline."));
    } finally {
      setPipelineStarting(false);
    }
  }, [client, projectId, renderFormat]);

  if (!projectId) {
    return (
      <section className="page jobs-page">
        <h2>Jobs</h2>
        <p>Load a folder first to run jobs and download artifacts.</p>
        <button type="button" onClick={() => navigate("create")}>
          Go to folder load
        </button>
      </section>
    );
  }

  return (
    <section className="page jobs-page">
      <h2>Jobs &amp; artifacts</h2>
      <p>
        Running jobs for project <code>{projectId}</code>.
      </p>

      <div className="job-triggers">
        <button
          type="button"
          onClick={() => void handleRunFullPipeline()}
          disabled={pipelineRunning || busyType !== null || buildingConfig}
        >
          {pipelineRunning ? `Pipeline: ${pipelineStep ?? "Starting"}...` : "Run full pipeline"}
        </button>

        {JOB_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => void triggerJob(type)}
            disabled={pipelineRunning || busyType !== null}
          >
            {busyType === type ? `Starting ${label}...` : label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => void handleBuildConfig()}
          disabled={pipelineRunning || busyType !== null || buildingConfig}
        >
          {buildingConfig ? "Building config..." : "Build config"}
        </button>

        <label className="field render-format">
          <span>Render format</span>
          <select
            value={renderFormat}
            aria-label="Render format"
            disabled={pipelineRunning}
            onChange={(e) => setRenderFormat(e.target.value as VideoFormat)}
          >
            {RENDER_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pipelineStep && (
        <p role="status">Pipeline status: {pipelineStep}</p>
      )}

      {triggerError && (
        <p className="error" role="alert">
          {triggerError}
        </p>
      )}

      <h3>Job status</h3>
      {jobs.length === 0 ? (
        <p>No jobs triggered yet.</p>
      ) : (
        <JobStatusList jobs={jobs} />
      )}

      <h3>Artifacts</h3>
      {artifactError && (
        <p className="error" role="alert">
          {artifactError}
        </p>
      )}
      {artifacts.length === 0 ? (
        <p>No artifacts available yet.</p>
      ) : (
        <ul className="artifact-list" aria-label="Available artifacts">
          {artifacts.map((name) => (
            <li key={name} className="artifact-item">
              <a href={client.artifactUrl(projectId, name)} download={name}>
                {name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="page-actions">
        <button type="button" onClick={() => void refreshArtifacts()}>
          Refresh artifacts
        </button>
      </div>
    </section>
  );
}

/** Turn a thrown value into a user-facing message, preferring API messages. */
function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export const pageRegistration: PageRegistration = {
  id: "jobs",
  label: "Jobs",
  order: 3,
  requiresProject: true,
  component: JobsPage,
};

export default JobsPage;
