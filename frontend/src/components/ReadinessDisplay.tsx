/**
 * Readiness display (`frontend`).
 *
 * Renders the present-vs-missing required asset roles from a
 * {@link ReadinessReport} (Req 2.8). It is a pure presentational component: the
 * parent fetches readiness from `client.getReadiness` and re-renders this after
 * each upload.
 */
import type { ReadinessReport } from "../api/index.js";
import type { JSX } from "react";

export interface ReadinessDisplayProps {
  /** The latest readiness report, or `null` while loading / before first fetch. */
  readiness: ReadinessReport | null;
  /** True while a readiness fetch is in flight. */
  loading?: boolean;
}

export function ReadinessDisplay({ readiness, loading }: ReadinessDisplayProps): JSX.Element {
  if (!readiness) {
    return (
      <div className="readiness" aria-live="polite">
        <h3>Readiness</h3>
        <p>{loading ? "Checking readiness…" : "Readiness not loaded yet."}</p>
      </div>
    );
  }

  return (
    <div className="readiness" aria-live="polite">
      <h3>Readiness</h3>
      <p className={readiness.ready ? "ready" : "not-ready"} role="status">
        {readiness.ready
          ? "All required assets are present."
          : `Missing ${readiness.missing.length} required asset role(s).`}
      </p>

      <div className="readiness-columns">
        <section aria-labelledby="present-heading">
          <h4 id="present-heading">Present ({readiness.present.length})</h4>
          <ul aria-label="Present roles">
            {readiness.present.map((role) => (
              <li key={role} className="present-role" data-role={role}>
                {role}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="missing-heading">
          <h4 id="missing-heading">Missing ({readiness.missing.length})</h4>
          <ul aria-label="Missing roles">
            {readiness.missing.map((role) => (
              <li key={role} className="missing-role" data-role={role}>
                {role}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
