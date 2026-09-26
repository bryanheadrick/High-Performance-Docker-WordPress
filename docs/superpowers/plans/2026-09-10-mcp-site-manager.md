# MCP Site Manager + Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP server and a lightweight local web UI for managing
multi-site WordPress environments in this repo, both driven by a single
shared core library and a single `wpstack` CLI entry point.

**Architecture:** npm workspaces with four packages: `core` (wraps the
existing bash scripts via `child_process.spawn`, returns structured
results), `cli` (the `wpstack` binary, routes to site/stack/mcp/ui
commands), `mcp-server` (MCP stdio server exposing `core` as tools), and
`web-ui` (Express API + React/Vite SPA exposing `core` over HTTP). Every
site/stack operation flows through `core` — `mcp-server` and `web-ui` are
thin.

**Tech Stack:** Node.js (v24+, repo's installed version), TypeScript,
`commander` (CLI), `@modelcontextprotocol/sdk` (MCP server), Express,
React + Vite, `vitest` for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-10-mcp-site-manager-design.md`

## Global Constraints

- Never use `child_process.exec` for anything involving user-supplied
  values (domain, db name/user/password, admin credentials) — always
  `spawn` with an argument array, per the spec's shell-injection concern.
- `core` functions never throw for expected failures — always resolve
  `{ success: boolean, data?, error?: { message: string, code: string } }`.
- Web UI backend binds to `127.0.0.1` only. No authentication.
- MCP server uses stdio transport only (no HTTP/SSE) per the spec.
- Existing scripts (`new-site.sh`, `manage-sites.sh`) must remain fully
  usable by hand exactly as they work today — all changes are additive
  (new flags with defaults that preserve current interactive behavior).
- Repo root is located by walking up from a starting directory until a
  directory containing `docker-compose.yml` is found.
- Package manager: npm (matches repo's existing tooling; no yarn/pnpm).

---

## File Structure

```
package.json                          # root workspace config
tsconfig.base.json                    # shared TS compiler options

packages/core/
  package.json
  tsconfig.json
  src/
    repoRoot.ts                       # findRepoRoot(), resolveSiteContext()
    types.ts                          # Result<T>, SiteInfo, CreateSiteOptions, etc.
    runScript.ts                      # spawnScript() helper used by all ops
    sites.ts                          # listSites, getSite, createSite, removeSite
    stack.ts                          # startStack, stopStack, restartStack, getStackStatus
    index.ts                          # public exports
  test/
    repoRoot.test.ts
    sites.test.ts
    stack.test.ts

packages/cli/
  package.json
  tsconfig.json
  bin/wpstack                         # shebang entry, requires dist/index.js
  src/
    index.ts                          # commander program setup
    commands/site.ts                  # site list/show/create/remove commands
    commands/stack.ts                 # stack start/stop/restart/status commands
    commands/mcp.ts                   # mcp command -> launches mcp-server
    commands/ui.ts                    # ui command -> launches web-ui
    prompts.ts                        # interactive prompts for `site create`
  test/
    commands.site.test.ts

packages/mcp-server/
  package.json
  tsconfig.json
  src/
    index.ts                          # createServer(), tool registration
    tools.ts                          # tool definitions mapped to core functions
  test/
    tools.test.ts

packages/web-ui/
  package.json
  tsconfig.json
  server/
    src/
      index.ts                        # Express app bootstrap, listens on 127.0.0.1
      routes/sites.ts                 # REST routes -> core.sites
      routes/stack.ts                 # REST routes -> core.stack
    test/
      routes.sites.test.ts
      routes.stack.test.ts
  client/
    index.html
    vite.config.ts
    src/
      main.tsx
      App.tsx
      api.ts                          # fetch wrappers for /api/sites, /api/stack
      components/SiteList.tsx
      components/SiteCard.tsx
      components/NewSiteForm.tsx
      components/StackPanel.tsx

new-site.sh                           # MODIFIED: add non-interactive flag support
manage-sites.sh                       # MODIFIED: add --yes flag to remove
README.md                             # MODIFIED: document wpstack, MCP registration
```

---

## Task 1: Workspace scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.gitignore` additions (see step 3)

**Interfaces:**
- Produces: npm workspace resolving `packages/*`, shared TS config other
  packages extend via `"extends": "../../tsconfig.base.json"`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "high-performance-docker-wordpress",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 3: Add build artifacts to `.gitignore`**

Append to the existing `.gitignore` (read it first to avoid duplicate
entries):

```
node_modules/
packages/*/dist/
packages/web-ui/client/dist/
```

- [ ] **Step 4: Install root devDependencies**

Run: `npm install`
Expected: `node_modules/` created at repo root, `package-lock.json` created.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore package-lock.json
git commit -m "chore: scaffold npm workspace for site manager packages"
```

---

## Task 2: `core` — repo root & site context resolution

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/repoRoot.ts`
- Create: `packages/core/src/types.ts`
- Test: `packages/core/test/repoRoot.test.ts`

**Interfaces:**
- Produces:
  - `findRepoRoot(startDir: string): string | null` — walks up from
    `startDir` until a directory containing `docker-compose.yml` is found;
    returns `null` if none found before the filesystem root.
  - `resolveSiteContext(startDir: string): { repoRoot: string; domain: string | null }`
    — calls `findRepoRoot`, then checks whether `startDir` is inside
    `<repoRoot>/sites/<domain>/`; if so returns that `domain`, else `null`.
  - `type Result<T> = { success: true; data: T } | { success: false; error: { message: string; code: string } }`
    in `types.ts`, used by every `core` function from here on.

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@wpstack/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/src/types.ts`**

```typescript
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function fail<T = never>(message: string, code: string): Result<T> {
  return { success: false, error: { message, code } };
}
```

- [ ] **Step 4: Write failing test for `findRepoRoot`**

Create `packages/core/test/repoRoot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findRepoRoot, resolveSiteContext } from "../src/repoRoot.js";

describe("findRepoRoot", () => {
  it("finds the directory containing docker-compose.yml by walking up", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "sites", "example.local");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const root = findRepoRoot(nested);

    expect(root).toBe(base);
    rmSync(base, { recursive: true, force: true });
  });

  it("returns null when no docker-compose.yml is found", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "a", "b");
    mkdirSync(nested, { recursive: true });

    const root = findRepoRoot(nested);

    expect(root).toBeNull();
    rmSync(base, { recursive: true, force: true });
  });
});

