import { spawn } from "node:child_process";
import { ok, fail, type Result } from "./types.js";

export function runScript(
  scriptPath: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<Result<{ stdout: string; stderr: string }>> {
  return new Promise((resolve) => {
    const child = spawn(scriptPath, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      resolve(fail(`Failed to run ${scriptPath}: ${err.message}`, "SCRIPT_SPAWN_ERROR"));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(ok({ stdout, stderr }));
      } else {
        resolve(
          fail(
            `${scriptPath} exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
            "SCRIPT_FAILED"
          )
        );
      }
    });
  });
}
