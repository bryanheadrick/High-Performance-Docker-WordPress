---
name: wp-accessibility-review
description: WordPress accessibility review for themes, blocks, plugins, and admin interfaces. Use when reviewing keyboard navigation, focus behavior, semantic HTML, ARIA usage, form labeling, screen-reader support, contrast-related implementation issues, or when user mentions "accessibility review", "a11y", "keyboard navigation", "focus management", "screen reader", "ARIA", "semantic HTML", "accessible form", or "accessible block". Detects implementation-level accessibility issues in frontend output, block markup, admin screens, and interactive UI behavior.
---

# WordPress Accessibility Review Skill

## Overview

Systematic accessibility review for WordPress themes, blocks, plugins, and admin interfaces. **Core principle:** Accessibility should be built into structure, interactions, and state changes, not patched in with scattered ARIA. Review covers semantic markup, keyboard behavior, focus management, labels, error messaging, admin interactions, block output, and JS-driven UI changes.

## When to Use

**Use when:**
- Reviewing theme templates or block markup
- Auditing admin forms or custom plugin UI
- Checking modal, tab, accordion, or menu interactions
- Reviewing form labels, errors, and focus behavior
- Validating accessible implementation before release

**Don't use for:**
- Pure visual design critique without implementation context
- Performance-only or security-only review
- Color contrast measurement from screenshots alone

## Code Review Workflow

1. **Identify surface**
   - Frontend template
   - Block output
   - Admin interface
   - Interactive JS component

2. **Check structural semantics**
   - Heading order
   - Buttons vs links
   - Form label association
   - Table/list semantics

3. **Check interaction behavior**
   - Keyboard access
   - Focus visibility and focus return
   - Live region or status messaging when needed
   - Dialog/accordion/tab semantics where applicable

4. **Apply severity**
   - **CRITICAL:** Core action inaccessible by keyboard, unlabeled required form controls, modal or menu traps focus incorrectly
   - **WARNING:** Weak semantics, poor error association, ARIA misuse, clickable non-buttons
   - **INFO:** Could improve heading structure, help text, or landmark usage

## File-Type Specific Checks

### Templates and Markup

- CRITICAL: Interactive elements implemented as `div`/`span` without keyboard support
- WARNING: Missing heading structure or landmark usage
- WARNING: Form inputs without labels
- INFO: Could use native elements instead of ARIA-heavy replacements

### JavaScript Interactions

- CRITICAL: Focus not moved into modal or not returned on close
- WARNING: Keyboard handlers incomplete
- WARNING: State changes only visible visually
- INFO: Could use live regions for async updates

### Block and Admin UI Output

- WARNING: Inspector controls or block UI labels unclear
- WARNING: Admin notices not announced appropriately
- INFO: Could improve empty-state clarity and assistive text

## Search Patterns for Quick Detection (A11Y-21)

Use these `rg` commands for fast accessibility-oriented code scanning.

### CRITICAL Patterns

```bash
# Click handlers on non-semantic elements
rg -n "<(div|span)[^>]+on(click|key)" . -g '*.{php,html,js,jsx}'

# Form controls without obvious label references
rg -n "<input|<select|<textarea" . -g '*.{php,html}'

# Dialog or modal implementations
rg -n "dialog|modal|aria-modal|role=['\"]dialog" . -g '*.{php,html,js,jsx}'
```

### WARNING Patterns

```bash
# ARIA usage candidates to inspect manually
rg -n "aria-|role=" . -g '*.{php,html,js,jsx}'

# Button-like links or link-like buttons
rg -n "<a[^>]+href=['\"]#|<button[^>]+onclick" . -g '*.{php,html}'

# Focus management code
rg -n "focus\(|tabindex|keydown|keyup" . -g '*.{js,jsx,php}'
```

### INFO Patterns

```bash
# Headings and landmark structure
rg -n "<h[1-6]|<main|<nav|<aside|<header|<footer" . -g '*.{php,html}'
```

## Reference Files

- `references/semantic-and-form-patterns.md` - Native semantics, labels, error messaging, and form structure
- `references/interactive-a11y-patterns.md` - Modals, menus, accordions, tabs, focus management, and keyboard behavior

## Output Format (A11Y-23)

For each finding include severity, file reference, affected user interaction, why the implementation is inaccessible, and the practical fix. Prefer implementation guidance over broad compliance language.

