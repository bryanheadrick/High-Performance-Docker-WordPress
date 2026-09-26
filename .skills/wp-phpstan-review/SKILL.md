---
name: wp-phpstan-review
description: WordPress PHPStan review and setup guidance. Use when reviewing `phpstan.neon`, WordPress static-analysis setup, baselines, PHPStan levels, CI jobs, WordPress stubs, `szepeviktor/phpstan-wordpress`, or when user mentions "PHPStan", "static analysis", "phpstan.neon", "baseline", "WordPress stubs", or "CI type checks". Helps review WordPress-specific PHPStan configuration, baseline strategy, extension wiring, and practical rollout patterns for plugins, themes, and larger WordPress codebases.
---

# WordPress PHPStan Review Skill

## Overview

Systematic review guidance for PHPStan in WordPress projects. **Core principle:** static analysis should be strict enough to catch real bugs without becoming noise, and WordPress-specific extensions or stubs should be wired in intentionally. Review covers config files, includes, baselines, CI integration, analysis paths, bootstrap files, WordPress stubs, and gradual adoption strategy.

## When to Use

**Use when:**
- Reviewing `phpstan.neon`, `phpstan.neon.dist`, or CI config
- Planning PHPStan adoption in a WordPress plugin or theme
- Auditing baseline usage or ignored errors
- Reviewing `szepeviktor/phpstan-wordpress` setup
- Checking analysis scope, bootstrap files, or stub configuration

**Don't use for:**
- Runtime performance review
- PHPUnit or browser test strategy without static analysis focus
- General PHP refactors unrelated to analysis setup

## Code Review Workflow

1. **Identify the analysis entrypoints**
   - `phpstan.neon` / `phpstan.neon.dist`
   - Composer `require-dev`
   - CI workflows and scripts
   - bootstrap or stub files

2. **Check base configuration first**
   - Config file naming and includes
   - Level and analysed paths
   - Exclusions and bootstrap files
   - Whether WordPress-specific extensions/stubs are actually loaded

3. **Review baseline and ignore strategy**
   - Baseline used to phase in analysis, not bury new issues forever
   - Ignored errors are intentional and reviewable
   - New code is still held to a higher bar

4. **Review CI ergonomics**
   - Deterministic command
   - Correct config path
   - Reasonable failure behavior
   - No accidental drift between local and CI config

5. **Classify findings**
   - **CRITICAL:** PHPStan appears configured but is not really analysing project code, WordPress extension missing, baseline hiding everything indefinitely
   - **WARNING:** overly broad exclusions, stale baseline workflow, config split is confusing, analysis paths too narrow
   - **INFO:** could raise level, document bootstrap behavior, or tighten ignores

## File-Type Specific Checks

### PHPStan Config

- CRITICAL: Config analyses no meaningful project paths
- WARNING: `ignoreErrors` or excludes are too broad
- WARNING: WordPress extension installed but not included when extension installer is not present
- INFO: Could split local overrides into `phpstan.neon` on top of a committed `.dist` file

### Baseline Files

- WARNING: Baseline regenerated casually instead of fixed deliberately
- WARNING: Baseline used when analysis still appears underconfigured
- INFO: Could document when to refresh versus when to fix findings

### CI and Composer

- WARNING: CI command differs materially from the documented local command
- WARNING: `require-dev` includes stubs/extension but config does not use them correctly
- INFO: Could add clearer scripts or output formatting

## Search Patterns for Quick Detection (PST-21)

Use these `rg` commands to find PHPStan setup quickly.

### Config and CI Discovery

```bash
rg -n "phpstan|phpstan\\.neon|phpstan\\.neon\\.dist|phpstan-baseline" . -g '*.{neon,php,json,md,yml,yaml}'
rg -n "vendor/bin/phpstan|composer .*phpstan|phpstan analyse" . -g '*.{json,md,yml,yaml,sh}'
```

### WordPress-Specific Setup

```bash
rg -n "szepeviktor/phpstan-wordpress|php-stubs/wordpress-stubs|extension\\.neon" . -g '*.{json,neon,md}'
rg -n "bootstrapFiles|scanFiles|scanDirectories|paths|ignoreErrors|includes:" . -g '*.neon*'
```

## Reference Files

- `references/config-and-bootstrap.md` - Config structure, includes, analysed paths, bootstrap files, and WordPress extension wiring
- `references/baseline-and-ci.md` - Baseline strategy, CI integration, and rollout heuristics
- `references/wordpress-stubs-guide.md` - `phpstan-wordpress`, WordPress stubs, and common WordPress static-analysis tradeoffs
- `references/sample-phpstan.neon.dist` - Sample shared config file for a WordPress plugin or theme

## Output Format (PST-23)

For each finding include:

1. Severity: `CRITICAL`, `WARNING`, or `INFO`
2. File and line number
3. Static-analysis issue summary
4. Why it matters for WordPress PHPStan coverage or signal quality
5. Recommended fix

If no issues are found, say so clearly and mention any residual risk such as baseline growth, narrow analysis scope, or undocumented local overrides.
