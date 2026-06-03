// @vitest-environment jsdom
/**
 * Component tests for the app shell (task 12.2).
 *
 * Verifies the registry-driven navigation renders the create and assets slots,
 * that project-gated slots are disabled until a project exists, and that the
 * create page is shown by default.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "./App.js";
import { ApiClient } from "./api/index.js";

afterEach(cleanup);

function testClient(): ApiClient {
  // A client whose fetch is never called in these tests.
  return new ApiClient({ baseUrl: "http://api.test", fetch: async () => new Response("{}") });
}

describe("App shell", () => {
  it("renders the registered navigation slots", () => {
    render(<App client={testClient()} />);
    expect(screen.getByRole("button", { name: "Load Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assets" })).toBeInTheDocument();
  });

  it("disables project-gated slots until a project is active", () => {
    render(<App client={testClient()} />);
    expect(screen.getByRole("button", { name: "Assets" })).toBeDisabled();
  });

  it("shows the create page by default", () => {
    render(<App client={testClient()} />);
    expect(screen.getByRole("heading", { name: "Load music folder" })).toBeInTheDocument();
  });

  it("enables the assets slot when a project is active", () => {
    render(<App client={testClient()} initialProjectId="p1" />);
    expect(screen.getByRole("button", { name: "Assets" })).toBeEnabled();
  });
});
