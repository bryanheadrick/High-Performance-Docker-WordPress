# Settings and Screens

Use this reference when reviewing WordPress admin pages and settings screens.

## Good Defaults

- Register menu pages with explicit capabilities
- Use the Settings API for durable settings pages
- Split large settings screens into sections or tabs
- Enqueue scripts and styles only for the target admin screen

## Common Problems

- One callback handles rendering, saving, redirects, and notices
- Scripts loaded across all of `wp-admin`
- Option updates happen directly in template files
- No clear separation between admin routing and UI rendering

