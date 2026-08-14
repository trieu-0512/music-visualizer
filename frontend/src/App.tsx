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

  // Persist page + projectId in the URL so refresh/share restores state (PR-14).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (activePageId) params.set("page", activePageId);
    if (projectId) params.set("projectId", projectId);
    const search = params.toString();
    const path = window.location.pathname || "/";
    const nextUrl = search ? `${path}?${search}` : path;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [activePageId, projectId]);

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
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">MV</span>
          <div>
            <span className="brand-eyebrow">LOCAL STUDIO</span>
            <h1>Music Visualizer</h1>
          </div>
        </div>
        <div className="active-project">
          <span className={projectId ? "project-status is-ready" : "project-status"}>
            <i aria-hidden="true" />
            {projectId ? "Project loaded" : "No project loaded"}
          </span>
          {projectId ? <code>{projectId}</code> : <span>Load a folder to begin</span>}
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="app-nav" aria-label="Pages">
            <span className="nav-heading">WORKSPACE</span>
            {pages.map((page) => {
              const disabled = Boolean(page.requiresProject) && projectId === null;
              return (
                <button
                  key={page.id}
                  type="button"
                  className="nav-item"
                  data-page={page.id}
                  aria-current={page.id === activePageId ? "page" : undefined}
                  disabled={disabled}
                  onClick={() => setActivePageId(page.id)}
                >
                  <span className="nav-indicator" aria-hidden="true" />
                  {page.label}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <span className="sidebar-footer-label">RENDER ENGINE</span>
            <strong>Remotion 4</strong>
            <span>Local preview mode</span>
          </div>
        </aside>

        <main className="app-main">
          {ActiveComponent ? (
            <ActiveComponent context={context} />
          ) : (
            <p>No pages are registered.</p>
          )}
        </main>
      </div>
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
