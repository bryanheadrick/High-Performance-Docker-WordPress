import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "wpstack-webui-test-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("GET /api/sites", () => {
  it("returns an empty array when there are no sites", async () => {
    const app = createApp(repoRoot);

    const response = await request(app).get("/api/sites");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /api/sites/:domain", () => {
  it("returns 404 with an error body when the site does not exist", async () => {
    const app = createApp(repoRoot);

    const response = await request(app).get("/api/sites/missing.local");

    expect(response.status).toBe(404);
    expect(response.body.error).toBeTruthy();
  });
});

describe("Origin check middleware on state-changing endpoints", () => {
  const port = 4321;

  it("rejects a POST with a cross-origin Origin header", async () => {
    const app = createApp(repoRoot, port);

    const response = await request(app)
      .post("/api/stack/start")
      .set("Origin", "http://evil.example");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("does not reject a POST with no Origin header for the origin check specifically", async () => {
    const app = createApp(repoRoot, port);

    const response = await request(app).post("/api/stack/start");

    // No Origin header means same-origin navigation / curl / server-to-server:
    // the origin-check middleware must let it through. It may still fail for
    // other reasons (e.g. Docker not available in the test environment), but
    // must not be rejected as FORBIDDEN_ORIGIN.
    expect(response.body.error?.code).not.toBe("FORBIDDEN_ORIGIN");
  });

  it("does not reject a POST with a matching same-origin Origin header for the origin check specifically", async () => {
    const app = createApp(repoRoot, port);

    const response = await request(app)
      .post("/api/stack/start")
      .set("Origin", `http://127.0.0.1:${port}`);

    expect(response.body.error?.code).not.toBe("FORBIDDEN_ORIGIN");
  });
});
