import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScript } from "../src/runScript.js";

function makeScript(base: string, name: string, body: string): string {
  const path = join(base, name);
  writeFileSync(path, `#!/bin/bash\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

describe("runScript", () => {
  it("resolves ok with stdout on exit code 0", async () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const script = makeScript(base, "ok.sh", 'echo "hello $1"');

    const result = await runScript(script, ["world"]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdout.trim()).toBe("hello world");
    }
    rmSync(base, { recursive: true, force: true });
  });

  it("resolves fail with SCRIPT_FAILED on non-zero exit", async () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const script = makeScript(base, "fail.sh", 'echo "boom" >&2\nexit 1');

    const result = await runScript(script, []);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SCRIPT_FAILED");
      expect(result.error.message).toContain("boom");
    }
    rmSync(base, { recursive: true, force: true });
  });

  it("resolves fail with SCRIPT_SPAWN_ERROR when the script does not exist", async () => {
    const result = await runScript("/nonexistent/script.sh", []);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SCRIPT_SPAWN_ERROR");
    }
  });

  it("kills a hung child process once timeoutMs elapses instead of hanging forever", async () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const script = makeScript(base, "hang.sh", "sleep 30");

    const result = await runScript(script, [], { timeoutMs: 200 });

    expect(result.success).toBe(false);
    rmSync(base, { recursive: true, force: true });
  }, 10000);
});
