import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  describe("with a fake docker on PATH", () => {
    let fakeBinDir: string;
    let originalPath: string;

    afterEach(() => {
      process.env.PATH = originalPath;
      rmSync(fakeBinDir, { recursive: true, force: true });
    });

    it("skips non-JSON warning lines emitted by docker compose ps instead of throwing", async () => {
      fakeBinDir = mkdtempSync(join(tmpdir(), "wpstack-fake-docker-"));
      const fakeDockerPath = join(fakeBinDir, "docker");
      writeFileSync(
        fakeDockerPath,
        [
          "#!/bin/bash",
          'echo \'level=warning msg="some compose warning"\'',
          'echo \'{"Service":"nginx","State":"running","Status":"Up 2 hours"}\'',
          "exit 0",
        ].join("\n") + "\n"
      );
      chmodSync(fakeDockerPath, 0o755);

      originalPath = process.env.PATH ?? "";
      process.env.PATH = `${fakeBinDir}:${originalPath}`;

      const result = await getStackStatus("/tmp");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({ name: "nginx", state: "running" });
      }
    });
  });
});
