#!/usr/bin/env node
import { Command } from "commander";
import { registerSiteCommands } from "./commands/site.js";
import { registerStackCommands } from "./commands/stack.js";
import { registerMcpCommand } from "./commands/mcp.js";

const program = new Command();

program
  .name("wpstack")
  .description("Manage High-Performance-Docker-WordPress sites and stack");

registerSiteCommands(program);
registerStackCommands(program);
registerMcpCommand(program);

program.parseAsync(process.argv);
