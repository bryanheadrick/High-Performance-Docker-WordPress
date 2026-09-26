---
name: wp-site-audit-and-onboarding
description: WordPress site and codebase onboarding review. Use when inheriting a WordPress repo, auditing an unfamiliar site or project, scoping technical risk before deeper review, identifying whether a codebase is plugin/theme/headless/WooCommerce/multisite/Bedrock/builder-heavy, or when user asks for "site audit", "onboarding review", "what am I looking at", "inherit this WordPress project", "stack discovery", or "where should I start". Produces a prioritized review path and routes follow-up work to the right WordPress skill.
---

# WordPress Site Audit and Onboarding Skill

## Overview

Systematic onboarding guidance for inherited or unfamiliar WordPress repositories and site codebases. **Core principle:** before doing deep review, first classify the stack, map the moving parts, and identify the highest-risk follow-up path. This skill is meant to be the front door into the wider WordPress skill pack: plugin, theme, ACF, headless, WooCommerce, REST, migration, performance, security, CI/CD, WP-CLI, Playground, and PHPStan.

The goal is not to exhaustively review every file in one pass. The goal is to:

1. identify what kind of WordPress system this is
2. locate the architectural hotspots
3. surface obvious risk signals
4. recommend the next review skills in priority order

## When to Use

**Use when:**
- Inheriting a new WordPress repository
- Reviewing a client site codebase for the first time
- Figuring out whether a project is plugin-driven, theme-driven, headless, WooCommerce-heavy, multisite, or builder-heavy
- Scoping risk before a migration, audit, modernization pass, or release
- Producing a quick architectural map before deeper specialist review
- User asks questions like:
  - "Audit this WordPress repo"
  - "Help me onboard to this site"
  - "What stack is this WordPress project using?"
  - "Where should I start reviewing this codebase?"
  - "What are the highest-risk areas here?"

**Don't use for:**
- Full security-only review (use `wp-security-review`)
- Full performance-only review (use `wp-performance-review`)
- Deep plugin architecture review after the plugin scope is already known (use `wp-plugin-development`)
- Deep theme review after the theme scope is already known (use `wp-theme-development`)
- Focused WooCommerce, ACF, REST, or headless analysis when the domain is already obvious

## Audit Workflow

Follow this seven-step workflow.

### 1) Identify the onboarding target

Determine what you are auditing:

- entire repository
- single plugin
- single theme
- `wp-content/` subtree
- monorepo app that includes WordPress as one surface
- documentation-only or CI-only configuration layer

If the target is not the full repo, note what is intentionally out of scope.

### 2) Detect project shape first

Classify the codebase before judging it.

Possible stack signals:

- **Plugin-centric**
  - main plugin headers
  - `mu-plugins/`
  - custom post types, taxonomies, admin pages
- **Theme-centric**
  - `style.css`, `theme.json`, `templates/`, `parts/`, `functions.php`
- **Block/Gutenberg-heavy**
  - `block.json`, `src/`, `build/`, JSX, block registrations
- **WooCommerce-heavy**
  - `woocommerce/` templates, HPOS declarations, gateway classes, cart/checkout hooks
- **Headless / WPGraphQL**
  - frontend app folders, GraphQL routes, webhooks, revalidation flows, preview auth
- **REST/API-heavy**
  - `register_rest_route()`, schema callbacks, external integrations
- **ACF/content-model-heavy**
  - `acf-json/`, CPT/taxonomy registrations, field-group exports, heavy meta usage
- **Multisite**
  - multisite constants, network-admin logic, site/blog switching, network-wide CLI or migration code
- **Bedrock / composer-managed**
  - `composer.json`, `web/`, `config/application.php`, roots/bedrock layout
- **Builder-heavy / migration-prone**
  - Elementor, Divi, WPBakery, Beaver Builder, shortcode lock-in

### 3) Inventory key surfaces

Build a practical map of the codebase:

