import { createHash } from "node:crypto";
import type { ProjectConfigJson } from "@music-visualizer/shared";
import { ApiError } from "../http/errors.js";
import type { AssetStore } from "../storage/index.js";

export interface StaleConfigDependency {
  path: string;
  reason: "missing" | "hash-mismatch";
  expectedSha256: string;
  actualSha256?: string;
}

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compare a config's dependency snapshot to the exact bytes currently stored.
 * Legacy configs without provenance remain readable/renderable for backward
 * compatibility; every newly built config has provenance and is checked.
 */
export async function findStaleConfigDependencies(
  store: AssetStore,
  projectId: string,
  config: ProjectConfigJson,
): Promise<StaleConfigDependency[]> {
  const dependencies = config.provenance?.dependencies;
  if (!dependencies) return [];

  const stale: StaleConfigDependency[] = [];
  for (const [relativePath, expectedSha256] of Object.entries(dependencies)) {
    const ref = { projectId, relativePath };
    if (!(await store.exists(ref))) {
      stale.push({ path: relativePath, reason: "missing", expectedSha256 });
      continue;
    }
    const actualSha256 = sha256(await store.read(ref));
    if (actualSha256 !== expectedSha256) {
      stale.push({
        path: relativePath,
        reason: "hash-mismatch",
        expectedSha256,
        actualSha256,
      });
    }
  }
  return stale;
}

/** Reject a render that would consume a dependency set different from its config build. */
export async function assertConfigFresh(
  store: AssetStore,
  projectId: string,
  config: ProjectConfigJson,
): Promise<void> {
  if (config.projectId !== projectId) {
    throw new ApiError(
      "PRECONDITION_FAILED",
      "Configuration belongs to a different project; rebuild config before rendering",
      { projectId, configProjectId: config.projectId },
    );
  }
  const staleDependencies = await findStaleConfigDependencies(store, projectId, config);
  if (staleDependencies.length > 0) {
    throw new ApiError(
      "PRECONDITION_FAILED",
      "Configuration is stale; rebuild config before rendering",
      { projectId, staleDependencies },
    );
  }
}
