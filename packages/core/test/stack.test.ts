import { describe, it, expect } from "vitest";
import { getStackStatus } from "../src/stack.js";

describe("getStackStatus", () => {
  it("fails cleanly when docker compose is unavailable or the stack is down", async () => {
    // Uses a repoRoot with no docker-compose.yml reachable state to force
    // a predictable failure path without depending on Docker being installed
    // in the test environment.
    const result = await getStackStatus("/nonexistent/repo/root");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STACK_STATUS_FAILED");
    }
  });
});
