# CLI and Local Workflows

Use this reference for local development or automation built on `@wp-playground/cli`.

## Official Anchors

- The official Playground CLI docs list `start`, `server`, `run-blueprint`, and `build-snapshot`.
- The CLI docs describe options like `--blueprint`, `--auto-mount`, `--mount`, and `--login`.

## Review Rules

### Pick the right command

- Use `start` or `server` for local interactive development.
- Use `run-blueprint` when you need deterministic execution without a web server.
- Use `build-snapshot` when the goal is a reusable prepared site state.

The current Playground CLI docs expose both `start` and `server`. Inference: `start` is the friendlier local default, while `server` is better when the workflow needs tighter control or explicit options.

### Document mounts clearly

Mounts are powerful but easy to make brittle. If a flow depends on:

- `--auto-mount`
- `--mount`
- `--mount-before-install`

then the docs should say what is being mounted and why.

### Keep local and shared flows distinct

A local convenience command is not always the best shared repro pattern. Shared docs should prefer the simplest command that works on another machine with minimal context.

## Good Examples

### Local interactive repro

```bash
npx @wp-playground/cli@latest server --blueprint=./playground.json --login
```

### Friendly local start flow

```bash
npx @wp-playground/cli@latest start --blueprint=./playground.json
```

### Deterministic CI-ish execution

```bash
npx @wp-playground/cli@latest run-blueprint ./playground.json
```

### Snapshot build

```bash
npx @wp-playground/cli@latest build-snapshot --blueprint=./playground.json --outfile=site.zip
```

## Findings to Flag

- CLI examples with undocumented local assumptions
- mount-heavy setups for simple public demos
- no distinction between reproducible script and local convenience flow
- no note about Node version or local prerequisites when the docs expect CLI usage
