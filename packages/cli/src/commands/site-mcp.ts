import { Command } from "commander";
import { resolveSiteContext, runWpMcpStdio } from "@wpstack/core";
import { requireRepoRoot } from "../repo.js";

function resolveDomainArg(explicit: string | undefined): string {
  if (explicit) return explicit;

  const context = resolveSiteContext(process.cwd());
  if (context.domain) return context.domain;

  console.error("Error: no domain given and current directory is not inside sites/<domain>/.");
  process.exit(1);
}

export function registerSiteMcpCommand(program: Command): void {
  program
    .command("site-mcp [domain]")
    .description(
      "Bridge a WordPress site's MCP server (mcp-adapter) over STDIO, for use as an MCP client subprocess"
    )
    .option("--user <user>", "WordPress username or ID to run the MCP session as")
    .action(async (domain: string | undefined, opts: { user?: string }) => {
      requireRepoRoot();
      const resolvedDomain = resolveDomainArg(domain);

      const result = await runWpMcpStdio(process.cwd(), {
        domain: resolvedDomain,
        wpUser: opts.user,
      });

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      process.exit(result.data.exitCode);
    });
}
