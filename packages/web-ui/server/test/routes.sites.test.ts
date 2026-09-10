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
