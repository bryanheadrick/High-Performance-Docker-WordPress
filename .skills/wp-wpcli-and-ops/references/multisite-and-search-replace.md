# Multisite and Search-Replace

Use this reference for multisite reviews and any workflow that touches `wp search-replace`.

## Official Anchors

- The WP-CLI command index includes `wp site` and `wp super-admin`, which signals that multisite work is a first-class operational surface.
- The official `wp search-replace` docs say the command searches all rows in selected tables and, on multisite, defaults to the current site's tables unless `--network` is specified.
- The official examples also show `--dry-run` and `--skip-columns=guid`, both of which should show up in safer runbooks.

## Review Rules

### Be explicit about multisite scope

In multisite, operational docs should usually state one of:

- current site only
- specific site via `--url=...`
- network-wide via `--network`

If the scope is not explicit, treat that as a warning.

### Default to dry runs first

For search-replace workflows, the safer sequence is:

1. backup or export
2. dry run
3. narrow table scope if needed
4. actual write
5. verification pass

### Protect GUIDs when replacing URLs

The official command docs include examples with `--skip-columns=guid`. Unless there is a very specific reason otherwise, URL replacements should skip GUIDs.

### Respect performance and blast radius

- `--regex` is slower; treat casual regex use as a warning.
- network-wide replacements deserve explicit justification and logging.
- narrow tables when the change is known to live in only part of the schema.

## Safer Example

```bash
wp search-replace 'https://example.com' 'https://example.test' \
  wp_posts wp_postmeta wp_options \
  --skip-columns=guid \
  --dry-run
```

For multisite:

```bash
wp search-replace --url=example.com \
  'https://example.com' 'https://example.test' \
  'wp_*options' wp_blogs wp_site \
  --network \
  --skip-columns=guid \
  --dry-run
```

## Multisite Review Moves

When the target install is multisite, reviewers should look for commands that identify scope before changing anything.

```bash
# Inspect site scope first.
wp site list --field=url

# Then target a specific site explicitly.
wp --url=https://example.com option get home
```

If docs jump straight to deletion or replacement without a discovery step, that is usually worth flagging.

## Cron and Network Sanity Checks

The official WP-CLI docs also expose useful inspection commands that are safer first steps than direct mutation:

```bash
# Confirm cron spawning works before deeper cron debugging.
wp cron test

# Inspect WP-CLI environment details during ops debugging.
wp cli info
```

## Findings to Flag

- `wp search-replace` in docs with no dry run
- `--network` used casually without scoping or rollback notes
- no backup/export step before destructive DB commands
- site-specific tasks on multisite with no `--url`
