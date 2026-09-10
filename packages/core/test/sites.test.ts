import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSites, getSite } from "../src/sites.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "wpstack-sites-test-"));
  writeFileSync(join(repoRoot, "docker-compose.yml"), "services: {}");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("listSites", () => {
  it("returns an empty list when sites/ does not exist", async () => {
    const result = await listSites(repoRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("lists directories under sites/ with their file-based status", async () => {
    const siteDir = join(repoRoot, "sites", "example.local");
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(
      join(siteDir, "wp-config.php"),
      "define('DB_NAME', 'example_local');"
    );
    mkdirSync(join(repoRoot, "config", "nginx", "conf.d"), { recursive: true });
    writeFileSync(join(repoRoot, "config", "nginx", "conf.d", "example.local.conf"), "");
    mkdirSync(join(repoRoot, "config", "nginx", "ssl"), { recursive: true });
    writeFileSync(join(repoRoot, "config", "nginx", "ssl", "example.local.crt"), "");

    const result = await listSites(repoRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        domain: "example.local",
        hasNginxConfig: true,
        hasSsl: true,
        hasWordPress: true,
        dbName: "example_local",
        url: "https://example.local",
      });
    }
  });
});

describe("getSite", () => {
  it("fails with SITE_NOT_FOUND when the site directory does not exist", async () => {
    const result = await getSite(repoRoot, "missing.local");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SITE_NOT_FOUND");
    }
  });

  it("returns the site info when the directory exists", async () => {
    mkdirSync(join(repoRoot, "sites", "example.local"), { recursive: true });

    const result = await getSite(repoRoot, "example.local");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("example.local");
      expect(result.data.hasWordPress).toBe(false);
    }
  });
});