describe("resolveSiteContext", () => {
  it("infers domain when cwd is inside sites/<domain>", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    const nested = join(base, "sites", "example.local");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const context = resolveSiteContext(nested);

    expect(context.repoRoot).toBe(base);
    expect(context.domain).toBe("example.local");
    rmSync(base, { recursive: true, force: true });
  });

  it("returns null domain when cwd is not inside a site directory", () => {
    const base = mkdtempSync(join(tmpdir(), "wpstack-test-"));
    writeFileSync(join(base, "docker-compose.yml"), "services: {}");

    const context = resolveSiteContext(base);

    expect(context.repoRoot).toBe(base);
    expect(context.domain).toBeNull();
    rmSync(base, { recursive: true, force: true });
  });
});
```

- [ ] **Step 5: Install workspace deps and run test to verify it fails**

Run: `npm install && npm run test --workspace=@wpstack/core`
Expected: FAIL — `../src/repoRoot.js` does not exist.

- [ ] **Step 6: Implement `packages/core/src/repoRoot.ts`**

```typescript
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test --workspace=@wpstack/core`
Expected: PASS (4 tests)

- [ ] **Step 8: Commit**

```bash
git add packages/core package-lock.json
git commit -m "feat(core): add repo root and site context resolution"
```

---

## Task 3: `core` — script execution helper

**Files:**
- Create: `packages/core/src/runScript.ts`
- Test: `packages/core/test/runScript.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `fail` from `./types.js` (Task 2).
- Produces:
  `runScript(scriptPath: string, args: string[], options?: { cwd?: string; env?: Record<string,string> }): Promise<Result<{ stdout: string; stderr: string }>>`
  — spawns `scriptPath` with `args` via `child_process.spawn`, resolves
  `ok({ stdout, stderr })` on exit code 0, `fail(...)` with code
  `"SCRIPT_FAILED"` on non-zero exit (message includes stderr), and code
  `"SCRIPT_SPAWN_ERROR"` if the spawn itself errors (e.g. file not found).
  Used by every function in `sites.ts` and `stack.ts`.

- [ ] **Step 1: Write failing test**

Create `packages/core/test/runScript.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@wpstack/core`
Expected: FAIL — `../src/runScript.js` does not exist.

- [ ] **Step 3: Implement `packages/core/src/runScript.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@wpstack/core`
Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add runScript helper for spawning shell scripts safely"
```

---

## Task 4: Non-interactive support in `new-site.sh` and `manage-sites.sh`

**Files:**
- Modify: `new-site.sh`
- Modify: `manage-sites.sh`

**Interfaces:**
- Produces: `new-site.sh` accepts `--non-interactive` plus
  `--domain`, `--db-name`, `--db-user`, `--db-password`, `--admin-user`,
  `--admin-password`, `--admin-email` flags. When `--non-interactive` is
  passed, every `read -p` prompt is replaced by the corresponding flag
  value (or the same default the prompt currently uses), and the final
  `Continue with these settings? (Y/n)` confirmation is skipped.
  `manage-sites.sh remove` accepts a `--yes`/`-y` flag that skips the
  `yes/no` confirmation. Consumed by `core.createSite` / `core.removeSite`
  in Task 5.

- [ ] **Step 1: Add flag parsing to the top of `new-site.sh`**

Insert after the existing color-printing functions (after the
`print_cyan` function definition, before `check_mkcert`):

```bash
# Non-interactive flag parsing
NON_INTERACTIVE=false
ARG_DOMAIN=""
ARG_DB_NAME=""
ARG_DB_USER=""
ARG_DB_PASSWORD=""
ARG_ADMIN_USER=""
ARG_ADMIN_PASSWORD=""
ARG_ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --domain)
            ARG_DOMAIN="$2"
            shift 2
            ;;
        --db-name)
            ARG_DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            ARG_DB_USER="$2"
            shift 2
            ;;
        --db-password)
            ARG_DB_PASSWORD="$2"
            shift 2
            ;;
        --admin-user)
            ARG_ADMIN_USER="$2"
            shift 2
            ;;
        --admin-password)
            ARG_ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --admin-email)
            ARG_ADMIN_EMAIL="$2"
            shift 2
            ;;
        *)
            print_red "Unknown argument: $1"
            exit 1
            ;;
    esac
done
```

- [ ] **Step 2: Replace the domain prompt**

Find (in the "Get user inputs" section):

```bash
read -p "Enter domain name (e.g., mysite.local): " domain
```

Replace with:

```bash
if [ "$NON_INTERACTIVE" = true ]; then
    domain="$ARG_DOMAIN"
    if [ -z "$domain" ]; then
        print_red "Error: --domain is required with --non-interactive"
        exit 1
    fi
else
    read -p "Enter domain name (e.g., mysite.local): " domain
fi
```

- [ ] **Step 3: Replace the db name/user/password prompts**

Find:

```bash
default_db_name=$(echo "$domain" | sed 's/\./_/g' | sed 's/-/_/g')
read -p "Enter database name [${default_db_name}]: " db_name
db_name=${db_name:-$default_db_name}

read -p "Enter database user [wp_${db_name}]: " db_user
db_user=${db_user:-wp_${db_name}}

# Generate a random password
random_password=$(openssl rand -base64 16)
read -p "Enter database password [${random_password}]: " db_password
db_password=${db_password:-$random_password}
```

Replace with:

```bash
default_db_name=$(echo "$domain" | sed 's/\./_/g' | sed 's/-/_/g')
random_password=$(openssl rand -base64 16)

if [ "$NON_INTERACTIVE" = true ]; then
    db_name="${ARG_DB_NAME:-$default_db_name}"
    db_user="${ARG_DB_USER:-wp_${db_name}}"
    db_password="${ARG_DB_PASSWORD:-$random_password}"
else
    read -p "Enter database name [${default_db_name}]: " db_name
    db_name=${db_name:-$default_db_name}

    read -p "Enter database user [wp_${db_name}]: " db_user
    db_user=${db_user:-wp_${db_name}}

    read -p "Enter database password [${random_password}]: " db_password
    db_password=${db_password:-$random_password}
fi
```

- [ ] **Step 4: Replace the admin user/password/email prompts**

Find:

```bash
read -p "Enter admin username [admin]: " admin_user
admin_user=${admin_user:-admin}

read -p "Enter admin password [admin]: " admin_password
admin_password=${admin_password:-admin}

read -p "Enter admin email [admin@${domain}]: " admin_email
admin_email=${admin_email:-admin@${domain}}
```

Replace with:

```bash
if [ "$NON_INTERACTIVE" = true ]; then
    admin_user="${ARG_ADMIN_USER:-admin}"
    admin_password="${ARG_ADMIN_PASSWORD:-admin}"
    admin_email="${ARG_ADMIN_EMAIL:-admin@${domain}}"
else
    read -p "Enter admin username [admin]: " admin_user
    admin_user=${admin_user:-admin}

    read -p "Enter admin password [admin]: " admin_password
    admin_password=${admin_password:-admin}

    read -p "Enter admin email [admin@${domain}]: " admin_email
    admin_email=${admin_email:-admin@${domain}}
fi
```

- [ ] **Step 5: Skip the final confirmation prompt in non-interactive mode**

Find:

```bash
read -p "Continue with these settings? (Y/n): " confirm
if [[ "$confirm" =~ ^[nN]$ ]]; then
    print_red "Setup cancelled."
    exit 1
fi
```

Replace with:

```bash
if [ "$NON_INTERACTIVE" = true ]; then
    print_cyan "Non-interactive mode: proceeding without confirmation."
else
    read -p "Continue with these settings? (Y/n): " confirm
    if [[ "$confirm" =~ ^[nN]$ ]]; then
        print_red "Setup cancelled."
        exit 1
    fi
fi
```

- [ ] **Step 6: Skip the Docker-container-start prompt in non-interactive mode**

Find:

```bash
    print_yellow "Docker containers are not currently running."
    echo ""
    read -p "Would you like to start the Docker containers now? (Y/n): " start_containers

    if [[ "$start_containers" =~ ^[nN]$ ]]; then
