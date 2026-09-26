import { describe, it, expect } from "vitest";
import { toolDefinitions } from "../src/tools.js";

describe("toolDefinitions", () => {
  it("exposes exactly the eight expected site/stack tools", () => {
    const names = toolDefinitions.map((tool) => tool.name).sort();

    expect(names).toEqual([
      "create_site",
      "get_site",
      "list_sites",
      "remove_site",
      "stack_restart",
      "stack_start",
      "stack_status",
      "stack_stop",
    ]);
  });

  it("each tool definition has a description and an inputSchema", () => {
    for (const tool of toolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});
