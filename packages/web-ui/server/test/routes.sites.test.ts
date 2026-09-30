import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { createApp, createOriginCheckMiddleware } from "../src/index.js";

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

  function createTestApp() {
    const app = express();
    app.use(createOriginCheckMiddleware(port));
    app.post("/probe", (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("rejects a POST with a cross-origin Origin header", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/probe")
      .set("Origin", "http://evil.example");

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("does not reject a POST with no Origin header", async () => {
    const app = createTestApp();

    const response = await request(app).post("/probe");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("does not reject a POST with a matching same-origin Origin header", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/probe")
      .set("Origin", `http://127.0.0.1:${port}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