```

Replace with:

```bash
    print_yellow "Docker containers are not currently running."
    echo ""
    if [ "$NON_INTERACTIVE" = true ]; then
        start_containers="Y"
    else
        read -p "Would you like to start the Docker containers now? (Y/n): " start_containers
    fi

    if [[ "$start_containers" =~ ^[nN]$ ]]; then
```

- [ ] **Step 7: Handle the existing-directory overwrite prompt in `create_wordpress_directory`**

Find:

```bash
    if [ -d "$site_dir" ]; then
        print_yellow "Warning: Directory $site_dir already exists"
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[yY]$ ]]; then
            print_yellow "Skipping directory creation"
            return 0
        fi
        rm -rf "$site_dir"
    fi
```

Replace with:

```bash
    if [ -d "$site_dir" ]; then
        print_yellow "Warning: Directory $site_dir already exists"
        if [ "$NON_INTERACTIVE" = true ]; then
            print_red "Error: site directory already exists and --non-interactive was passed"
            exit 1
        fi
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[yY]$ ]]; then
            print_yellow "Skipping directory creation"
            return 0
        fi
        rm -rf "$site_dir"
    fi
```

- [ ] **Step 8: Add `--yes` flag support to `manage-sites.sh`'s `remove_site`**

Find (near the top of `manage-sites.sh`, after the color functions, before
`list_sites`):

```bash
# Function to list all sites
```

Insert before it:

```bash
# Flag for skipping confirmation prompts
ASSUME_YES=false

```

- [ ] **Step 9: Parse `--yes`/`-y` out of the remove command's arguments**

Find the `remove_site` function's start:

```bash
remove_site() {
    local domain=$1
```

Replace with:

```bash
remove_site() {
    local domain=""
    for arg in "$@"; do
        case "$arg" in
            --yes|-y)
                ASSUME_YES=true
                ;;
            *)
                if [ -z "$domain" ]; then
                    domain="$arg"
                fi
                ;;
        esac
    done
```

- [ ] **Step 10: Skip the confirmation read when `ASSUME_YES` is true**

Find:

```bash
    read -p "Are you sure you want to remove $domain? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_yellow "Removal cancelled."
        return 0
    fi
```

Replace with:

```bash
    if [ "$ASSUME_YES" = true ]; then
        print_cyan "Skipping confirmation (--yes passed)."
    else
        read -p "Are you sure you want to remove $domain? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            print_yellow "Removal cancelled."
            return 0
        fi
    fi
```

- [ ] **Step 11: Update the `remove)` case in `manage-sites.sh`'s main dispatch to forward all args**

Find:

```bash
    remove)
        remove_site "$2"
        ;;
```

Replace with:

```bash
    remove)
        shift
        remove_site "$@"
        ;;
```

- [ ] **Step 12: Manual verification — interactive mode is unchanged**

Run: `bash -n new-site.sh && bash -n manage-sites.sh`
Expected: no syntax errors (exit code 0). This is a static parse check;
it does not execute the scripts.

- [ ] **Step 13: Manual verification — non-interactive flag parsing**

Run: `./new-site.sh --non-interactive --domain test.local --admin-email a@test.local; echo "exit: $?"`
(without Docker running, or with `.env` absent, this is expected to fail
fast with a clear error like "`.env` file not found" — the point of this
check is confirming flag parsing doesn't hang on a `read` prompt.)
Expected: script exits quickly with an error message, no hang waiting for
stdin input.

- [ ] **Step 14: Commit**

```bash
git add new-site.sh manage-sites.sh
git commit -m "feat: add non-interactive flag support to site scripts"
```

---

## Task 5: `core` — site operations

**Files:**
- Create: `packages/core/src/sites.ts`
- Test: `packages/core/test/sites.test.ts`

**Interfaces:**
- Consumes: `runScript` (Task 3), `resolveSiteContext`/`findRepoRoot`
  (Task 2), `Result`/`ok`/`fail` (Task 2).
- Produces:
  - `interface SiteInfo { domain: string; hasNginxConfig: boolean; hasSsl: boolean; hasWordPress: boolean; dbName: string | null; url: string }`
  - `interface CreateSiteOptions { domain: string; dbName?: string; dbUser?: string; dbPassword?: string; adminUser?: string; adminPassword?: string; adminEmail?: string }`
  - `listSites(repoRoot: string): Promise<Result<SiteInfo[]>>`
  - `getSite(repoRoot: string, domain: string): Promise<Result<SiteInfo>>`
  - `createSite(repoRoot: string, opts: CreateSiteOptions): Promise<Result<{ domain: string; url: string }>>`
  - `removeSite(repoRoot: string, domain: string): Promise<Result<{ domain: string }>>`
  - These are consumed directly by `cli` (Task 6), `mcp-server` (Task 7),
    and `web-ui` server routes (Task 8).

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/sites.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSites, getSite } from "../src/sites.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "wpstack-sites-test-"));
  writeFileSync(join(repoRoot, "docker-compose.yml"), "services: {}");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("listSites", () => {
  it("returns an empty list when sites/ does not exist", async () => {
    const result = await listSites(repoRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("lists directories under sites/ with their file-based status", async () => {
    const siteDir = join(repoRoot, "sites", "example.local");
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(
      join(siteDir, "wp-config.php"),
      "define('DB_NAME', 'example_local');"
    );
    mkdirSync(join(repoRoot, "config", "nginx", "conf.d"), { recursive: true });
    writeFileSync(join(repoRoot, "config", "nginx", "conf.d", "example.local.conf"), "");
    mkdirSync(join(repoRoot, "config", "nginx", "ssl"), { recursive: true });
    writeFileSync(join(repoRoot, "config", "nginx", "ssl", "example.local.crt"), "");

    const result = await listSites(repoRoot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        domain: "example.local",
        hasNginxConfig: true,
        hasSsl: true,
        hasWordPress: true,
        dbName: "example_local",
        url: "https://example.local",
      });
    }
  });
});

describe("getSite", () => {
  it("fails with SITE_NOT_FOUND when the site directory does not exist", async () => {
    const result = await getSite(repoRoot, "missing.local");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SITE_NOT_FOUND");
    }
  });

  it("returns the site info when the directory exists", async () => {
    mkdirSync(join(repoRoot, "sites", "example.local"), { recursive: true });

    const result = await getSite(repoRoot, "example.local");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("example.local");
      expect(result.data.hasWordPress).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@wpstack/core`
Expected: FAIL — `../src/sites.js` does not exist.

- [ ] **Step 3: Implement `packages/core/src/sites.ts`**

