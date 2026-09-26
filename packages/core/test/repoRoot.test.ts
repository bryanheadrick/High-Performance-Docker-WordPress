import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findRepoRoot, resolveSiteContext } from "../src/repoRoot.js";

describe("findRepoRoot", () => {
  it("finds the directory containing docker-compose.yml by walking up", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "sites", "example.local");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const root = findRepoRoot(nested);

    expect(root).toBe(base);
    rmSync(base, { recursive: true, force: true });
  });

  it("returns null when no docker-compose.yml is found", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "a", "b");
    mkdirSync(nested, { recursive: true });

    const root = findRepoRoot(nested);

    expect(root).toBeNull();
    rmSync(base, { recursive: true, force: true });
  });
});

describe("resolveSiteContext", () => {
  it("infers domain when cwd is inside sites/<domain>", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "sites", "example.local");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const context = resolveSiteContext(nested);

    expect(context.repoRoot).toBe(base);
    expect(context.domain).toBe("example.local");
    rmSync(base, { recursive: true, force: true });
  });

  it("returns null domain when cwd is not inside a site directory", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const context = resolveSiteContext(base);

    expect(context.repoRoot).toBe(base);
    expect(context.domain).toBeNull();
    rmSync(base, { recursive: true, force: true });
  });
});
