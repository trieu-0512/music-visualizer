/**
 * Web_App React entry point (`frontend`).
 *
 * Mounts the {@link App} shell into `#root`. The app shell owns simple
 * state-based navigation between the project-create, assets/readiness, preview,
 * and jobs/artifacts pages (see `src/pages/registry.tsx`).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
