import { spawn } from "node:child_process";
import { ok, fail, type Result } from "./types.js";

export function runScript(
  scriptPath: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {}
): Promise<Result<{ stdout: string; stderr: string }>> {
  return new Promise((resolve) => {
    const child = spawn(scriptPath, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      timeout: options.timeoutMs,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let exitFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (result: Result<{ stdout: string; stderr: string }>) => {
      if (settled) return;
      settled = true;
      if (exitFallbackTimer) clearTimeout(exitFallbackTimer);
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      settle(fail(`Failed to run ${scriptPath}: ${err.message}`, "SCRIPT_SPAWN_ERROR"));
    });

    // "close" is the normal resolution path: it fires once stdio streams
    // have fully drained, guaranteeing stdout/stderr are complete.
    child.on("close", (code) => {
      if (code === 0) {
        settle(ok({ stdout, stderr }));
      } else {
        settle(
          fail(
            `${scriptPath} exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
            "SCRIPT_FAILED"
          )
        );
      }
    });

    // Fallback for a timeout-triggered kill (or any signal): if the process
    // was killed by a signal, a grandchild process spawned by a shell
    // script (e.g. `sleep` under a killed bash script) can keep an
    // inherited stdio pipe open indefinitely, so "close" may never fire
    // even though the process itself has terminated. Give "close" a brief
    // grace period to fire on its own (preserving full stdout/stderr
    // capture in the common case); if it doesn't, resolve from "exit" so
    // the caller is never left hanging.
    child.on("exit", (code, signal) => {
      if (settled || !signal) return;
      exitFallbackTimer = setTimeout(() => {
        settle(
          fail(
            `${scriptPath} was terminated by signal ${signal}${
              options.timeoutMs ? ` (timeout after ${options.timeoutMs}ms)` : ""
            }`,
            "SCRIPT_TIMEOUT"
          )
        );
      }, 50);
    });
  });
}
