/**
 * Web_App application shell (`frontend`).
 *
 * Owns the cross-page state: the shared {@link ApiClient}, the active
 * `Project_Id`, and a small state-based router. Navigation slots are discovered
 * from the page {@link ./pages/registry registry}, so this file does not import
 * individual page components directly.
 */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { ApiClient } from "./api/index.js";
import { pages, findPage } from "./pages/registry.js";
import type { PageContext } from "./pages/types.js";

/** Optional injection point for tests; production uses a default client. */
export interface AppProps {
  /** Pre-constructed API client (tests inject a client with a mocked fetch). */
  client?: ApiClient;
  /** Initial active page id (defaults to the first registered page). */
  initialPageId?: string;
  /** Initial active project id. */
  initialProjectId?: string | null;
}

export function App({ client, initialPageId, initialProjectId }: AppProps = {}): JSX.Element {
  const apiClient = useMemo(() => client ?? new ApiClient(), [client]);
  const urlState = useMemo(readUrlState, []);
  const [projectId, setProjectId] = useState<string | null>(
    initialProjectId !== undefined ? initialProjectId : urlState.projectId,
  );
  const firstPageId = pages[0]?.id ?? "create";
  const [activePageId, setActivePageId] = useState<string>(
    initialPageId ?? urlState.pageId ?? firstPageId,
  );

  // If the active page disappears (shouldn't happen at runtime) fall back.
  useEffect(() => {
    if (!findPage(activePageId) && pages.length > 0) {
      setActivePageId(firstPageId);
    }
  }, [activePageId, firstPageId]);

  const context: PageContext = {
    client: apiClient,
    projectId,
    setProjectId,
    navigate: setActivePageId,
  };

  const active = findPage(activePageId) ?? pages[0];
  const ActiveComponent = active?.component;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Music Visualizer</h1>
        <p className="active-project">
          {projectId ? (
            <span>
              Project: <code>{projectId}</code>
            </span>
          ) : (
            <span>No project yet — load a folder to begin</span>
          )}
        </p>
      </header>

      <nav className="app-nav" aria-label="Pages">
        {pages.map((page) => {
          const disabled = Boolean(page.requiresProject) && projectId === null;
          return (
            <button
              key={page.id}
              type="button"
              className="nav-item"
              aria-current={page.id === activePageId ? "page" : undefined}
              disabled={disabled}
              onClick={() => setActivePageId(page.id)}
            >
              {page.label}
            </button>
          );
        })}
      </nav>

      <main className="app-main">
        {ActiveComponent ? (
          <ActiveComponent context={context} />
        ) : (
          <p>No pages are registered.</p>
        )}
      </main>
    </div>
  );
}

function readUrlState(): { pageId: string | null; projectId: string | null } {
  if (typeof window === "undefined") return { pageId: null, projectId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    pageId: cleanParam(params.get("page")),
    projectId: cleanParam(params.get("projectId")),
  };
}

function cleanParam(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
