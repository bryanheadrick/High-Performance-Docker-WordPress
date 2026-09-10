import { Command } from "commander";
import { startStack, stopStack, restartStack, getStackStatus } from "@wpstack/core";
import { requireRepoRoot } from "../repo.js";

export function registerStackCommands(program: Command): void {
  const stack = program.command("stack").description("Manage the Docker stack");

  stack
    .command("start")
    .description("Start all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await startStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack started.");
    });

  stack
    .command("stop")
    .description("Stop all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await stopStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack stopped.");
    });

  stack
    .command("restart")
    .description("Restart all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await restartStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack restarted.");
    });

  stack
    .command("status")
    .description("Show container status")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await getStackStatus(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      for (const container of result.data) {
        console.log(`${container.name}  ${container.state}  ${container.status}`);
      }
    });
}
