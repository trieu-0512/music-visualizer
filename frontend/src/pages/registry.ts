/**
 * Page registry for the Web_App navigation (`frontend`).
 *
 * Auto-discovers every page module under `src/pages/` that matches `*Page.tsx`
 * and exports a {@link PageRegistration} named `pageRegistration`. Discovery
 * uses Vite's `import.meta.glob` (eager), so a page file is wired into the nav
 * simply by existing. No central edit is required to add a page.
 */
import type { PageRegistration } from "./types.js";

/**
 * Eagerly import all sibling `*Page.tsx` modules. Each module is expected to
 * export `pageRegistration: PageRegistration`; modules without it are ignored
 * so an unrelated helper file under `pages/` won't break discovery.
 */
const modules = import.meta.glob<{ pageRegistration?: PageRegistration }>("./*Page.tsx", {
  eager: true,
});

/**
 * The discovered pages, sorted by `order`. Computed once at module load; the
 * set of page files is fixed at build time.
 */
export const pages: PageRegistration[] = Object.values(modules)
  .map((mod) => mod.pageRegistration)
  .filter((reg): reg is PageRegistration => reg !== undefined)
  .sort((a, b) => a.order - b.order);

/** Look up a page registration by its navigation slot id. */
export function findPage(pageId: string): PageRegistration | undefined {
  return pages.find((p) => p.id === pageId);
}
