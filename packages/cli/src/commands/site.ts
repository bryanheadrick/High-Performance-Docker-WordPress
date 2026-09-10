import { Command } from "commander";
import {
  resolveSiteContext,
  listSites,
  getSite,
  createSite,
  removeSite,
  type SiteInfo,
} from "@wpstack/core";
import { requireRepoRoot } from "../repo.js";

export function formatSiteList(sites: SiteInfo[]): string {
  if (sites.length === 0) {
    return "No sites found. Create one with: wpstack site create";
  }

  return sites
    .map(
      (site) =>
        `${site.domain}  ${site.url}  wp:${site.hasWordPress ? "yes" : "no"}  ssl:${site.hasSsl ? "yes" : "no"}`
    )
    .join("\n");
}

function resolveDomainArg(explicit: string | undefined): string {
  if (explicit) return explicit;

  const context = resolveSiteContext(process.cwd());
  if (context.domain) return context.domain;

  console.error("Error: no domain given and current directory is not inside sites/<domain>/.");
  process.exit(1);
}

export function registerSiteCommands(program: Command): void {
  const site = program.command("site").description("Manage WordPress sites");

  site
    .command("list")
    .description("List all sites")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await listSites(repoRoot);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(formatSiteList(result.data));
    });

  site
    .command("show [domain]")
    .description("Show details for a site")
    .action(async (domain?: string) => {
      const repoRoot = requireRepoRoot();
      const resolvedDomain = resolveDomainArg(domain);
      const result = await getSite(repoRoot, resolvedDomain);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(JSON.stringify(result.data, null, 2));
    });

  site
    .command("create")
    .description("Create a new site")
    .requiredOption("--domain <domain>", "Domain for the new site")
    .option("--db-name <name>")
    .option("--db-user <user>")
    .option("--db-password <password>")
    .option("--admin-user <user>")
    .option("--admin-password <password>")
    .option("--admin-email <email>")
    .action(async (opts) => {
      const repoRoot = requireRepoRoot();
      const result = await createSite(repoRoot, {
        domain: opts.domain,
        dbName: opts.dbName,
        dbUser: opts.dbUser,
        dbPassword: opts.dbPassword,
        adminUser: opts.adminUser,
        adminPassword: opts.adminPassword,
        adminEmail: opts.adminEmail,
      });

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(`Site created: ${result.data.url}`);

      if (result.data.warnings) {
        for (const warning of result.data.warnings) {
          console.warn(`Warning: ${warning}`);
        }
      }
    });

  site
    .command("remove [domain]")
    .description("Remove a site")
    .action(async (domain?: string) => {
      const repoRoot = requireRepoRoot();
      const resolvedDomain = resolveDomainArg(domain);
      const result = await removeSite(repoRoot, resolvedDomain);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(`Site removed: ${result.data.domain}`);
    });
}
