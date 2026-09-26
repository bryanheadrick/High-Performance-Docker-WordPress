# Test Layer Guide

Choose the lightest test that still gives confidence.

## Prefer Unit Tests For

- Pure functions
- Validation and transformation logic
- Serialization or parsing helpers

## Prefer Integration Tests For

- Hooks, filters, persistence, queries, and permission logic
- REST routes and admin-post handlers
- Block rendering in PHP

## Prefer E2E For

- Editor interactions
- Admin form workflows
- Checkout or cart flows
- Accessibility-sensitive UI behavior

