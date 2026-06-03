import { defineConfig } from "vitest/config";

export default defineConfig({
  // Templates are .tsx and use the automatic JSX runtime; configure esbuild so
  // vitest can transform them when the registry is imported under test.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts"],
    environment: "node",
  },
});
