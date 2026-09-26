# Schema and Auth Guide

Use this reference when reviewing request args, permission callbacks, and response consistency.

## Request Handling

- Prefer `$request->get_param()` over raw globals
- Define `sanitize_callback` and `validate_callback` for public args
- Return `WP_Error` with clear codes for invalid requests

## Permission Callbacks

- Every non-public route needs a meaningful `permission_callback`
- Use capability checks plus ownership checks where relevant
- `__return_true` is only appropriate for intentionally public read endpoints

## Response Design

- Keep collection and item responses consistent
- Return structured error responses
- Use pagination metadata for list endpoints where useful

