/**
 * Page contract for the Web_App navigation (`frontend`).
 *
 * The app shell ({@link ../App}) renders a small set of navigation slots and
 * mounts one page at a time. Every page is a self-contained module under
 * `src/pages/` that exports a {@link PageRegistration}; the {@link ../pages/registry}
 * discovers them automatically (via `import.meta.glob`) and fills the matching
 * navigation slot by `id`.
 */
import type { ComponentType } from "react";
import type { ApiClient } from "../api/index.js";

/**
 * Shared context handed to every page: the typed API client, the currently
 * selected `Project_Id` (or `null` when none has been created/selected yet),
 * and navigation helpers for moving between pages and adopting a project.
 */
export interface PageContext {
  /** Typed API_Service client shared across all pages. */
  client: ApiClient;
  /** The active project id, or `null` until one is created/selected. */
  projectId: string | null;
  /** Adopt (or clear) the active project id; persisted by the shell. */
  setProjectId: (projectId: string | null) => void;
  /** Switch the visible page by its navigation slot `id`. */
  navigate: (pageId: string) => void;
}

/** Props every page component receives from the shell. */
export interface PageProps {
  context: PageContext;
}

/**
 * A page's self-registration. The shell sorts visible navigation by `order`
 * and fills the slot whose `id` matches.
 */
export interface PageRegistration {
  /** Navigation slot id, e.g. `"create" | "assets" | "preview" | "jobs"`. */
  id: string;
  /** Human-readable navigation label. */
  label: string;
  /** Sort order within the navigation bar (ascending). */
  order: number;
  /** When true, the slot is disabled in the nav until a project is active. */
  requiresProject?: boolean;
  /** The page component. */
  component: ComponentType<PageProps>;
}
