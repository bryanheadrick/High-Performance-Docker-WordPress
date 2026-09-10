import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSites, getSite, createSite, removeSite, validateDomain } from "../src/sites.js";

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

  it("fails with INVALID_DOMAIN for a path-traversal domain and never touches paths outside sites/", async () => {
    const result = await getSite(repoRoot, "../../etc");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DOMAIN");
    }

    // If the vulnerability existed, this would have resolved to a real
    // system path (repoRoot/../.. -> somewhere under /etc) and the
    // function would have attempted filesystem access there instead of
    // short-circuiting with INVALID_DOMAIN.
    expect(existsSync("/etc/passwd")).toBe(true);
  });
});

describe("validateDomain", () => {
  it("rejects path traversal sequences", () => {
    expect(validateDomain("../../etc")).toBe(false);
  });

  it("rejects domains containing a slash", () => {
    expect(validateDomain("foo/bar")).toBe(false);
    expect(validateDomain("foo\\bar")).toBe(false);
  });

  it("rejects values that look like flags", () => {
    expect(validateDomain("--admin-email")).toBe(false);
    expect(validateDomain("-y")).toBe(false);
  });

  it("accepts plausible hostnames", () => {
    expect(validateDomain("mysite.local")).toBe(true);
    expect(validateDomain("example.com")).toBe(true);
  });

  it("rejects malformed hostnames", () => {
    expect(validateDomain("")).toBe(false);
    expect(validateDomain(".example.com")).toBe(false);
    expect(validateDomain("example.com.")).toBe(false);
    expect(validateDomain("example..com")).toBe(false);
    expect(validateDomain("-example.com")).toBe(false);
    expect(validateDomain("example-.com")).toBe(false);
  });
});

describe("createSite", () => {
  it("fails with INVALID_DOMAIN for a flag-smuggling domain without invoking the script", async () => {
    const result = await createSite(repoRoot, { domain: "--admin-email" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DOMAIN");
    }
  });

  it("fails with INVALID_DOMAIN for a path-traversal domain without invoking the script", async () => {
    const result = await createSite(repoRoot, { domain: "../../etc" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DOMAIN");
    }
  });

  it("fails with INVALID_OPTION when adminEmail looks like a flag, without invoking the script", async () => {
    const result = await createSite(repoRoot, {
      domain: "mysite.local",
      adminEmail: "-y",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_OPTION");
    }
  });

  it("fails with INVALID_OPTION when dbPassword looks like a flag, without invoking the script", async () => {
    const result = await createSite(repoRoot, {
      domain: "mysite.local",
      dbPassword: "--admin-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_OPTION");
    }
  });

  it("fails with INVALID_OPTION for each of dbName, dbUser, dbPassword, adminUser, adminPassword, adminEmail when it starts with a dash", async () => {
    const fields = [
      "dbName",
      "dbUser",
      "dbPassword",
      "adminUser",
      "adminPassword",
      "adminEmail",
    ] as const;

    for (const field of fields) {
      const result = await createSite(repoRoot, {
        domain: "mysite.local",
        [field]: "-suspicious",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_OPTION");
      }
    }
  });
});

describe("removeSite", () => {
  it("fails with INVALID_DOMAIN for an invalid domain without invoking the script", async () => {
    const result = await removeSite(repoRoot, "-y");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DOMAIN");
    }
  });

  it("fails with INVALID_DOMAIN for a path-traversal domain without invoking the script", async () => {
    const result = await removeSite(repoRoot, "../../etc");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DOMAIN");
    }
  });
});
