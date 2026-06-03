// @vitest-environment jsdom
/**
 * Component tests for the readiness display (task 12.2).
 *
 * Verifies that present and missing required roles render in their respective
 * lists and that the summary reflects the `ready` flag (Req 2.8).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ReadinessDisplay } from "./ReadinessDisplay.js";
import type { ReadinessReport } from "../api/index.js";

afterEach(cleanup);

describe("ReadinessDisplay", () => {
  it("renders present and missing roles in separate lists", () => {
    const readiness: ReadinessReport = {
      projectId: "p1",
      ready: false,
      present: ["audio", "background"],
      missing: ["channelLogo", "letter:A"],
    };

    render(<ReadinessDisplay readiness={readiness} />);

    const present = within(screen.getByRole("list", { name: "Present roles" }));
    expect(present.getByText("audio")).toBeInTheDocument();
    expect(present.getByText("background")).toBeInTheDocument();

    const missing = within(screen.getByRole("list", { name: "Missing roles" }));
    expect(missing.getByText("channelLogo")).toBeInTheDocument();
    expect(missing.getByText("letter:A")).toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("Missing 2 required asset role(s).");
  });

  it("reports all-present when the project is ready", () => {
    const readiness: ReadinessReport = {
      projectId: "p1",
      ready: true,
      present: ["audio", "background", "songLogo"],
      missing: [],
    };

    render(<ReadinessDisplay readiness={readiness} />);

    expect(screen.getByRole("status")).toHaveTextContent("All required assets are present.");
    expect(screen.getByText("Missing (0)")).toBeInTheDocument();
  });

  it("shows a loading placeholder before the first report", () => {
    render(<ReadinessDisplay readiness={null} loading />);
    expect(screen.getByText("Checking readiness…")).toBeInTheDocument();
  });
});
