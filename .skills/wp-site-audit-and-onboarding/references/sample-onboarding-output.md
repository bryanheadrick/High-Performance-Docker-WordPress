# Sample Onboarding Output

## Project Shape

- **Target:** `wp-content/plugins/acme-commerce-suite`
- **Primary classification:** Custom WooCommerce plugin
- **Secondary classifications:** REST-heavy, CI-managed release flow
- **Key signals:** `Plugin Name` header, HPOS declaration, custom REST routes, GitHub Actions release workflow

## Architecture Snapshot

- Main bootstrap file loads multiple domain classes from `includes/`
- Separate admin, frontend, and API layers exist
- Release pipeline packages a distributable zip in GitHub Actions
- PHPUnit config exists, but no obvious E2E or webhook test coverage was found

## Priority Findings

### CRITICAL

- `includes/api/class-webhook-controller.php` — custom webhook intake surface detected, but the onboarding pass could not confirm signature validation from the surrounding code. This should be reviewed next with `wp-woocommerce-dev` and `wp-security-review` because payment-related webhooks are high-risk.

### WARNING

- `.github/workflows/release.yml` — release automation exists, but rollback/documented artifact verification is not obvious from the workflow name and surrounding docs. Follow up with `wp-ci-cd-and-release-engineering`.

- `includes/upgrades/` — versioned upgrade routines are present, which increases release risk and upgrade complexity. Follow up with `wp-migration-upgrade-review`.

### INFO

- `tests/` — unit test surface exists, which is a good sign, but the current onboarding pass did not find clear end-to-end checkout coverage.

## Recommended Review Sequence

1. `wp-woocommerce-dev`
2. `wp-security-review`
3. `wp-migration-upgrade-review`
4. `wp-ci-cd-and-release-engineering`

## Residual Unknowns

- Whether webhook signature verification is complete
- Whether HPOS compatibility is tested in CI
- Whether built assets are always regenerated before release
