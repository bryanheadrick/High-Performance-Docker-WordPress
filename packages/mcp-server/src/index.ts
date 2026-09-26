import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions } from "./tools.js";

export function createMcpServer(repoRoot: string): Server {
  const server = new Server(
    { name: "wpstack", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolDefinitions.find((t) => t.name === request.params.name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const result = await tool.handler(repoRoot, request.params.arguments ?? {});

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  });

  return server;
}

export async function runMcpServer(repoRoot: string): Promise<void> {
  const server = createMcpServer(repoRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
