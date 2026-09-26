# WordPress Stubs Guide

Use this reference when reviewing WordPress-specific PHPStan support packages.

## Official Anchors

- `szepeviktor/phpstan-wordpress` is a WordPress extension for PHPStan that enables analysis of plugins and themes.
- Its README says to install it with Composer and, without `phpstan/extension-installer`, to include `vendor/szepeviktor/phpstan-wordpress/extension.neon`.
- The extension relies on `php-stubs/wordpress-stubs`.
- `php-stubs/wordpress-stubs` provides WordPress core function and class stubs and documents Composer installation for static-analysis usage.

## Review Rules

### Make sure the WordPress layer is real

If a project claims to run PHPStan on WordPress code, confirm it has either:

- `szepeviktor/phpstan-wordpress`, or
- another clearly documented and maintained WordPress-aware setup

Concrete install pattern from the upstream docs:

```bash
composer require --dev szepeviktor/phpstan-wordpress
```

And for WordPress core stubs:

```bash
composer require --dev php-stubs/wordpress-stubs
```

### Treat stubs as infrastructure, not magic

Stubs improve symbol knowledge, but they do not replace:

- good config
- sensible paths
- a real rollout plan

If the project does not use `phpstan/extension-installer`, the upstream `phpstan-wordpress` docs say to include:

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon
```

### Keep expectations practical

Some dynamic WordPress patterns will still need:

- bootstrap files
- scan files/directories
- targeted ignores
- better PHPDoc

## Common Findings

- extension installed but not loaded
- stubs present with no explanation of how they are used
- project expects WordPress globals and dynamic hooks to type-check without any supporting setup
- baseline hides problems caused by missing WordPress-specific wiring
- no PHPDoc or bootstrap support for dynamic patterns the team knows PHPStan cannot infer by itself
