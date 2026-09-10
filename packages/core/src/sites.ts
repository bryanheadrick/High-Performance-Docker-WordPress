import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ok, fail, type Result } from "./types.js";
import { runScript } from "./runScript.js";

export interface SiteInfo {
  domain: string;
  hasNginxConfig: boolean;
  hasSsl: boolean;
  hasWordPress: boolean;
  dbName: string | null;
  url: string;
}

export interface CreateSiteOptions {
  domain: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  adminUser?: string;
  adminPassword?: string;
  adminEmail?: string;
}

function readSiteInfo(repoRoot: string, domain: string): SiteInfo {
  const siteDir = join(repoRoot, "sites", domain);
  const wpConfigPath = join(siteDir, "wp-config.php");
  const hasWordPress = existsSync(wpConfigPath);

  let dbName: string | null = null;
  if (hasWordPress) {
    const contents = readFileSync(wpConfigPath, "utf8");
    const match = contents.match(/DB_NAME'\s*,\s*'([^']+)'/);
    dbName = match ? match[1] : null;
  }

  return {
    domain,
    hasNginxConfig: existsSync(join(repoRoot, "config", "nginx", "conf.d", `${domain}.conf`)),
    hasSsl: existsSync(join(repoRoot, "config", "nginx", "ssl", `${domain}.crt`)),
    hasWordPress,
    dbName,
    url: `https://${domain}`,
  };
}

export async function listSites(repoRoot: string): Promise<Result<SiteInfo[]>> {
  const sitesDir = join(repoRoot, "sites");

  if (!existsSync(sitesDir)) {
    return ok([]);
  }

  const entries = readdirSync(sitesDir).filter((name) =>
    statSync(join(sitesDir, name)).isDirectory()
  );

  return ok(entries.map((domain) => readSiteInfo(repoRoot, domain)));
}

export async function getSite(repoRoot: string, domain: string): Promise<Result<SiteInfo>> {
  const siteDir = join(repoRoot, "sites", domain);

  if (!existsSync(siteDir)) {
    return fail(`Site not found: ${domain}`, "SITE_NOT_FOUND");
  }

  return ok(readSiteInfo(repoRoot, domain));
}

export async function createSite(
  repoRoot: string,
  opts: CreateSiteOptions
): Promise<Result<{ domain: string; url: string }>> {
  const args = ["--non-interactive", "--domain", opts.domain];

  if (opts.dbName) args.push("--db-name", opts.dbName);
  if (opts.dbUser) args.push("--db-user", opts.dbUser);
  if (opts.dbPassword) args.push("--db-password", opts.dbPassword);
  if (opts.adminUser) args.push("--admin-user", opts.adminUser);
  if (opts.adminPassword) args.push("--admin-password", opts.adminPassword);
  if (opts.adminEmail) args.push("--admin-email", opts.adminEmail);

  const result = await runScript(join(repoRoot, "new-site.sh"), args, { cwd: repoRoot });

  if (!result.success) {
    return fail(result.error.message, "CREATE_SITE_FAILED");
  }

  return ok({ domain: opts.domain, url: `https://${opts.domain}` });
}

export async function removeSite(
  repoRoot: string,
  domain: string
): Promise<Result<{ domain: string }>> {
  const result = await runScript(
    join(repoRoot, "manage-sites.sh"),
    ["remove", domain, "--yes"],
    { cwd: repoRoot }
  );

  if (!result.success) {
    return fail(result.error.message, "REMOVE_SITE_FAILED");
  }

  return ok({ domain });
}
