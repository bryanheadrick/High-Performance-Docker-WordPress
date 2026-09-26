# Blueprint Patterns

Use this reference when reviewing Blueprint JSON files or docs built around them.

## Official Anchors

- The official Blueprints getting started guide shows a minimal Blueprint with `$schema`, `landingPage`, `preferredVersions`, and `steps`.
- The docs say Blueprints can be used three ways: pasted into the Playground URL fragment, used with the JavaScript API, or referenced through `blueprint-url`.
- The steps reference documents setup operations like `enableMultisite`, `login`, `setSiteOptions`, `writeFile`, and `wp-cli`.

## Review Goals

- Keep the environment reproducible from the Blueprint alone.
- Use the smallest set of steps that expresses the setup clearly.
- Make version-sensitive demos explicit about PHP and WordPress versions.

## Good Blueprint Shape

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/wp-admin/",
  "preferredVersions": {
    "php": "8.3",
    "wp": "latest"
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}
```

## More Concrete Example: Minimal Plugin Repro

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/wp-admin/plugins.php",
  "preferredVersions": {
    "php": "8.3",
    "wp": "latest"
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "setSiteOptions",
      "options": {
        "blogname": "Playground Repro"
      }
    }
  ]
}
```

For a pure issue repro, this is often enough. Add more steps only when they express a real requirement.

## Step Selection Heuristics

Use setup steps that map directly to the problem:

- `login` for authenticated admin demos
- `enableMultisite` for network-specific repros
- `setSiteOptions` for simple config
- `wp-cli` for scripted content creation or admin state changes
- `writeFile` / `cp` / `mv` only when the file-level change is part of the repro

### Example with a `wp-cli` step

The steps docs include a `wp-cli` step. That is useful when the repro needs seeded content but should still stay self-contained.

```json
{
  "steps": [
    {
      "step": "wp-cli",
      "command": "wp post create --post_title='Repro post' --post_status=publish"
    }
  ]
}
```

## Warning Signs

- hidden steps performed manually after load
- no explicit versions when testing compatibility issues
- Blueprint does too much for a narrowly scoped bug repro
- adjacent files or mounts required but not documented

## Included Fixture

- `sample-playground-blueprint.json` is a minimal Blueprint you can adapt for docs, demos, or bug repros.
