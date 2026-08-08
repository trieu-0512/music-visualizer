/**
 * Jobs + artifacts page (`frontend`).
 *
 * Lets the user trigger processing/render jobs individually or run the full
 * prepare-assets -> transcribe/analyze -> config -> render pipeline via `client.createJob` (Req 9.1, 12.1). PRECONDITION_FAILED
 * responses (no Audio_Asset, or no Project_Config_Json for render) are surfaced
 * with their API message so the user knows what is missing.
 *
 * After a job is created it is tracked and polled with `client.getJob` on an
 * interval, displaying the lifecycle status — pending / running / completed /
 * failed — and the recorded error on failure; polling stops once every tracked
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function JobsPage({ context }: PageProps): JSX.Element {
  const { client, projectId, navigate } = context;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [busyType, setBusyType] = useState<JobType | null>(null);
  const [buildingConfig, setBuildingConfig] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);
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

  // Reset state and load artifacts + existing jobs when the active project changes.
  useEffect(() => {
    setJobs([]);
    setArtifacts([]);
    setTriggerError(null);
    setArtifactError(null);
    if (!projectId) return;

    void refreshArtifacts();

    let cancelled = false;
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
        // Listing is optional hydration — ignore failures (e.g. offline API).
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

  const rememberJob = useCallback((job: Job): void => {
    setJobs((prev) => [job, ...prev.filter((existing) => existing.id !== job.id)]);
  }, []);

  const waitForJob = useCallback(
    async (initial: Job): Promise<Job> => {
      let current = initial;
      rememberJob(current);
      while (!isTerminal(current.status)) {
        await delay(PIPELINE_POLL_INTERVAL_MS);
        current = await client.getJob(current.id);
        rememberJob(current);
      }
      if (current.status === "failed") {
        throw new Error(current.error || `${current.type} job failed`);
      }
      return current;
    },
    [client, rememberJob],
  );

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
    setPipelineRunning(true);
    try {
      const readiness = await client.getReadiness(projectId);
      const hasLearningMap = readiness.present.includes("learningMap");

      if (hasLearningMap) {
        setPipelineStep("Preparing ABC assets");
        const prepare = await client.createJob(projectId, { type: "prepare-assets" });
        await waitForJob(prepare);
      }

      setPipelineStep("Transcribing and analyzing audio");
      const [transcribe, analyze] = await Promise.all([
        client.createJob(projectId, { type: "transcribe" }),
        client.createJob(projectId, { type: "analyze" }),
      ]);
      rememberJob(transcribe);
      rememberJob(analyze);
      await Promise.all([waitForJob(transcribe), waitForJob(analyze)]);

      setPipelineStep("Building render config");
      await client.buildConfig(projectId);
      await refreshArtifacts();

      setPipelineStep("Rendering video");
      const render = await client.createJob(projectId, {
        type: "render",
        params: { format: renderFormat },
      });
      await waitForJob(render);
      await refreshArtifacts();
      setPipelineStep("Completed");
    } catch (err) {
      setPipelineStep("Failed");
      setTriggerError(toMessage(err, "Full pipeline failed."));
    } finally {
      setPipelineRunning(false);
    }
  }, [client, projectId, refreshArtifacts, rememberJob, renderFormat, waitForJob]);

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
          {pipelineRunning ? `Pipeline: ${pipelineStep ?? "Starting"}…` : "Run full pipeline"}
        </button>

        {JOB_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => void triggerJob(type)}
            disabled={pipelineRunning || busyType !== null}
          >
            {busyType === type ? `Starting ${label}…` : label}
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
