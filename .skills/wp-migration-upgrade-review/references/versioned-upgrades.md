# Versioned Upgrades

Good upgrade routines are:

- Guarded by stored version checks
- Safe to run more than once
- Ordered from oldest to newest migration
- Explicit about when they finish

## Prefer

- One migration manager or ordered upgrade map
- Persistent version flags
- Small, resumable steps for heavy work

## Avoid

- Running migrations on every request
- Mixing activation setup and later upgrade logic without version tracking
- Destructive deletes before data has been copied or verified

