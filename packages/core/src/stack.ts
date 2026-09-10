import { ok, fail, type Result } from "./types.js";
import { runScript } from "./runScript.js";

export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
}

const STACK_OPERATION_TIMEOUT_MS = 2 * 60 * 1000;

export async function startStack(repoRoot: string): Promise<Result<{ started: boolean }>> {
  const result = await runScript("docker", ["compose", "up", "-d"], {
    cwd: repoRoot,
    timeoutMs: STACK_OPERATION_TIMEOUT_MS,
  });

  if (!result.success) {
    return fail(result.error.message, "STACK_START_FAILED");
  }

  return ok({ started: true });
}

export async function stopStack(repoRoot: string): Promise<Result<{ stopped: boolean }>> {
  const result = await runScript("docker", ["compose", "down"], {
    cwd: repoRoot,
    timeoutMs: STACK_OPERATION_TIMEOUT_MS,
  });

  if (!result.success) {
    return fail(result.error.message, "STACK_STOP_FAILED");
  }

  return ok({ stopped: true });
}

export async function restartStack(
  repoRoot: string
): Promise<Result<{ restarted: boolean }>> {
  const result = await runScript("docker", ["compose", "restart"], {
    cwd: repoRoot,
    timeoutMs: STACK_OPERATION_TIMEOUT_MS,
  });

  if (!result.success) {
    return fail(result.error.message, "STACK_RESTART_FAILED");
  }

  return ok({ restarted: true });
}

export async function getStackStatus(repoRoot: string): Promise<Result<ContainerStatus[]>> {
  const result = await runScript(
    "docker",
    ["compose", "ps", "--format", "json"],
    { cwd: repoRoot, timeoutMs: STACK_OPERATION_TIMEOUT_MS }
  );

  if (!result.success) {
    return fail(result.error.message, "STACK_STATUS_FAILED");
  }

  const lines = result.data.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);

  const statuses: ContainerStatus[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      statuses.push({
        name: parsed.Service ?? parsed.Name,
        state: parsed.State,
        status: parsed.Status,
      });
    } catch {
      // Skip lines that aren't valid JSON (e.g. Docker Compose warning lines
      // printed to stdout even with --format json).
    }
  }

  return ok(statuses);
}