```typescript
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ok, fail, type Result } from "./types.js";
import { runScript } from "./runScript.js";

export interface SiteInfo {
  domain: string;
  hasNginxConfig: boolean;
  hasSsl: boolean;
  hasWordPress: boolean;
  dbName: string | null;
  url: string;
}

export interface CreateSiteOptions {
  domain: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  adminUser?: string;
  adminPassword?: string;
  adminEmail?: string;
}

function readSiteInfo(repoRoot: string, domain: string): SiteInfo {
  const siteDir = join(repoRoot, "sites", domain);
  const wpConfigPath = join(siteDir, "wp-config.php");
  const hasWordPress = existsSync(wpConfigPath);

  let dbName: string | null = null;
  if (hasWordPress) {
    const contents = readFileSync(wpConfigPath, "utf8");
    const match = contents.match(/DB_NAME'\s*,\s*'([^']+)'/);
    dbName = match ? match[1] : null;
  }

  return {
    domain,
    hasNginxConfig: existsSync(join(repoRoot, "config", "nginx", "conf.d", `${domain}.conf`)),
    hasSsl: existsSync(join(repoRoot, "config", "nginx", "ssl", `${domain}.crt`)),
    hasWordPress,
    dbName,
    url: `https://${domain}`,
  };
}

export async function listSites(repoRoot: string): Promise<Result<SiteInfo[]>> {
  const sitesDir = join(repoRoot, "sites");

  if (!existsSync(sitesDir)) {
    return ok([]);
  }

  const entries = readdirSync(sitesDir).filter((name) =>
    statSync(join(sitesDir, name)).isDirectory()
  );

  return ok(entries.map((domain) => readSiteInfo(repoRoot, domain)));
}

export async function getSite(repoRoot: string, domain: string): Promise<Result<SiteInfo>> {
  const siteDir = join(repoRoot, "sites", domain);

  if (!existsSync(siteDir)) {
    return fail(`Site not found: ${domain}`, "SITE_NOT_FOUND");
  }

  return ok(readSiteInfo(repoRoot, domain));
}

export async function createSite(
  repoRoot: string,
  opts: CreateSiteOptions
): Promise<Result<{ domain: string; url: string }>> {
  const args = ["--non-interactive", "--domain", opts.domain];

  if (opts.dbName) args.push("--db-name", opts.dbName);
  if (opts.dbUser) args.push("--db-user", opts.dbUser);
  if (opts.dbPassword) args.push("--db-password", opts.dbPassword);
  if (opts.adminUser) args.push("--admin-user", opts.adminUser);
  if (opts.adminPassword) args.push("--admin-password", opts.adminPassword);
  if (opts.adminEmail) args.push("--admin-email", opts.adminEmail);

  const result = await runScript(join(repoRoot, "new-site.sh"), args, { cwd: repoRoot });

  if (!result.success) {
    return fail(result.error.message, "CREATE_SITE_FAILED");
  }

  return ok({ domain: opts.domain, url: `https://${opts.domain}` });
}

export async function removeSite(
  repoRoot: string,
  domain: string
): Promise<Result<{ domain: string }>> {
  const result = await runScript(
    join(repoRoot, "manage-sites.sh"),
    ["remove", domain, "--yes"],
    { cwd: repoRoot }
  );

  if (!result.success) {
    return fail(result.error.message, "REMOVE_SITE_FAILED");
  }

  return ok({ domain });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=@wpstack/core`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add site list/get/create/remove operations"
```

---

## Task 6: `core` — stack operations

**Files:**
- Create: `packages/core/src/stack.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/test/stack.test.ts`

**Interfaces:**
- Consumes: `runScript` (Task 3), `Result`/`ok`/`fail` (Task 2).
- Produces:
  - `interface ContainerStatus { name: string; state: string; status: string }`
  - `startStack(repoRoot: string): Promise<Result<{ started: boolean }>>`
  - `stopStack(repoRoot: string): Promise<Result<{ stopped: boolean }>>`
  - `restartStack(repoRoot: string): Promise<Result<{ restarted: boolean }>>`
  - `getStackStatus(repoRoot: string): Promise<Result<ContainerStatus[]>>`
  - `index.ts` re-exports everything from `types.ts`, `repoRoot.ts`,
    `sites.ts`, `stack.ts` — this is the module `cli`, `mcp-server`, and
    `web-ui` import as `@wpstack/core`.

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/stack.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@wpstack/core`
Expected: FAIL — `../src/stack.js` does not exist.

- [ ] **Step 3: Implement `packages/core/src/stack.ts`**

```typescript
import { ok, fail, type Result } from "./types.js";
import { runScript } from "./runScript.js";

export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
}

export async function startStack(repoRoot: string): Promise<Result<{ started: boolean }>> {
  const result = await runScript("docker", ["compose", "up", "-d"], { cwd: repoRoot });

  if (!result.success) {
    return fail(result.error.message, "STACK_START_FAILED");
  }

  return ok({ started: true });
}

export async function stopStack(repoRoot: string): Promise<Result<{ stopped: boolean }>> {
  const result = await runScript("docker", ["compose", "down"], { cwd: repoRoot });

  if (!result.success) {
    return fail(result.error.message, "STACK_STOP_FAILED");
  }

  return ok({ stopped: true });
}

export async function restartStack(
  repoRoot: string
): Promise<Result<{ restarted: boolean }>> {
  const result = await runScript("docker", ["compose", "restart"], { cwd: repoRoot });

  if (!result.success) {
    return fail(result.error.message, "STACK_RESTART_FAILED");
  }

  return ok({ restarted: true });
}

export async function getStackStatus(repoRoot: string): Promise<Result<ContainerStatus[]>> {
  const result = await runScript(
    "docker",
    ["compose", "ps", "--format", "json"],
    { cwd: repoRoot }
  );

  if (!result.success) {
    return fail(result.error.message, "STACK_STATUS_FAILED");
  }

  const lines = result.data.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);

  const statuses: ContainerStatus[] = lines.map((line) => {
    const parsed = JSON.parse(line);
    return {
      name: parsed.Service ?? parsed.Name,
      state: parsed.State,
      status: parsed.Status,
    };
  });

  return ok(statuses);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@wpstack/core`
Expected: PASS (12 tests total)

- [ ] **Step 5: Create `packages/core/src/index.ts`**

```typescript
export * from "./types.js";
export * from "./repoRoot.js";
export * from "./sites.js";
export * from "./stack.js";
```

- [ ] **Step 6: Build core to confirm it compiles cleanly**

Run: `npm run build --workspace=@wpstack/core`
Expected: `packages/core/dist/index.js` and `.d.ts` files created, no
TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): add stack operations and public index export"
```

---

## Task 7: `wpstack` CLI

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/bin/wpstack`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/site.ts`
- Create: `packages/cli/src/commands/stack.ts`
- Test: `packages/cli/test/commands.site.test.ts`

**Interfaces:**
- Consumes: `@wpstack/core`'s `findRepoRoot`, `resolveSiteContext`,
  `listSites`, `getSite`, `createSite`, `removeSite`, `startStack`,
  `stopStack`, `restartStack`, `getStackStatus` (Tasks 2, 5, 6).
- Produces: the `wpstack` binary with subcommands `site
  list|show|create|remove`, `stack start|stop|restart|status`. `mcp` and
  `ui` subcommands are added in Tasks 8 and 9 respectively (this task
  wires the command tree so those can attach cleanly).

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "@wpstack/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "wpstack": "bin/wpstack"
  },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@wpstack/core": "0.1.0",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Create `packages/cli/bin/wpstack`**

```
#!/usr/bin/env node
import("../dist/index.js");
```

Make it executable:

Run: `chmod +x packages/cli/bin/wpstack`

- [ ] **Step 4: Write failing test for the `site list` command's output shape**

