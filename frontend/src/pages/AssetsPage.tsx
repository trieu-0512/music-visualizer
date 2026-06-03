/**
 * Asset upload + readiness page (`frontend`).
 *
 * Presents a per-role upload control for every asset role — audio, background,
 * song logo, channel logo, optional original lyrics, and the 26 letters
 * `letter:A`..`letter:Z` — each wired to `client.uploadAsset` (Req 2.1–2.7).
 * Below the controls it shows the present-vs-missing readiness report from
 * `client.getReadiness`, refreshed after every successful upload (Req 2.8).
 */
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { ApiClientError } from "../api/index.js";
import type { ReadinessReport } from "../api/index.js";
import { AssetUploadControl } from "../components/AssetUploadControl.js";
import { ReadinessDisplay } from "../components/ReadinessDisplay.js";
import { LETTER_ASSET_ROLES, PRIMARY_ROLES } from "./assetRoles.js";
import type { PageProps, PageRegistration } from "./types.js";

function AssetsPage({ context }: PageProps): JSX.Element {
  const { client, projectId, navigate } = context;
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshReadiness = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const report = await client.getReadiness(projectId);
      setReadiness(report);
    } catch (err) {
      setLoadError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  // Load readiness when the active project changes.
  useEffect(() => {
    setReadiness(null);
    if (projectId) {
      void refreshReadiness();
    }
  }, [projectId, refreshReadiness]);

  const handleUpload = useCallback(
    async (role: string, file: File): Promise<void> => {
      if (!projectId) throw new Error("No active project");
      await client.uploadAsset(projectId, role, file, file.name);
      // Refresh readiness so present/missing reflects the new upload (Req 2.8).
      await refreshReadiness();
    },
    [client, projectId, refreshReadiness],
  );

  if (!projectId) {
    return (
      <section className="page assets-page">
        <h2>Assets</h2>
        <p>Load a folder first to inspect or replace its assets.</p>
        <button type="button" onClick={() => navigate("create")}>
          Go to folder load
        </button>
      </section>
    );
  }

  const presentSet = new Set(readiness?.present ?? []);

  return (
    <section className="page assets-page">
      <h2>Assets</h2>
      <p>
        Uploading for project <code>{projectId}</code>. Required roles are marked with{" "}
        <span aria-hidden="true">*</span>.
      </p>

      <div className="asset-group">
        <h3>Core assets</h3>
        <div className="asset-grid">
          {PRIMARY_ROLES.map((role) => (
            <AssetUploadControl
              key={role.role}
              role={role}
              present={presentSet.has(role.role)}
              onUpload={handleUpload}
            />
          ))}
        </div>
      </div>

      <div className="asset-group">
        <h3>Letters (A–Z)</h3>
        <div className="asset-grid letter-grid">
          {LETTER_ASSET_ROLES.map((role) => (
            <AssetUploadControl
              key={role.role}
              role={role}
              present={presentSet.has(role.role)}
              onUpload={handleUpload}
            />
          ))}
        </div>
      </div>

      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}

      <ReadinessDisplay readiness={readiness} loading={loading} />

      <div className="page-actions">
        <button type="button" onClick={() => void refreshReadiness()} disabled={loading}>
          Refresh readiness
        </button>
      </div>
    </section>
  );
}

/** Turn a thrown value into a user-facing message, preferring API messages. */
function toMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Failed to load readiness.";
}

export const pageRegistration: PageRegistration = {
  id: "assets",
  label: "Assets",
  order: 1,
  requiresProject: true,
  component: AssetsPage,
};

export default AssetsPage;
