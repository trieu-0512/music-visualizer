/**
 * Project record (`backend`).
 *
 * Transport shapes live in `@music-visualizer/shared` (PR-08). Re-exported here
 * so existing backend imports of `./ProjectRecord.js` keep working.
 */
export type {
  ProjectRecord,
  ProjectMetadata,
  ProjectView,
} from "@music-visualizer/shared";
