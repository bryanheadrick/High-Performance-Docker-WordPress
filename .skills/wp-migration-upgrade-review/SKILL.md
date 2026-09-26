---
name: wp-migration-upgrade-review
description: WordPress migration and upgrade review. Use when reviewing database migrations, option versioning, upgrade routines, data backfills, dbDelta usage, release compatibility, rollback risk, or when user mentions "migration review", "upgrade routine", "dbDelta", "plugin upgrade", "data migration", "version bump", "backfill", "schema change", or "backwards compatibility". Detects unsafe migrations, missing version guards, destructive data changes, and upgrade-flow risks in WordPress code.
---

# WordPress Migration and Upgrade Review Skill

## Overview

Systematic review for WordPress plugin and theme upgrade routines. **Core principle:** Upgrades should be repeatable, version-aware, incremental, and safe on real production data. Review covers schema changes, option migrations, version flags, activation upgrades, background backfills, idempotency, rollback risk, and backwards compatibility.

## When to Use

**Use when:**
- Reviewing schema or option migrations
- Auditing `dbDelta()` usage
- Checking versioned upgrade routines
- Reviewing background backfills or one-time repair jobs
- Preparing a risky release for existing installs

**Don't use for:**
- Pure performance review without migration logic
- General plugin architecture review without upgrade context
- One-off content imports unrelated to product upgrades

## Code Review Workflow

1. **Identify migration surface**
   - Activation hook setup
   - Version comparison upgrade routine
   - Background backfill
   - Manual repair tool

2. **Check safety first**
   - Version guard present
   - Routine is idempotent
   - Destructive operations are explicit and justified
   - Large data work is chunked

3. **Review schema and data flow**
   - `dbDelta()` vs raw SQL
   - Option rename/copy/delete order
   - Backfill durability and progress tracking
   - Upgrade completion flags

4. **Apply severity**
   - **CRITICAL:** No version guards, destructive writes without checks, long-running upgrade on page load
   - **WARNING:** Missing batching, missing rollback consideration, untracked partial state
   - **INFO:** Could use clearer migration registry or logging

## File-Type Specific Checks

### Versioned Upgrade Routines

- CRITICAL: Upgrade logic runs on every request without version compare
- WARNING: Multiple migration steps but no ordered upgrade map
- INFO: Could centralize migration registry

### Schema Changes

- CRITICAL: Raw `CREATE TABLE` or `ALTER TABLE` without care for existing installs
- WARNING: `dbDelta()` used without table-version tracking
- INFO: Could separate schema and data migration phases

### Data Backfills

- CRITICAL: Full-table backfill on normal page load
- WARNING: No batching or progress option
- WARNING: No retry or resumable design
- INFO: Could use Action Scheduler or WP-CLI support

## Search Patterns for Quick Detection (MIG-21)

Use these `rg` commands for quick migration scanning.

### CRITICAL Patterns

```bash
# Version comparisons and upgrade flags
rg -n "version_compare|get_option\s*\(.*version|update_option\s*\(.*version" . -g '*.php'

# Schema changes
rg -n "dbDelta|CREATE TABLE|ALTER TABLE|DROP TABLE" . -g '*.php'

# Activation and upgrade hooks
rg -n "register_activation_hook|upgrader_process_complete|admin_init|init" . -g '*.php'
```

### WARNING Patterns

```bash
# Batch candidates and large loops
rg -n "foreach|while" . -g '*.php'

# Background processing and schedulers
rg -n "wp_schedule_event|as_schedule_single_action|WP_CLI" . -g '*.php'

# Delete or rename operations
rg -n "delete_option|rename|migrate|backfill" . -g '*.php'
```

### INFO Patterns

```bash
# Upgrade classes or managers
rg -n "Migration|Upgrade|Installer|Schema" . -g '*.php'
```

## Reference Files

- `references/versioned-upgrades.md` - Version flags, ordered migrations, and idempotent upgrade routines
- `references/schema-and-backfill-guide.md` - `dbDelta()`, table changes, backfills, batching, and release safety

## Output Format (MIG-23)

For each finding include severity, file reference, migration risk, and a safe remediation path. Note explicitly if the issue risks production timeouts, partial data state, or irreversible data loss.

