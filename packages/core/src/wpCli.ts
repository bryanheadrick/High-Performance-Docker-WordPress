import { spawn } from "node:child_process";
import { resolveSiteContext } from "./repoRoot.js";
import { ok, fail, type Result } from "./types.js";

export function resolveWpContainerPath(domain: string | null): string {
  if (!domain) {
    return "/var/www/html";
  }

  return `/var/www/html/sites/${domain}`;
}

export interface WpCliOptions {
  domain?: string;
}

export function runWpCli(
  cwd: string,
  args: string[],
  options: WpCliOptions = {}
): Promise<Result<{ exitCode: number }>> {
  const context = resolveSiteContext(cwd);
  const domain = options.domain ?? context.domain;
  const wpPath = resolveWpContainerPath(domain);

  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["compose", "exec", "wordpress", "wp", "--allow-root", `--path=${wpPath}`, ...args],
      { cwd: context.repoRoot, stdio: "inherit" }
    );

    child.on("error", (err) => {
      resolve(fail(`Failed to run wp-cli: ${err.message}`, "WP_CLI_SPAWN_ERROR"));
    });

    child.on("close", (code) => {
      resolve(ok({ exitCode: code ?? 0 }));
    });
  });
}

export interface WpMcpStdioOptions {
  domain?: string;
  wpUser?: string;
}

export function runWpMcpStdio(
  cwd: string,
  options: WpMcpStdioOptions = {}
): Promise<Result<{ exitCode: number }>> {
  const context = resolveSiteContext(cwd);
  const domain = options.domain ?? context.domain;
  const wpPath = resolveWpContainerPath(domain);

  const args = [
    "compose",
    "exec",
    "-T",
    "wordpress",
    "wp",
    "--allow-root",
    `--path=${wpPath}`,
    "mcp-adapter",
    "serve",
  ];

  if (options.wpUser) {
    args.push(`--user=${options.wpUser}`);
  }

  return new Promise((resolve) => {
    const child = spawn("docker", args, { cwd: context.repoRoot, stdio: "inherit" });

    child.on("error", (err) => {
      resolve(fail(`Failed to start MCP STDIO bridge: ${err.message}`, "WP_MCP_STDIO_SPAWN_ERROR"));
    });

    child.on("close", (code) => {
      resolve(ok({ exitCode: code ?? 0 }));
    });
  });
}
