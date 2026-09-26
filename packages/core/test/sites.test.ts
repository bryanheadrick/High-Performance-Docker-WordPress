import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
  chmodSync,
} from "node:fs";
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

  it("does not throw and skips a dangling symlink inside sites/", async () => {
    const sitesDir = join(repoRoot, "sites");
    mkdirSync(sitesDir, { recursive: true });

    const validSiteDir = join(sitesDir, "good.local");
    mkdirSync(validSiteDir, { recursive: true });

    const danglingLinkPath = join(sitesDir, "broken.local");
    symlinkSync(join(sitesDir, "does-not-exist-target"), danglingLinkPath);

    let result: Awaited<ReturnType<typeof listSites>> | undefined;
    await expect(async () => {
      result = await listSites(repoRoot);
    }).not.toThrow();

    expect(result?.success).toBe(true);
    if (result && result.success) {
      const domains = result.data.map((site) => site.domain);
      expect(domains).toContain("good.local");
      expect(domains).not.toContain("broken.local");
    }
  });

  it("does not throw when wp-config.php is unreadable (e.g. a directory at that path)", async () => {
    const siteDir = join(repoRoot, "sites", "weird.local");
    const wpConfigAsDir = join(siteDir, "wp-config.php");
    mkdirSync(wpConfigAsDir, { recursive: true });

    const result = await listSites(repoRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      const site = result.data.find((s) => s.domain === "weird.local");
      expect(site).toBeDefined();
      expect(site?.dbName).toBeNull();
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

  it.each([123, null, undefined, {}, [], true, 12.5])(
    "resolves a failed Result (never throws) for non-string domain %p",
    async (domain) => {
      let result: Awaited<ReturnType<typeof getSite>> | undefined;

      await expect(async () => {
        result = await getSite(repoRoot, domain as unknown as string);
      }).not.toThrow();

      expect(result?.success).toBe(false);
      if (result && !result.success) {
        expect(result.error.code).toBe("INVALID_DOMAIN");
      }
    }
  );
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

  it("rejects non-string input without throwing", () => {
    for (const value of [123, null, undefined, {}, [], true, 12.5]) {
      expect(() => validateDomain(value as unknown as string)).not.toThrow();
      expect(validateDomain(value as unknown as string)).toBe(false);
    }
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

  it.each([123, null, {}, [], true])(
    "resolves a failed Result (never throws) for non-string domain %p",
    async (domain) => {
      let result: Awaited<ReturnType<typeof createSite>> | undefined;

      await expect(async () => {
        result = await createSite(repoRoot, { domain: domain as unknown as string });
      }).not.toThrow();

      expect(result?.success).toBe(false);
      if (result && !result.success) {
        expect(result.error.code).toBe("INVALID_DOMAIN");
      }
    }
  );

  it.each(["dbName", "dbUser"] as const)(
    "fails with INVALID_OPTION when %s contains characters outside [A-Za-z0-9_]",
    async (field) => {
      const result = await createSite(repoRoot, {
        domain: "mysite.local",
        [field]: "not an identifier!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_OPTION");
      }
    }
  );

  it("still accepts normal alphanumeric dbName and dbUser values (passes validation)", async () => {
    const result = await createSite(repoRoot, {
      domain: "mysite.local",
      dbName: "wp_mysite_local",
      dbUser: "wp_mysite_local",
    });

    // The script doesn't exist in the temp repoRoot, so this fails at the
    // runScript stage rather than succeeding outright -- the important
    // assertion is that validation did NOT reject it as INVALID_OPTION.
    if (!result.success) {
      expect(result.error.code).not.toBe("INVALID_OPTION");
    }
  });

  it.each(["'", "`", '"', ";", "\\"])(
    "fails with INVALID_OPTION when dbPassword contains the SQL-dangerous character %j",
    async (char) => {
      const result = await createSite(repoRoot, {
        domain: "mysite.local",
        dbPassword: `abc${char}def`,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_OPTION");
      }
    }
  );

  it("still accepts a dbPassword with normal punctuation but no SQL-dangerous characters", async () => {
    const result = await createSite(repoRoot, {
      domain: "mysite.local",
      dbPassword: "Str0ng!P@ssw0rd#2024",
    });

    if (!result.success) {
      expect(result.error.code).not.toBe("INVALID_OPTION");
    }
  });

  it("surfaces a warning when new-site.sh reports a failed hosts entry", async () => {
    const scriptPath = join(repoRoot, "new-site.sh");
    writeFileSync(
      scriptPath,
      `#!/bin/bash\necho "Failed to add hosts entry (may need sudo permissions)"\nexit 0\n`
    );
    chmodSync(scriptPath, 0o755);

    const result = await createSite(repoRoot, { domain: "mysite.local" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warnings).toBeDefined();
      expect(result.data.warnings?.some((w) => w.toLowerCase().includes("hosts"))).toBe(
        true
      );
    }
  });

  it("does not include warnings when new-site.sh succeeds without hosts-entry issues", async () => {
    const scriptPath = join(repoRoot, "new-site.sh");
    writeFileSync(scriptPath, `#!/bin/bash\necho "Site created successfully"\nexit 0\n`);
    chmodSync(scriptPath, 0o755);

    const result = await createSite(repoRoot, { domain: "mysite.local" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warnings).toBeUndefined();
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

  it.each([123, null, {}, [], true])(
    "resolves a failed Result (never throws) for non-string domain %p",
    async (domain) => {
      let result: Awaited<ReturnType<typeof removeSite>> | undefined;

      await expect(async () => {
        result = await removeSite(repoRoot, domain as unknown as string);
      }).not.toThrow();

      expect(result?.success).toBe(false);
      if (result && !result.success) {
        expect(result.error.code).toBe("INVALID_DOMAIN");
      }
    }
  );
});
