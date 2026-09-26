# Baseline and CI

Use this reference for gradual adoption strategy and CI reviews.

## Official Anchors

- PHPStan documents `--generate-baseline` as a way to export current errors and focus future runs on new issues.
- The baseline guide shows the standard `phpstan-baseline.neon` include pattern and notes that PHP baselines are also supported.

## Review Goals

- treat baseline as transition aid, not permanent hiding place
- keep CI and local commands aligned
- make it easy to see whether new code introduces new violations

## Safer Baseline Strategy

1. get config and paths right first
2. choose a useful analysis level
3. generate baseline only after the analyser is genuinely seeing project code
4. include the baseline explicitly
5. fix issues incrementally instead of regenerating reflexively

Example include pattern:

```neon
includes:
    - phpstan-baseline.neon
```

## CI Heuristics

- use one obvious command, usually `vendor/bin/phpstan analyse -c phpstan.neon.dist`
- keep the config path explicit if multiple files exist
- avoid undocumented environment-specific differences between local and CI runs

### Simple CI Example

```yaml
- name: Run PHPStan
  run: vendor/bin/phpstan analyse -c phpstan.neon.dist
```

If the repo documents one command locally and CI runs another, treat that mismatch as a review target.

## Findings to Flag

### WARNING

- baseline regenerated after every new failure
- CI runs lower strictness than local docs suggest
- ignored errors lack ownership or review discipline

### INFO

- could split fast PR analysis from deeper nightly analysis
- could report JSON or another machine-readable format when needed

## Baseline Review Question

Ask: "Is the baseline shrinking over time, or is it acting like a silent attic for every new warning?" That question usually gets to the real health of the rollout.
