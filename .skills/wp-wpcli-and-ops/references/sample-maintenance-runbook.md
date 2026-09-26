# Sample Maintenance Runbook

Use this fixture as a review target or starting point for safer WordPress operational docs.

## Goal

Prime report caches for a plugin without guessing site scope or mutating data blindly.

## Preconditions

- Confirm the target environment.
- Confirm the target site URL if the install is multisite.
- Confirm you have a recent database backup or export.

## Steps

### 1. Inspect the target install

```bash
wp cli info
wp option get home
```

For multisite:

```bash
wp site list --field=url
wp --url=https://example.com option get home
```

### 2. Run a dry run first

```bash
wp prefix report-cache-prime --batch-size=50 --dry-run
```

### 3. Execute the real operation

```bash
wp prefix report-cache-prime --batch-size=50
```

### 4. Verify the result

```bash
wp cache get prefix_report_123 prefix_reports
```

## Review Notes

- Discovery happens before mutation.
- Dry run is explicit.
- Multisite scope is explicit.
- Verification is a separate step.