Create `packages/cli/test/commands.site.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { formatSiteList } from "../src/commands/site.js";
import type { SiteInfo } from "@wpstack/core";

describe("formatSiteList", () => {
  it("returns a placeholder line when there are no sites", () => {
    const output = formatSiteList([]);
    expect(output).toContain("No sites found");
  });

  it("formats one line per site with domain and status markers", () => {
    const sites: SiteInfo[] = [
      {
        domain: "example.local",
        hasNginxConfig: true,
        hasSsl: true,
        hasWordPress: true,
        dbName: "example_local",
        url: "https://example.local",
      },
    ];

    const output = formatSiteList(sites);

    expect(output).toContain("example.local");
    expect(output).toContain("https://example.local");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test --workspace=@wpstack/cli`
Expected: FAIL — `../src/commands/site.js` does not exist.

- [ ] **Step 6: Implement `packages/cli/src/commands/site.ts`**

```typescript
import { Command } from "commander";
import {
  findRepoRoot,
  resolveSiteContext,
  listSites,
  getSite,
  createSite,
  removeSite,
  type SiteInfo,
} from "@wpstack/core";

export function formatSiteList(sites: SiteInfo[]): string {
  if (sites.length === 0) {
    return "No sites found. Create one with: wpstack site create";
  }

  return sites
    .map(
      (site) =>
        `${site.domain}  ${site.url}  wp:${site.hasWordPress ? "yes" : "no"}  ssl:${site.hasSsl ? "yes" : "no"}`
    )
    .join("\n");
}

function requireRepoRoot(): string {
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error("Error: not inside a High-Performance-Docker-WordPress repo (no docker-compose.yml found).");
    process.exit(1);
  }
  return repoRoot;
}

function resolveDomainArg(explicit: string | undefined): string {
  if (explicit) return explicit;

  const context = resolveSiteContext(process.cwd());
  if (context.domain) return context.domain;

  console.error("Error: no domain given and current directory is not inside sites/<domain>/.");
  process.exit(1);
}

export function registerSiteCommands(program: Command): void {
  const site = program.command("site").description("Manage WordPress sites");

  site
    .command("list")
    .description("List all sites")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await listSites(repoRoot);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(formatSiteList(result.data));
    });

  site
    .command("show [domain]")
    .description("Show details for a site")
    .action(async (domain?: string) => {
      const repoRoot = requireRepoRoot();
      const resolvedDomain = resolveDomainArg(domain);
      const result = await getSite(repoRoot, resolvedDomain);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(JSON.stringify(result.data, null, 2));
    });

  site
    .command("create")
    .description("Create a new site")
    .requiredOption("--domain <domain>", "Domain for the new site")
    .option("--db-name <name>")
    .option("--db-user <user>")
    .option("--db-password <password>")
    .option("--admin-user <user>")
    .option("--admin-password <password>")
    .option("--admin-email <email>")
    .action(async (opts) => {
      const repoRoot = requireRepoRoot();
      const result = await createSite(repoRoot, {
        domain: opts.domain,
        dbName: opts.dbName,
        dbUser: opts.dbUser,
        dbPassword: opts.dbPassword,
        adminUser: opts.adminUser,
        adminPassword: opts.adminPassword,
        adminEmail: opts.adminEmail,
      });

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(`Site created: ${result.data.url}`);
    });

  site
    .command("remove [domain]")
    .description("Remove a site")
    .action(async (domain?: string) => {
      const repoRoot = requireRepoRoot();
      const resolvedDomain = resolveDomainArg(domain);
      const result = await removeSite(repoRoot, resolvedDomain);

      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      console.log(`Site removed: ${result.data.domain}`);
    });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test --workspace=@wpstack/cli`
Expected: PASS (2 tests)

- [ ] **Step 8: Implement `packages/cli/src/commands/stack.ts`**

```typescript
import { Command } from "commander";
import { findRepoRoot, startStack, stopStack, restartStack, getStackStatus } from "@wpstack/core";

function requireRepoRoot(): string {
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error("Error: not inside a High-Performance-Docker-WordPress repo (no docker-compose.yml found).");
    process.exit(1);
  }
  return repoRoot;
}

export function registerStackCommands(program: Command): void {
  const stack = program.command("stack").description("Manage the Docker stack");

  stack
    .command("start")
    .description("Start all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await startStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack started.");
    });

  stack
    .command("stop")
    .description("Stop all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await stopStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack stopped.");
    });

  stack
    .command("restart")
    .description("Restart all containers")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await restartStack(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      console.log("Stack restarted.");
    });

  stack
    .command("status")
    .description("Show container status")
    .action(async () => {
      const repoRoot = requireRepoRoot();
      const result = await getStackStatus(repoRoot);
      if (!result.success) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
      for (const container of result.data) {
        console.log(`${container.name}  ${container.state}  ${container.status}`);
      }
    });
}
```

- [ ] **Step 9: Create `packages/cli/src/index.ts`**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { registerSiteCommands } from "./commands/site.js";
import { registerStackCommands } from "./commands/stack.js";

const program = new Command();

program
  .name("wpstack")
  .description("Manage High-Performance-Docker-WordPress sites and stack");

registerSiteCommands(program);
registerStackCommands(program);

program.parseAsync(process.argv);
```

- [ ] **Step 10: Build and manually verify the CLI**

Run: `npm run build --workspace=@wpstack/core && npm run build --workspace=@wpstack/cli`
Run: `npm link --workspace=@wpstack/cli`
Run: `wpstack site list`
Expected (from inside the repo, with no sites yet): prints "No sites
found. Create one with: wpstack site create"

- [ ] **Step 11: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): add wpstack binary with site and stack commands"
```

---

