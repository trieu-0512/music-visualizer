import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp, loadConfig } from "../src/app.js";

describe("backend app scaffold", () => {
  it("boots using the default local config (Req 13.4, 14.5)", () => {
    const config = loadConfig();
    expect(config.storage.backend).toBe("local");
    expect(config.queue.backend).toBe("file");
    // The app factory builds without throwing under the default config.
    expect(() => createApp({ config })).not.toThrow();
  });

  it("serves a health check", async () => {
    const app = createApp();
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.header["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers browser CORS preflight requests from the Web_App dev server", async () => {
    const app = createApp();
    const res = await request(app)
      .options("/projects")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    expect(res.status).toBe(204);
    expect(res.header["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.header["access-control-allow-methods"]).toContain("POST");
    expect(res.header["access-control-allow-headers"]).toContain("Content-Type");
  });
});
