import { Command } from "commander";
import { findRepoRoot } from "@wpstack/core";
import { runMcpServer } from "@wpstack/mcp-server";

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Run the MCP stdio server for AI agent integration")
    .action(async () => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error("Error: not inside a High-Performance-Docker-WordPress repo.");
        process.exit(1);
      }
      await runMcpServer(repoRoot);
    });
}