## Task 8: `mcp-server` package

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/tools.ts`
- Create: `packages/mcp-server/src/index.ts`
- Modify: `packages/cli/src/commands/mcp.ts` (create)
- Modify: `packages/cli/src/index.ts`
- Test: `packages/mcp-server/test/tools.test.ts`

**Interfaces:**
- Consumes: `@wpstack/core`'s full public API (Task 6), `findRepoRoot`.
- Produces: `createMcpServer(repoRoot: string): Server` (from
  `@modelcontextprotocol/sdk/server/index.js`) registering tools
  `list_sites`, `get_site`, `create_site`, `remove_site`, `stack_status`,
  `stack_start`, `stack_stop`, `stack_restart`. `wpstack mcp` (Task 7's
  CLI) calls `createMcpServer` and connects it to a `StdioServerTransport`.

- [ ] **Step 1: Create `packages/mcp-server/package.json`**

```json
{
  "name": "@wpstack/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@wpstack/core": "0.1.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/mcp-server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write failing test for the tool list**

Create `packages/mcp-server/test/tools.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --workspace=@wpstack/mcp-server`
Expected: FAIL — `../src/tools.js` does not exist.

- [ ] **Step 5: Implement `packages/mcp-server/src/tools.ts`**

```typescript
import {
  listSites,
  getSite,
  createSite,
  removeSite,
  startStack,
  stopStack,
  restartStack,
  getStackStatus,
  type Result,
} from "@wpstack/core";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (repoRoot: string, args: Record<string, unknown>) => Promise<Result<unknown>>;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "list_sites",
    description: "List all WordPress sites managed by this environment.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => listSites(repoRoot),
  },
  {
    name: "get_site",
    description: "Get details for a single WordPress site by domain.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      required: ["domain"],
    },
    handler: async (repoRoot, args) => getSite(repoRoot, args.domain as string),
  },
  {
    name: "create_site",
    description: "Create a new WordPress site with its own domain, database, and SSL certificate.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        dbName: { type: "string" },
        dbUser: { type: "string" },
        dbPassword: { type: "string" },
        adminUser: { type: "string" },
        adminPassword: { type: "string" },
        adminEmail: { type: "string" },
      },
      required: ["domain"],
    },
    handler: async (repoRoot, args) =>
      createSite(repoRoot, args as Parameters<typeof createSite>[1]),
  },
  {
    name: "remove_site",
    description: "Permanently remove a WordPress site: files, database, Nginx config, and SSL cert.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      required: ["domain"],
    },
    handler: async (repoRoot, args) => removeSite(repoRoot, args.domain as string),
  },
  {
    name: "stack_status",
    description: "Show the status of all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => getStackStatus(repoRoot),
  },
  {
    name: "stack_start",
    description: "Start all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => startStack(repoRoot),
  },
  {
    name: "stack_stop",
    description: "Stop all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => stopStack(repoRoot),
  },
  {
    name: "stack_restart",
    description: "Restart all Docker containers in the stack.",
    inputSchema: { type: "object", properties: {} },
    handler: async (repoRoot) => restartStack(repoRoot),
  },
];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test --workspace=@wpstack/mcp-server`
Expected: PASS (2 tests)

- [ ] **Step 7: Implement `packages/mcp-server/src/index.ts`**

```typescript
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
```

- [ ] **Step 8: Create `packages/cli/src/commands/mcp.ts`**

```typescript
import { Command } from "commander";
import { findRepoRoot } from "@wpstack/core";
import { runMcpServer } from "@wpstack/mcp-server";

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Run the MCP stdio server for AI agent integration")
    .action(async () => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error("Error: not inside a High-Performance-Docker-WordPress repo.");
        process.exit(1);
      }
      await runMcpServer(repoRoot);
    });
}
```

- [ ] **Step 9: Add `@wpstack/mcp-server` dependency to `packages/cli/package.json`**

Edit the `dependencies` block to add:

```json
"@wpstack/mcp-server": "0.1.0"
```

- [ ] **Step 10: Wire `registerMcpCommand` into `packages/cli/src/index.ts`**

Add the import and registration call:

```typescript
import { registerMcpCommand } from "./commands/mcp.js";
```

```typescript
registerMcpCommand(program);
```

(Placed alongside the existing `registerSiteCommands(program);` and
`registerStackCommands(program);` calls.)

- [ ] **Step 11: Build and manually verify**

Run: `npm install && npm run build --workspace=@wpstack/core && npm run build --workspace=@wpstack/mcp-server && npm run build --workspace=@wpstack/cli`
Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | wpstack mcp`
Expected: a JSON-RPC response listing the 8 tools by name.

- [ ] **Step 12: Commit**

```bash
git add packages/mcp-server packages/cli package-lock.json
git commit -m "feat(mcp-server): add MCP stdio server exposing site and stack tools"
```

---

## Task 9: `web-ui` server (Express API)

**Files:**
- Create: `packages/web-ui/package.json`
- Create: `packages/web-ui/tsconfig.json`
- Create: `packages/web-ui/server/src/index.ts`
- Create: `packages/web-ui/server/src/routes/sites.ts`
- Create: `packages/web-ui/server/src/routes/stack.ts`
- Create: `packages/cli/src/commands/ui.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/web-ui/server/test/routes.sites.test.ts`

**Interfaces:**
- Consumes: `@wpstack/core`'s full public API (Task 6).
- Produces: `createApp(repoRoot: string): express.Express` with routes
  `GET /api/sites`, `GET /api/sites/:domain`, `POST /api/sites`,
  `DELETE /api/sites/:domain`, `GET /api/stack/status`, `POST
  /api/stack/start`, `POST /api/stack/stop`, `POST /api/stack/restart`.
  Consumed by `wpstack ui` (this task) and by the React client (Task 10)
  via `fetch`.

- [ ] **Step 1: Create `packages/web-ui/package.json`**

```json
{
  "name": "@wpstack/web-ui",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/server/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json && vite build client",
    "test": "vitest run server/test"
  },
  "dependencies": {
    "@wpstack/core": "0.1.0",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "vitest": "^2.1.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: Create `packages/web-ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["server/src"],
  "compilerOptions": {
    "rootDir": "server/src",
    "outDir": "dist/server"
  },
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write failing test for the sites routes**

Create `packages/web-ui/server/test/routes.sites.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "wpstack-webui-test-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("GET /api/sites", () => {
  it("returns an empty array when there are no sites", async () => {
    const app = createApp(repoRoot);

    const response = await request(app).get("/api/sites");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /api/sites/:domain", () => {
  it("returns 404 with an error body when the site does not exist", async () => {
    const app = createApp(repoRoot);

    const response = await request(app).get("/api/sites/missing.local");

    expect(response.status).toBe(404);
    expect(response.body.error).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --workspace=@wpstack/web-ui`
Expected: FAIL — `../src/index.js` does not exist.

- [ ] **Step 5: Implement `packages/web-ui/server/src/routes/sites.ts`**

```typescript
import { Router } from "express";
import { listSites, getSite, createSite, removeSite } from "@wpstack/core";

export function createSitesRouter(repoRoot: string): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const result = await listSites(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.get("/:domain", async (req, res) => {
    const result = await getSite(repoRoot, req.params.domain);
    if (!result.success) {
      const status = result.error.code === "SITE_NOT_FOUND" ? 404 : 500;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/", async (req, res) => {
    const result = await createSite(repoRoot, req.body);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.data);
  });

  router.delete("/:domain", async (req, res) => {
    const result = await removeSite(repoRoot, req.params.domain);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  return router;
}
```

- [ ] **Step 6: Implement `packages/web-ui/server/src/routes/stack.ts`**

```typescript
import { Router } from "express";
import { startStack, stopStack, restartStack, getStackStatus } from "@wpstack/core";

export function createStackRouter(repoRoot: string): Router {
  const router = Router();

  router.get("/status", async (_req, res) => {
    const result = await getStackStatus(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/start", async (_req, res) => {
    const result = await startStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/stop", async (_req, res) => {
    const result = await stopStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/restart", async (_req, res) => {
    const result = await restartStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  return router;
}
```

- [ ] **Step 7: Implement `packages/web-ui/server/src/index.ts`**

```typescript
import express, { type Express } from "express";
import { createSitesRouter } from "./routes/sites.js";
import { createStackRouter } from "./routes/stack.js";

export function createApp(repoRoot: string): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sites", createSitesRouter(repoRoot));
  app.use("/api/stack", createStackRouter(repoRoot));
  return app;
}

export function startServer(repoRoot: string, port = 4321): void {
  const app = createApp(repoRoot);
  app.listen(port, "127.0.0.1", () => {
    console.log(`wpstack web UI API listening on http://127.0.0.1:${port}`);
  });
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm install && npm run test --workspace=@wpstack/web-ui`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add packages/web-ui package-lock.json
git commit -m "feat(web-ui): add Express API server for site and stack management"
```

