/**
 * Job status list (`frontend`).
 *
 * A focused, presentational list of the jobs the Jobs page is currently
 * tracking, each showing its type and lifecycle status (pending / running /
 * completed / failed) and — on failure — the recorded error message (Req 12.2,
 * 12.4). Named distinctly so it never collides with the preview page's
 * components. The parent (JobsPage) owns triggering and polling; this component
 * only renders the snapshot it is handed.
 */
import type { JSX } from "react";
import type { Job } from "../api/index.js";

export interface JobStatusListProps {
  /** The tracked jobs to display, most-recently-triggered first. */
  jobs: Job[];
}

/** Human-readable label for each job type. */
const TYPE_LABELS: Record<Job["type"], string> = {
  transcribe: "Transcribe",
  analyze: "Analyze",
  render: "Render",
};

export function JobStatusList({ jobs }: JobStatusListProps): JSX.Element | null {
  if (jobs.length === 0) return null;

  return (
    <ul className="job-list" aria-label="Job status">
      {jobs.map((job) => (
        <li key={job.id} className="job-item" data-status={job.status} data-type={job.type}>
          <span className="job-type">{TYPE_LABELS[job.type]}</span>
          <span className={`badge job-status ${job.status}`}>{job.status}</span>
          {job.status === "failed" && job.error && (
            <span className="status error" role="alert">
              {job.error}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
