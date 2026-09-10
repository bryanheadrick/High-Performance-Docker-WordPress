import {
  listSites,
  getSite,
  createSite,
  removeSite,
  startStack,
  stopStack,
  restartStack,
  getStackStatus,
  type Result,
} from "@wpstack/core";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (repoRoot: string, args: Record<string, unknown>) => Promise<Result<unknown>>;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "list_sites",
    description: "List all WordPress sites managed by this environment.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => listSites(repoRoot),
  },
  {
    name: "get_site",
    description: "Get details for a single WordPress site by domain.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      required: ["domain"],
    },
    handler: async (repoRoot, args) => getSite(repoRoot, args.domain as string),
  },
  {
    name: "create_site",
    description: "Create a new WordPress site with its own domain, database, and SSL certificate.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        dbName: { type: "string" },
        dbUser: { type: "string" },
        dbPassword: { type: "string" },
        adminUser: { type: "string" },
        adminPassword: { type: "string" },
        adminEmail: { type: "string" },
      },
      required: ["domain"],
    },
    handler: async (repoRoot, args) =>
      createSite(repoRoot, args as unknown as Parameters<typeof createSite>[1]),
  },
  {
    name: "remove_site",
    description: "Permanently remove a WordPress site: files, database, Nginx config, and SSL cert.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      required: ["domain"],
    },
    handler: async (repoRoot, args) => removeSite(repoRoot, args.domain as string),
  },
  {
    name: "stack_status",
    description: "Show the status of all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => getStackStatus(repoRoot),
  },
  {
    name: "stack_start",
    description: "Start all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => startStack(repoRoot),
  },
  {
    name: "stack_stop",
    description: "Stop all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => stopStack(repoRoot),
  },
  {
    name: "stack_restart",
    description: "Restart all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => restartStack(repoRoot),
  },
];