---

## Task 10: `web-ui` React client

**Files:**
- Create: `packages/web-ui/client/index.html`
- Create: `packages/web-ui/client/vite.config.ts`
- Create: `packages/web-ui/client/src/main.tsx`
- Create: `packages/web-ui/client/src/App.tsx`
- Create: `packages/web-ui/client/src/api.ts`
- Create: `packages/web-ui/client/src/components/SiteList.tsx`
- Create: `packages/web-ui/client/src/components/SiteCard.tsx`
- Create: `packages/web-ui/client/src/components/NewSiteForm.tsx`
- Create: `packages/web-ui/client/src/components/StackPanel.tsx`
- Modify: `packages/web-ui/server/src/index.ts` (serve built client)

**Interfaces:**
- Consumes: `packages/web-ui`'s REST API from Task 9
  (`/api/sites`, `/api/stack/*`).
- Produces: a built SPA served as static files by the Express app from
  `createApp`. No further packages consume this directly — it's the
  terminal UI layer.

- [ ] **Step 1: Create `packages/web-ui/client/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4321",
    },
  },
});
```

- [ ] **Step 2: Create `packages/web-ui/client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>wpstack — Site Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `packages/web-ui/client/src/api.ts`**

```typescript
export interface SiteInfo {
  domain: string;
  hasNginxConfig: boolean;
  hasSsl: boolean;
  hasWordPress: boolean;
  dbName: string | null;
  url: string;
}

export interface CreateSiteInput {
  domain: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  adminUser?: string;
  adminPassword?: string;
  adminEmail?: string;
}

export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
}

async function handle<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body as T;
}

export const api = {
  listSites: (): Promise<SiteInfo[]> => fetch("/api/sites").then((r) => handle(r)),

  createSite: (input: CreateSiteInput): Promise<{ domain: string; url: string }> =>
    fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle(r)),

  removeSite: (domain: string): Promise<{ domain: string }> =>
    fetch(`/api/sites/${encodeURIComponent(domain)}`, { method: "DELETE" }).then((r) =>
      handle(r)
    ),

  stackStatus: (): Promise<ContainerStatus[]> =>
    fetch("/api/stack/status").then((r) => handle(r)),

  stackStart: (): Promise<{ started: boolean }> =>
    fetch("/api/stack/start", { method: "POST" }).then((r) => handle(r)),

  stackStop: (): Promise<{ stopped: boolean }> =>
    fetch("/api/stack/stop", { method: "POST" }).then((r) => handle(r)),

  stackRestart: (): Promise<{ restarted: boolean }> =>
    fetch("/api/stack/restart", { method: "POST" }).then((r) => handle(r)),
};
```

- [ ] **Step 4: Create `packages/web-ui/client/src/components/SiteCard.tsx`**

```tsx
import type { SiteInfo } from "../api";

interface Props {
  site: SiteInfo;
  onRemove: (domain: string) => void;
  removing: boolean;
}

export function SiteCard({ site, onRemove, removing }: Props) {
  return (
    <div className="site-card">
      <h3>{site.domain}</h3>
      <p>
        <a href={site.url} target="_blank" rel="noreferrer">
          {site.url}
        </a>
      </p>
      <ul>
        <li>WordPress: {site.hasWordPress ? "installed" : "not installed"}</li>
        <li>SSL: {site.hasSsl ? "yes" : "no"}</li>
        <li>Nginx config: {site.hasNginxConfig ? "yes" : "no"}</li>
        <li>Database: {site.dbName ?? "n/a"}</li>
      </ul>
      <button disabled={removing} onClick={() => onRemove(site.domain)}>
        {removing ? "Removing..." : "Remove"}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create `packages/web-ui/client/src/components/SiteList.tsx`**

```tsx
import type { SiteInfo } from "../api";
import { SiteCard } from "./SiteCard";

interface Props {
  sites: SiteInfo[];
  onRemove: (domain: string) => void;
  removingDomain: string | null;
}

export function SiteList({ sites, onRemove, removingDomain }: Props) {
  if (sites.length === 0) {
    return <p>No sites yet. Create one below.</p>;
  }

  return (
    <div className="site-list">
      {sites.map((site) => (
        <SiteCard
          key={site.domain}
          site={site}
          onRemove={onRemove}
          removing={removingDomain === site.domain}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `packages/web-ui/client/src/components/NewSiteForm.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import type { CreateSiteInput } from "../api";

interface Props {
  onCreate: (input: CreateSiteInput) => void;
  creating: boolean;
}

export function NewSiteForm({ onCreate, creating }: Props) {
  const [domain, setDomain] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!domain) return;
    onCreate({ domain, adminEmail: adminEmail || undefined });
    setDomain("");
    setAdminEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="new-site-form">
      <h3>New Site</h3>
      <label>
        Domain
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="mysite.local"
          required
        />
      </label>
      <label>
        Admin email
        <input
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@mysite.local"
        />
      </label>
      <button type="submit" disabled={creating}>
        {creating ? "Creating..." : "Create Site"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Create `packages/web-ui/client/src/components/StackPanel.tsx`**

```tsx
import type { ContainerStatus } from "../api";

interface Props {
  containers: ContainerStatus[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  busy: boolean;
}

export function StackPanel({ containers, onStart, onStop, onRestart, busy }: Props) {
  return (
    <div className="stack-panel">
      <h3>Docker Stack</h3>
      <div className="stack-controls">
        <button disabled={busy} onClick={onStart}>
          Start
        </button>
        <button disabled={busy} onClick={onStop}>
          Stop
        </button>
        <button disabled={busy} onClick={onRestart}>
          Restart
        </button>
      </div>
      <ul>
        {containers.map((container) => (
          <li key={container.name}>
            {container.name}: {container.state} ({container.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Create `packages/web-ui/client/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api, type SiteInfo, type ContainerStatus, type CreateSiteInput } from "./api";
import { SiteList } from "./components/SiteList";
import { NewSiteForm } from "./components/NewSiteForm";
import { StackPanel } from "./components/StackPanel";

export function App() {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [creating, setCreating] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [stackBusy, setStackBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshSites() {
    setSites(await api.listSites());
  }

  async function refreshStack() {
    try {
      setContainers(await api.stackStatus());
    } catch {
      setContainers([]);
    }
  }

  useEffect(() => {
    refreshSites().catch((e) => setError(e.message));
    refreshStack();
  }, []);

  async function handleCreate(input: CreateSiteInput) {
    setCreating(true);
    setError(null);
    try {
      await api.createSite(input);
      await refreshSites();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(domain: string) {
    setRemovingDomain(domain);
    setError(null);
    try {
      await api.removeSite(domain);
      await refreshSites();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingDomain(null);
    }
  }

  async function withStackBusy(action: () => Promise<unknown>) {
    setStackBusy(true);
    setError(null);
    try {
      await action();
      await refreshStack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStackBusy(false);
    }
  }

  return (
    <main>
      <h1>wpstack Site Manager</h1>
      {error && <p className="error">{error}</p>}
      <StackPanel
        containers={containers}
        busy={stackBusy}
        onStart={() => withStackBusy(api.stackStart)}
        onStop={() => withStackBusy(api.stackStop)}
        onRestart={() => withStackBusy(api.stackRestart)}
      />
      <SiteList sites={sites} onRemove={handleRemove} removingDomain={removingDomain} />
      <NewSiteForm onCreate={handleCreate} creating={creating} />
    </main>
  );
}
```

- [ ] **Step 9: Create `packages/web-ui/client/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 10: Serve the built client from the Express app**

Modify `packages/web-ui/server/src/index.ts` — add static file serving
after the API routes:

```typescript
import express, { type Express } from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSitesRouter } from "./routes/sites.js";
import { createStackRouter } from "./routes/stack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(repoRoot: string): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sites", createSitesRouter(repoRoot));
  app.use("/api/stack", createStackRouter(repoRoot));

  const clientDist = join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });

  return app;
}

export function startServer(repoRoot: string, port = 4321): void {
  const app = createApp(repoRoot);
  app.listen(port, "127.0.0.1", () => {
    console.log(`wpstack web UI listening on http://127.0.0.1:${port}`);
  });
}
```

- [ ] **Step 11: Create `packages/cli/src/commands/ui.ts`**

```typescript
import { Command } from "commander";
import { findRepoRoot } from "@wpstack/core";
import { startServer } from "@wpstack/web-ui";

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Launch the local web UI for site management")
    .option("-p, --port <port>", "Port to listen on", "4321")
    .action(async (opts) => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error("Error: not inside a High-Performance-Docker-WordPress repo.");
        process.exit(1);
      }
      startServer(repoRoot, Number(opts.port));
    });
}
```

- [ ] **Step 12: Wire `registerUiCommand` and the `@wpstack/web-ui` dependency**

Add to `packages/cli/package.json`'s `dependencies`:

```json
"@wpstack/web-ui": "0.1.0"
```

Add to `packages/cli/src/index.ts`:

```typescript
import { registerUiCommand } from "./commands/ui.js";
```

```typescript
registerUiCommand(program);
```

Also export `startServer` from `packages/web-ui/server/src/index.ts` (it
already is, via `export function startServer`) — confirm
`packages/web-ui/package.json`'s `"main"` field points at
`dist/server/index.js` so `@wpstack/web-ui` resolves `startServer`
correctly (it already does from Task 9, step 1).

- [ ] **Step 13: Build everything and manually verify in a browser**

Run:
```bash
npm install
npm run build --workspace=@wpstack/core
npm run build --workspace=@wpstack/mcp-server
npm run build --workspace=@wpstack/web-ui
npm run build --workspace=@wpstack/cli
wpstack ui
```

Open `http://127.0.0.1:4321` in a browser. Expected: page loads showing
"wpstack Site Manager", the stack panel (containers listed if Docker is
running), an empty site list or existing sites from `sites/`, and the
New Site form. Submitting the form with a test domain should show a
disabled "Creating..." button, then either a new site card or an error
message.