- bootstrap files
- active plugins/themes in-repo
- custom code directories
- build tooling (`package.json`, `composer.json`, GitHub Actions)
- deployment scripts and ops docs
- tests (`phpunit`, `playwright`, integration/E2E folders)
- docs that explain environment assumptions

Do not dump raw file listings. Summarize the structure into meaningful components.

### 4) Look for risk signals

Surface onboarding risks early.

Typical high-value signals:

- multiple custom plugins or sprawling theme logic without clear boundaries
- direct SQL, custom tables, or upgrade routines
- custom REST/GraphQL/auth code
- WooCommerce checkout, order, payment, or webhook integrations
- block/theme build systems that may drift from committed assets
- large ACF/meta-query dependence
- multisite assumptions
- release/deploy automation with unclear gating
- signs of builder lock-in or migration debt
- no tests, no static analysis, or no local/dev docs

### 5) Route to specialist skills

Recommend the next review path instead of overextending this skill.

Example follow-up routing:

- custom plugin architecture → `wp-plugin-development`
- custom theme / block theme → `wp-theme-development`
- Gutenberg blocks → `wp-block-development`
- WooCommerce flows → `wp-woocommerce-dev`
- REST routes → `wp-rest-api-development`
- ACF/CPT/taxonomy modeling → `wp-acf-and-content-modeling`
- headless / WPGraphQL → `wp-headless-and-wpgraphql`
- operational scripts / WP-CLI / multisite commands → `wp-wpcli-and-ops`
- migrations / schema changes → `wp-migration-upgrade-review`
- deployment pipelines → `wp-ci-cd-and-release-engineering`
- static analysis posture → `wp-phpstan-review`
- reproducible demos or bug repros → `wp-playground-development`
- cross-cutting security risk → `wp-security-review`
- cross-cutting performance risk → `wp-performance-review`

### 6) Prioritize the next actions

Output should separate:

- **Immediate review priorities** — where the next audit should start
- **Secondary follow-ups** — important, but not first
- **Context notes** — useful architecture observations that are not urgent problems

### 7) Keep severity context-aware

Use severity carefully in onboarding.

- **CRITICAL:** likely production risk, security/commerce/auth/migration hazard, or repo ambiguity that blocks safe work
- **WARNING:** important risk or missing clarity that should be reviewed soon
- **INFO:** structure notes, modernization opportunities, or low-risk follow-ups

This skill should not manufacture CRITICAL issues from normal architectural complexity alone.

## File and Surface Checks

### Repository Root / Architecture Layer

- CRITICAL: no obvious source-of-truth path for custom code in a complex repo
- WARNING: multiple duplicated plugin/theme copies with unclear active target
- WARNING: build artifacts committed without clear source folders or scripts
- INFO: could improve repo docs, local setup, or code ownership notes

### Plugin Surfaces

- WARNING: custom plugins mixed with vendor code without clear boundaries
- WARNING: several custom plugins overlapping the same domain (routing, checkout, content model)
- INFO: route to `wp-plugin-development` for deeper architecture review

### Theme Surfaces

- WARNING: theme contains plugin-like business logic, APIs, or migration code
- WARNING: classic/block theme boundary unclear
- INFO: route to `wp-theme-development` or `wp-block-development`

### Commerce / Integration Surfaces

- CRITICAL: payment, webhook, or order logic present but untested or poorly isolated
- WARNING: WooCommerce customization depth suggests upgrade fragility
- INFO: route to `wp-woocommerce-dev`

### Headless / API Surfaces

- CRITICAL: custom auth, preview, or cache invalidation paths without obvious documentation
- WARNING: mixed REST and GraphQL surfaces with unclear ownership
- INFO: route to `wp-headless-and-wpgraphql` or `wp-rest-api-development`

### Operations / Delivery Surfaces

- WARNING: deploy/release scripts exist with no rollback or environment notes
- WARNING: WP-CLI automation touches multisite or production-like data without obvious safeguards
- INFO: route to `wp-ci-cd-and-release-engineering` or `wp-wpcli-and-ops`

## Search Patterns for Quick Detection (ONBOARD-21)

Use these `rg` commands to classify the project quickly.

