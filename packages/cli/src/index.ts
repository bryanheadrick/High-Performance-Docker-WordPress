#!/usr/bin/env node
import { Command } from "commander";
import { registerSiteCommands } from "./commands/site.js";
import { registerStackCommands } from "./commands/stack.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerUiCommand } from "./commands/ui.js";
import { runWpCommand } from "./commands/wp.js";

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === "wp") {
  await runWpCommand(rawArgs.slice(1));
} else {
  const program = new Command();

  program
    .name("wpstack")
    .description("Manage High-Performance-Docker-WordPress sites and stack");

  registerSiteCommands(program);
  registerStackCommands(program);
  registerMcpCommand(program);
  registerUiCommand(program);
  program
    .command("wp")
    .description("Run wp-cli for the current site directory (or repo root)")
    .allowUnknownOption()
    .action(() => {
      console.log("Usage: wpstack wp <wp-cli subcommand> [arguments...]");
    });

  await program.parseAsync(process.argv);
}