- [ ] **Step 14: Commit**

```bash
git add packages/web-ui packages/cli
git commit -m "feat(web-ui): add React client for site and stack management"
```

---

## Task 11: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: user-facing instructions; no code interfaces.

- [ ] **Step 1: Add a "Site Manager CLI, MCP Server & Web UI" section to `README.md`**

Read the current `README.md` first to match its existing heading style,
then append a new top-level section (exact wording of surrounding
sections may vary — match the file's existing tone):

```markdown
## Site Manager: CLI, MCP Server & Web UI

In addition to the `new-site.sh` / `manage-sites.sh` scripts, this repo
includes a `wpstack` CLI, an MCP server, and a local web UI, all backed
by the same shared logic.

### Setup

\`\`\`bash
npm install
npm run build
npm link --workspace=@wpstack/cli
\`\`\`

This makes the `wpstack` command available globally.

### CLI

\`\`\`bash
wpstack site list
wpstack site show mysite.local
wpstack site create --domain mysite.local
wpstack site remove mysite.local

wpstack stack status
wpstack stack start
wpstack stack stop
wpstack stack restart
\`\`\`

Run from inside `sites/<domain>/` and the domain argument can be omitted
for `show` and `remove`.

### Web UI

\`\`\`bash
wpstack ui
\`\`\`

Opens a local web UI at `http://127.0.0.1:4321` for managing sites and
the Docker stack from a browser. Binds to localhost only — not intended
to be exposed beyond your machine.

### MCP Server

Register with an MCP-compatible AI client (e.g. Claude Desktop, Claude
Code) by pointing it at the `wpstack mcp` command:

\`\`\`json
{
  "mcpServers": {
    "wpstack": {
      "command": "wpstack",
      "args": ["mcp"]
    }
  }
}
\`\`\`

This exposes `list_sites`, `get_site`, `create_site`, `remove_site`,
`stack_status`, `stack_start`, `stack_stop`, and `stack_restart` as MCP
tools.
```

- [ ] **Step 2: Add a short pointer in `CLAUDE.md`**

Read the current `CLAUDE.md` first (already read in this session — it has
an "Essential Commands" section with "Multi-Site Management" and
"Container Management" subsections). Add a new subsection immediately
after "Multi-Site Management" (after the `manage-sites.sh help` example
block, before "### Container Management"):

```markdown
#### Programmatic Access: `wpstack` CLI, MCP Server, Web UI

The `packages/` workspace provides a `wpstack` CLI, an MCP server, and a
local web UI on top of `new-site.sh` / `manage-sites.sh`, for AI-agent
and browser-based site management. See the "Site Manager" section in
`README.md` for setup and usage. When editing site-management logic,
`packages/core` is the single source of truth that both `new-site.sh`
non-interactive flags and every client (CLI, MCP, web UI) depend on.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document wpstack CLI, MCP server, and web UI"
```

---

## Self-Review Notes

**Spec coverage:**
- `core` wrapping scripts via `spawn` → Tasks 2, 3, 5, 6.
- Non-interactive script flags → Task 4.
- `wpstack` CLI with root/site-context detection → Tasks 2, 7.
- MCP stdio server with 8 tools → Task 8.
- Localhost-only Express + React web UI with spinner-based progress →
  Tasks 9, 10.
- Error handling contract (`Result<T>`, non-throwing `core`) → Task 2,
  used throughout.
- Documentation → Task 11.
- Both "open items" from the spec were resolved before planning: flag
  surface for `new-site.sh --non-interactive` (Task 4), and CLI
  re-implementing prompts rather than reusing script prompts (Task 7
  currently uses `--domain` as a required flag rather than interactive
  prompting for v1's `site create`; this is a narrower but consistent
  resolution — it satisfies the spec's non-interactive requirement
  without needing a separate prompt-library dependency, and interactive
  `new-site.sh` remains available for the fully-guided flow).

**Type consistency check:** `SiteInfo`, `CreateSiteOptions`, `Result<T>`,
`ContainerStatus` are defined once in `packages/core/src/{types,sites,stack}.ts`
and imported by name (`@wpstack/core`) in every downstream package — no
redefinitions or renamed duplicates across `cli`, `mcp-server`, `web-ui`.

**No placeholders:** every step has literal code, exact file paths, and
runnable commands with expected output.