### Stack Discovery

```bash
rg -n "Plugin Name:|register_activation_hook|register_deactivation_hook|register_uninstall_hook" . -g '*.php'
rg -n "theme\.json|Template Name:|add_theme_support\(|register_nav_menus\(|after_setup_theme" . -g '*.{php,json,css}'
rg -n "block\.json|registerBlockType|@wordpress/|wp\.blocks|useBlockProps|InnerBlocks" . -g '*.{json,js,jsx,ts,tsx,php}'
```

### Platform and Package Layout

```bash
rg -n "roots/bedrock|config/application\.php|composer install|wp core download" . -g '*.{json,php,md,yml,yaml,sh}'
rg -n "multisite|is_multisite\(|switch_to_blog\(|restore_current_blog\(|WP_ALLOW_MULTISITE|SUNRISE" . -g '*.{php,md,yml,yaml}'
rg -n "woocommerce|WC_|Automattic\\WooCommerce|FeaturesUtil::declare_compatibility|action_scheduler" . -g '*.{php,js,md,yml,yaml}'
```

### Content, API, and Headless Signals

```bash
rg -n "acf-json|acf_add_local_field_group|register_post_type\(|register_taxonomy\(|meta_query|get_field\(|the_field\(" . -g '*.{php,json}'
rg -n "register_rest_route\(|WP_REST_Controller|permission_callback|rest_api_init" . -g '*.php'
rg -n "graphql|wpgraphql|revalidate|preview|previewData|headless|Next\.js|next build|ISR|webhook" . -g '*.{php,js,jsx,ts,tsx,md,yml,yaml}'
```

### Migration and Builder Signals

```bash
rg -n "elementor|divi|vc_|wpbakery|beaver builder|shortcode|\[[a-z0-9_-]+\]" . -g '*.{php,js,json,md,xml}'
rg -n "dbDelta\(|CREATE TABLE|ALTER TABLE|update_option\(\s*'[^']*version|schema" . -g '*.php'
```

### Delivery and Quality Signals

```bash
rg -n "phpunit|WP_UnitTestCase|playwright|cypress|codecept|phpstan|psalm|eslint|wpcs|phpcs" . -g '*.{php,xml,json,js,ts,md,yml,yaml}'
rg -n "workflow|deploy|release|rollback|artifact|svn|wordpress\.org|rsync|capistrano" . -g '*.{md,yml,yaml,sh,json}'
```

## Reference Files

- `references/stack-detection-and-signals.md` - How to classify a WordPress codebase quickly and what each stack signal implies
- `references/audit-checklist.md` - A practical first-pass onboarding checklist for repos and codebases
- `references/routing-and-followups.md` - How to hand the repo off to the right specialist WordPress skill after onboarding
- `references/sample-onboarding-output.md` - Example report shape for a useful onboarding summary

## Output Format (ONBOARD-23)

Use this output structure.

### 1. Project Shape

- repository or target path
- primary classification
- secondary classifications
- key stack signals detected

### 2. Architecture Snapshot

- major code surfaces
- custom components
- build/test/deploy surfaces
- unusual platform characteristics

### 3. Priority Findings

Group by severity:

- `CRITICAL`
- `WARNING`
- `INFO`

Each finding should include:

1. file or surface
2. short issue/risk summary
3. why it matters for onboarding or safe follow-up work
4. recommended next review skill or action

### 4. Recommended Review Sequence

List the next 2–5 reviews in order, for example:

1. `wp-plugin-development` for the custom commerce plugin
2. `wp-woocommerce-dev` for checkout and HPOS compatibility
3. `wp-ci-cd-and-release-engineering` for release and deployment flow

### 5. Residual Unknowns

Call out what could not be determined from the available files, such as:

- production plugin activation state
- whether committed build artifacts match source
- whether multisite/network mode is actually active
- whether undocumented external services exist

## Final Reminder

This is an **onboarding and routing skill**. Be useful, concrete, and directional. Do not turn it into a full deep-dive review of every detected subsystem in one pass.
