# Config and Bootstrap

Use this reference when reviewing `phpstan.neon`, `phpstan.neon.dist`, or related bootstrap files.

## Official Anchors

- PHPStan officially looks for `phpstan.neon`, `phpstan.neon.dist`, or `phpstan.dist.neon` when no explicit config is passed.
- The config reference recommends keeping a committed `.dist` file and letting local overrides live in `phpstan.neon`.
- The NEON `includes` mechanism is the official way to compose config files.
- Bootstrap files are the place to initialize runtime state PHPStan needs before analysis.

## Review Rules

### Commit a stable shared config

For teams, the usual baseline is:

- `phpstan.neon.dist` under version control
- optional local `phpstan.neon` for per-machine overrides

### Analyse your own code, not the whole world

Prefer explicit `paths` for project code. Avoid analysing `vendor/` just because dependencies exist.

### Use bootstrap only for real runtime setup

Bootstrap files are appropriate when PHPStan needs:

- an autoloader
- constants
- runtime glue for custom discovery

They should not become a dumping ground for unexplained side effects.

## Good Pattern

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon

parameters:
    level: 5
    paths:
        - plugin.php
        - inc/
```

If `phpstan/extension-installer` is present, the manual include may not be needed. The key review question is whether the extension is actually loaded in the project's chosen setup.

## More Complete Example

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon

parameters:
    level: 5
    paths:
        - plugin.php
        - inc/
        - tests/
    bootstrapFiles:
        - phpstan-bootstrap.php
    tmpDir: tmp/phpstan
```

This is not mandatory boilerplate. It is a useful review target when the project needs a committed shared config, a WordPress-aware extension, and a small amount of bootstrap wiring.

## Warning Signs

- config exists but `paths` miss the plugin/theme source
- huge exclude lists hiding first-party code
- local-only config is carrying important shared rules
- WordPress extension mentioned in docs but not wired into config
- bootstrap file exists but nobody can explain what runtime gap it is solving

## Included Fixture

- `sample-phpstan.neon.dist` is a small shared-config example for plugin or theme repos.
