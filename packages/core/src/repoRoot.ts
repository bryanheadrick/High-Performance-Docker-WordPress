import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export function findRepoRoot(startDir: string): string | null {
  let current = startDir;

  while (true) {
    if (existsSync(join(current, "docker-compose.yml"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveSiteContext(startDir: string): {
  repoRoot: string;
  domain: string | null;
} {
  const repoRoot = findRepoRoot(startDir);

  if (!repoRoot) {
    return { repoRoot: startDir, domain: null };
  }

  const sitesDir = join(repoRoot, "sites");
  const rel = relative(sitesDir, startDir);

  if (rel.startsWith("..") || rel === "") {
    return { repoRoot, domain: null };
  }

  const domain = rel.split(sep)[0];
  return { repoRoot, domain: domain || null };
}
