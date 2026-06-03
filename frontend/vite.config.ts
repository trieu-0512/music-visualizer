/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite + Vitest configuration for the Web_App (`frontend`).
 *
 * The React plugin powers both the dev server / `vite build` and the
 * Testing-Library component tests (it transforms the TSX used by the page
 * components). The default test environment stays `node` so the plain API
 * client unit tests run against Node's `fetch`/`Response`/`FormData`; component
 * test files opt into a DOM via a `// @vitest-environment jsdom` docblock.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
