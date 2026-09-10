import { findRepoRoot } from "@wpstack/core";

export function requireRepoRoot(): string {
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error("Error: not inside a High-Performance-Docker-WordPress repo (no docker-compose.yml found).");
    process.exit(1);
  }
  return repoRoot;
}
