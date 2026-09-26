# Schema and Backfill Guide

Use this reference for database and data migrations.

## Review For

- `dbDelta()` suitability
- Table charset/collation consistency
- Large backfills on web requests
- Missing batching or progress tracking
- No fallback path if a batch fails halfway through

## Good Patterns

- Schema step first, data step second
- Backfills chunked and resumable
- Action Scheduler or WP-CLI for heavy migrations

