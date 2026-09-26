# Routing and Follow-Ups

This skill should hand off confidently to the rest of the pack.

## Common Routing Patterns

### Mostly Custom Plugin

Use next:

1. `wp-plugin-development`
2. `wp-security-review`
3. `wp-performance-review`

### Block Theme with Custom Blocks

Use next:

1. `wp-theme-development`
2. `wp-block-development`
3. `wp-accessibility-review`

### WooCommerce Store Customization

Use next:

1. `wp-woocommerce-dev`
2. `wp-security-review`
3. `wp-performance-review`
4. `wp-ci-cd-and-release-engineering`

### Headless Frontend + WordPress Backend

Use next:

1. `wp-headless-and-wpgraphql`
2. `wp-rest-api-development` or `wp-security-review` depending on auth surface
3. `wp-ci-cd-and-release-engineering`

### ACF-Heavy Editorial Platform

Use next:

1. `wp-acf-and-content-modeling`
2. `wp-theme-development`
3. `wp-performance-review` when meta queries look heavy

### Ops / Multisite / Runbook-Heavy Repo

Use next:

1. `wp-wpcli-and-ops`
2. `wp-migration-upgrade-review`
3. `wp-ci-cd-and-release-engineering`

## When to Escalate Severity

Escalate to CRITICAL when onboarding reveals likely production danger, for example:

- payment or auth flows with no clear safety boundaries
- schema/migration code that may be destructive or unclear
- release automation that appears able to deploy unverified artifacts
- custom API surfaces with weak authorization cues

## When to Stay Informational

Keep findings at INFO when they are mostly structural observations:

- repo could use better docs
- project shape is unusual but understandable
- there are multiple surfaces, but boundaries are still readable
- modernization opportunities exist without immediate danger
