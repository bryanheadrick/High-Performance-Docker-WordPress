# WP-CLI Command Patterns

Use this reference when the codebase defines custom WP-CLI commands or ships operational docs that rely on CLI workflows.

## Official Anchors

- The WP-CLI command index lists operational areas like `wp cron`, `wp db`, `wp cache`, `wp site`, `wp search-replace`, `wp server`, and `wp transient`, which is a good reminder that command scope in WordPress often spans data, cache, and multisite concerns.
- `wp eval-file` runs on `before_wp_load`, which makes it powerful but also easy to misuse for brittle one-off scripts when a custom command would be clearer.

## Review Goals

- Make side effects obvious from the command name and synopsis.
- Validate arguments before touching data.
- Separate inspection commands from mutation commands where possible.
- Prefer deterministic command classes over free-form `wp eval` snippets in shared docs.

## Good Command Design

### Name by intent

Prefer verbs that clearly communicate the result:

- `wp my-plugin cache-prime`
- `wp my-plugin migrate-orders`
- `wp my-plugin audit-settings`

Avoid vague commands like:

- `wp my-plugin run`
- `wp my-plugin fix`

### Prefer command classes when the workflow grows

For one-off callbacks, inline registration can be fine. For commands with validation, batching, or multiple sub-steps, a `WP_CLI_Command` class is usually easier to review and extend.

```php
class Prefix_Cache_Prime_Command extends WP_CLI_Command {

    /**
     * Prime expensive cache entries.
     *
     * ## OPTIONS
     *
     * [--batch-size=<number>]
     * : Number of records to process per batch.
     */
    public function __invoke( $args, $assoc_args ) {
        $batch_size = isset( $assoc_args['batch-size'] ) ? absint( $assoc_args['batch-size'] ) : 100;

        if ( $batch_size < 1 ) {
            WP_CLI::error( 'Batch size must be greater than zero.' );
        }

        WP_CLI::log( sprintf( 'Priming cache in batches of %d.', $batch_size ) );
    }
}

WP_CLI::add_command( 'prefix cache-prime', 'Prefix_Cache_Prime_Command' );
```

### Validate before mutating

```php
WP_CLI::add_command(
    'prefix cache-prime',
    function( $args, $assoc_args ) {
        $batch_size = isset( $assoc_args['batch-size'] ) ? absint( $assoc_args['batch-size'] ) : 100;

        if ( $batch_size < 1 ) {
            WP_CLI::error( 'Batch size must be greater than zero.' );
        }

        WP_CLI::log( sprintf( 'Priming cache in batches of %d', $batch_size ) );
    }
);
```

### Prefer custom commands over shared `eval`

`wp eval` and `wp eval-file` are useful for controlled debugging and one-off maintenance, but shared project docs should usually prefer custom commands because they are easier to review, version, test, and explain.

## BAD/GOOD Review Patterns

### Ambiguous mutation command

```php
// BAD: The name hides the fact that it writes data.
WP_CLI::add_command(
    'prefix sync',
    function() {
        prefix_rebuild_remote_cache();
    }
);

// GOOD: The name signals the effect.
WP_CLI::add_command(
    'prefix cache-rebuild',
    function() {
        prefix_rebuild_remote_cache();
    }
);
```

### Read-only and write behavior mixed together

```php
// BAD: "audit" unexpectedly updates data.
WP_CLI::add_command(
    'prefix audit-orders',
    function() {
        prefix_fix_broken_orders();
        WP_CLI::success( 'Done.' );
    }
);

// GOOD: Separate inspection from repair.
WP_CLI::add_command( 'prefix audit-orders', 'Prefix_Audit_Orders_Command' );
WP_CLI::add_command( 'prefix repair-orders', 'Prefix_Repair_Orders_Command' );
```

## Operational UX

- Log what the command is about to do.
- Print counts or affected scopes before mutations.
- Emit errors early when preconditions fail.
- Add a dry-run mode when the command can change large amounts of data.
- Chunk long-running work instead of looping across the whole install at once.

## Warning Signs

- Command uses raw `$args` values without validation.
- Read-only inspection unexpectedly updates options or metadata.
- Command assumes a single-site install in code that may run on multisite.
- Shared docs recommend `wp eval` for recurring maintenance.

## Included Fixture

- `sample-wp-cli-command.php` provides a real command class with validation, batching, logging, and dry-run support.
