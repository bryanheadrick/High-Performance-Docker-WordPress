# MCP Site Manager + Web UI — Design Spec

Date: 2026-09-10
Status: Approved for implementation planning

## Purpose

This project currently manages multi-site WordPress environments through
interactive bash scripts (`new-site.sh`, `manage-sites.sh`,
`cleanup-broken-sites.sh`) run by hand. This adds two new ways to drive the
same site lifecycle:

1. An **MCP server** so an AI agent (Claude Desktop, Claude Code, etc.) can
   list, create, inspect, and remove sites, and control the Docker stack,
   without a human running scripts interactively.
2. A **lightweight local web UI** giving a human the same capabilities
   through a browser instead of a terminal.

Both are built on a shared core library so there is one implementation of
"what a site operation does," not two.

Reference: [Automattic/studio](https://github.com/Automattic/studio) —
borrowed ideas are the `studio`-style single CLI binary as the entry point,
and the split between a shared core and thin client surfaces (their
`apps/` + `packages/` split). Studio itself runs on Electron + WordPress
Playground; this project stays Docker + real MariaDB, so its internals
aren't reused directly — only the shape of the split.

## Non-goals

- No change to how Docker Compose, Nginx, MariaDB, or WordPress itself are
  configured. This is purely a management-surface addition.
- No remote/multi-user access. Single local developer, localhost only.
- No new SSL/cert handling — reuses `new-site.sh`'s existing mkcert flow.
- No live streaming terminal output in the web UI for v1 (spinner + final
  result is sufficient).

## Architecture

```
packages/
  core/         Shared Node/TypeScript library
  cli/          `wpstack` binary — single entry point, routes to everything
  mcp-server/   MCP stdio server (invoked as `wpstack mcp`)
  web-ui/       Express API + React (Vite) SPA (invoked as `wpstack ui`)
```

npm workspaces tie the packages together at the repo root
(`package.json` with `"workspaces": ["packages/*"]`).

### `packages/core`

The single source of truth for site operations. Exposes async functions
that wrap the existing bash scripts via `child_process.spawn` (never
`exec`, to avoid shell injection through domain names or user input):

- `listSites()`
- `getSite(domain)`
- `createSite(opts)` — domain, db name/user/password, admin user/password/email
- `removeSite(domain)`
- `startStack()`, `stopStack()`, `restartStack()`, `getStackStatus()`

Each function returns a structured result (`{ success, data, error }`)
rather than raw stdout — `core` is responsible for parsing script output
into that shape.

**Script changes required:** `new-site.sh` and `manage-sites.sh` currently
prompt interactively via `read -p` and use `sudo` for `/etc/hosts` edits.
To be drivable non-interactively:

- Add flag-based / env-var-based non-interactive input to `new-site.sh`
  (e.g. `--domain`, `--db-name`, `--admin-user`, ... or a `--non-interactive`
  mode reading the same variables from the environment), so `core` can
  supply all answers up front instead of piping to stdin.
- `remove_site`'s `yes/no` confirmation in `manage-sites.sh` gets an
  equivalent `--yes`/`--force` flag.
- The `sudo sed -i` hosts-file edit and `sudo tee -a /etc/hosts` remain
  interactive/privileged either way — `core` surfaces a clear error/message
  when a hosts-file change requires manual `sudo` action, rather than
  attempting to manage sudo prompts itself.

This is a targeted modification of existing scripts, not a rewrite — the
scripts remain runnable by hand exactly as they are today.

**Repo root / site context resolution:** `core` walks up from a given
starting directory looking for a directory containing `docker-compose.yml`
(the existing project marker). If invoked from inside `sites/{domain}/`,
the domain is inferred from the directory name relative to that root.

### `packages/cli` — the `wpstack` binary

The single global entry point, matching Studio's `studio` binary pattern.
Built with `commander`. Installed via `npm link` (documented in the repo
README) so it resolves from any directory, including from inside a site's
folder under `sites/{domain}/`.

Commands:

- `wpstack site list`
- `wpstack site show [domain]`
- `wpstack site create` (prompts interactively if flags omitted, same UX
  as today's `new-site.sh`; flags for non-interactive use)
- `wpstack site remove [domain]`
- `wpstack stack start|stop|restart|status`
- `wpstack mcp` — launches the MCP stdio server
- `wpstack ui` — launches the Express server + opens the web UI in a browser

When run inside `sites/{domain}/`, `[domain]` arguments are optional and
inferred from cwd; outside a site directory, `[domain]` must be supplied
explicitly.

`mcp-server` and `web-ui` packages have no bin entries of their own —
`cli` requires and runs them directly.

### `packages/mcp-server`

Built on `@modelcontextprotocol/sdk`, stdio transport. Registers one MCP
tool per `core` function:

`list_sites`, `get_site`, `create_site`, `remove_site`, `stack_status`,
`stack_start`, `stack_stop`, `stack_restart`.

Each tool's handler calls the matching `core` function and returns its
structured result as the tool response. Documented registration example
for Claude Desktop / Claude Code config:
`{ "command": "wpstack", "args": ["mcp"] }`.

### `packages/web-ui`

- **Backend:** Express, binds to `127.0.0.1` only, no authentication (a
  local-only developer tool, consistent with how the rest of this stack —
  Monit, MailHog — already runs unauthenticated or with a shared default
  password on localhost). REST endpoints mirror `core` 1:1.
- **Frontend:** React + Vite SPA.
  - Site list view: cards/table showing domain, DB name, SSL status, WP
    install status, URL — same fields `manage-sites.sh show` prints today.
  - "New Site" form mirroring `new-site.sh`'s prompts (domain, db
    name/user/password with generated defaults, admin user/password/email).
  - Remove action with a confirmation step (mirrors the script's
    `yes/no` prompt).
  - Stack control panel: start/stop/restart buttons + current container
    status (mirrors `docker compose ps`).
  - Create/remove/stack actions show a spinner while the underlying
    operation runs, then a success or error result. No live log streaming
    in v1.

## Data flow example: creating a site from the web UI

1. User submits the "New Site" form in the React SPA.
2. POST to Express `/api/sites`.
3. Express calls `core.createSite(opts)`.
4. `core` spawns `new-site.sh` in non-interactive mode with the supplied
   flags/env.
5. `core` parses exit code + output into `{ success, data, error }`.
6. Express returns that as JSON; SPA swaps the spinner for a result panel.

The MCP path is identical from step 3 onward, just invoked by an MCP tool
call instead of an HTTP request.

## Error handling

- `core` functions never throw for expected failures (site already exists,
  Docker not running, DB creation failure) — they return
  `{ success: false, error: { message, code } }` so both MCP tool
  responses and HTTP responses can surface a clean message instead of a
  stack trace.
- Unexpected failures (e.g. `spawn` itself failing because Docker isn't
  installed) are caught at the `core` boundary and converted to the same
  shape.
- The hosts-file step, which needs `sudo`, is treated as a soft warning:
  site creation can succeed with a note that `/etc/hosts` needs a manual
  entry, rather than failing the whole operation.

## Testing plan

- `core`: unit tests mocking `child_process.spawn` for each function's
  success/failure paths; one manual end-to-end smoke test creating and
  removing a real site against the running Docker stack.
- `mcp-server`: manual verification calling each tool through an MCP
  inspector or Claude Code, checking tool responses against `core`'s
  contract.
- `web-ui`: manual click-through in a browser — create, list, show,
  remove, and each stack control — checking against the real Docker
  environment. No automated browser tests for v1.

## Open items for implementation planning

- Exact flag/env-var surface for `new-site.sh --non-interactive` mode.
- Whether `wpstack site create` without flags reuses the exact prompt
  wording from `new-site.sh` or re-implements prompting in the CLI layer
  (leaning toward CLI re-implementing prompts via `core`, since
  `new-site.sh`'s interactive `read -p` prompts can't be reused
  programmatically once it's driven non-interactively).
