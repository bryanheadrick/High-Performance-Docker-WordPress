# Stack Detection and Signals

Use this reference when you need to classify an unfamiliar WordPress repo quickly.

## Plugin-Centric Signals

Look for:

- main plugin headers: `Plugin Name:`
- bootstrap files at repo root or `wp-content/plugins/<slug>/<slug>.php`
- activation/deactivation/uninstall hooks
- `includes/`, `admin/`, `public/`, `src/` plugin structure
- custom post types, taxonomies, settings pages, REST routes

What it usually implies:

- architecture and lifecycle review matter early
- route follow-up to `wp-plugin-development`
- if it also contains WooCommerce logic, add `wp-woocommerce-dev`

## Theme-Centric Signals

Look for:

- `style.css` header
- `functions.php`
- `theme.json`
- `templates/`, `parts/`, `patterns/`, `styles/`
- `template-parts/` and classic template files

What it usually implies:

- determine block theme vs classic vs hybrid first
- route follow-up to `wp-theme-development`
- if many custom blocks are present, also add `wp-block-development`

## Block / Gutenberg Signals

Look for:

- `block.json`
- block registration code
- React/JSX build chain
- `@wordpress/scripts`, `@wordpress/*` packages
- dynamic block render callbacks

What it usually implies:

- editor/runtime split matters
- build artifacts may drift from source
- route follow-up to `wp-block-development`

## WooCommerce Signals

Look for:

- `woocommerce/` template overrides
- `WC_` classes or namespace imports
- gateway classes, order hooks, checkout hooks
- HPOS declarations
- Action Scheduler jobs

What it usually implies:

- upgrade and compatibility risk can be high
- payment, order, and webhook logic deserve extra caution
- route follow-up to `wp-woocommerce-dev`

## Headless / WPGraphQL Signals

Look for:

- frontend apps adjacent to WordPress
- GraphQL schema/resolver references
- Next.js, revalidation, preview, webhook, and build hooks
- auth bridges between frontend and WordPress

What it usually implies:

- cache invalidation, previews, and auth flows are common risk areas
- route follow-up to `wp-headless-and-wpgraphql`

## REST / Integration Signals

Look for:

- `register_rest_route()`
- custom controllers, permission callbacks, schema arrays
- external HTTP integrations, webhook receivers, OAuth or token logic

What it usually implies:

- route follow-up to `wp-rest-api-development`
- if auth is custom or risky, also add `wp-security-review`

## ACF / Content-Model Signals

Look for:

- `acf-json/`
- `acf_add_local_field_group()`
- CPT/taxonomy registration
- heavy use of `get_field()`, `have_rows()`, or repeaters/flexible content
- `meta_query` and custom filtering logic

What it usually implies:

- content model and query shape matter as much as template code
- route follow-up to `wp-acf-and-content-modeling`

## Platform / Enterprise Signals

Look for:

- `composer.json`
- Bedrock layout (`web/`, `config/application.php`)
- multisite constants or blog switching
- environment-driven config
- deploy scripts or platform docs

What it usually implies:

- deployment assumptions may live outside WordPress code proper
- operational review and environment clarity matter early
- route follow-up to `wp-wpcli-and-ops` and `wp-ci-cd-and-release-engineering`

## Builder / Migration Signals

Look for:

- Elementor, Divi, WPBakery, Beaver Builder, Bricks, Breakdance references
- shortcode-heavy content or theme logic
- migration docs, export/import helpers, compatibility shims

What it usually implies:

- modernization and content lock-in risk may dominate the project
- note the builder surface clearly even if code review is otherwise light
