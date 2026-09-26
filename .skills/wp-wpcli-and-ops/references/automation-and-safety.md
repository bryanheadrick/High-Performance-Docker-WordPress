# Automation and Safety

Use this reference when reviewing shell scripts, CI jobs, deployment docs, or maintenance workflows built around `wp` commands.

## What Good Ops Docs Usually Include

- target environment clearly named
- path or site targeting when relevant
- inspection step before mutation
- backup/export before destructive changes
- rollback or retry notes
- batching for long-running work

## Deployment and Maintenance Heuristics

### Split inspect from mutate

Prefer a sequence like:

1. `wp option get ...`
2. `wp plugin status ...`
3. `wp db export ...`
4. `wp search-replace ... --dry-run`
5. actual mutation command

That pattern is easier to review than a single opaque shell script.

### Add chunking for large jobs

Long maintenance tasks should avoid one giant scan over all posts, users, or orders when the work can be batched.

```php
$paged = 1;

do {
    $query = new WP_Query(
        array(
            'post_type'      => 'shop_order',
            'posts_per_page' => 100,
            'paged'          => $paged,
            'fields'         => 'ids',
        )
    );

    foreach ( $query->posts as $order_id ) {
        prefix_repair_order( $order_id );
    }

    WP_CLI::log( sprintf( 'Processed page %d.', $paged ) );
    $paged++;
} while ( ! empty( $query->posts ) );
```

### Avoid implicit environment selection

If a script can run against different installs, require or document:

- `--path`
- `--url`
- SSH/container target if remote

### Make long-running jobs observable

For custom commands or scripts:

- log batch boundaries
- print counts of changed rows/items
- fail fast on invalid input
- avoid one giant loop over every post, user, or order when chunking is possible

## Common Review Findings

### CRITICAL

- `wp db drop --yes` or reset-style flows without clear environment guardrails
- mutation script with no backup/export step
- network-wide operation applied where only one site should change

### WARNING

- docs rely on ad hoc `wp eval` for recurring work
- shell examples imply production use but omit dry runs
- no verification pass after the command finishes

### INFO

- could promote repeated shell snippets into a custom WP-CLI command
- could add aliases, examples, or clearer exit messaging

## Simple Runbook Template

For shared project docs, this shape is usually easier to trust:

```text
1. Confirm target environment and site scope.
2. Run read-only inspection command.
3. Export or back up state.
4. Run dry-run mutation where available.
5. Run the real mutation.
6. Verify outcome with another read-only command.
```

## Included Fixture

- `sample-maintenance-runbook.md` gives you a concrete inspect -> dry run -> execute -> verify sequence.
