import { Command } from "commander";
import { findRepoRoot } from "@wpstack/core";
import { startServer } from "@wpstack/web-ui";

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Run the local web UI for managing sites and the stack")
    .option("-p, --port <port>", "Port to listen on", "4321")
    .action(async (options: { port: string }) => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error("Error: not inside a High-Performance-Docker-WordPress repo.");
        process.exit(1);
      }
      startServer(repoRoot, Number(options.port));
    });
}
