# Onboarding Audit Checklist

Use this as a practical first pass.

## 1. Establish the Target

- What path am I auditing?
- Is this the full repository or just one plugin/theme/app?
- What is clearly custom code vs vendor or generated code?

## 2. Classify the Stack

- Plugin-centric?
- Theme-centric?
- Block-heavy?
- WooCommerce?
- Headless/WPGraphQL?
- REST-heavy?
- ACF/content-model-heavy?
- Multisite?
- Bedrock/composer-managed?
- Builder-heavy/migration-prone?

## 3. Inventory the Important Surfaces

Capture only what matters:

- bootstrap files
- custom plugins/themes
- API surfaces
- schema/migration code
- payment/commerce flows
- build tooling
- tests and static analysis
- deploy/release scripts
- local setup docs and runbooks

## 4. Note Immediate Risk Signals

Prioritize:

- auth or payment logic
- custom SQL or tables
- upgrade/migration routines
- undocumented build/deploy assumptions
- multisite/network complexity
- no tests / no static analysis / no docs
- builder lock-in or shortcode dependency

## 5. Recommend Follow-Up Skills

Good onboarding output should name the next review sequence, not just say "needs more review."

Examples:

- `wp-plugin-development`
- `wp-theme-development`
- `wp-block-development`
- `wp-woocommerce-dev`
- `wp-rest-api-development`
- `wp-headless-and-wpgraphql`
- `wp-acf-and-content-modeling`
- `wp-security-review`
- `wp-performance-review`
- `wp-ci-cd-and-release-engineering`

## 6. Call Out Unknowns Explicitly

Examples:

- unknown production activation state
- unknown whether built assets are regenerated in CI
- unknown whether multisite is actually enabled in production
- unknown whether a payment or webhook flow is covered by tests

Avoid pretending these uncertainties are settled facts.
