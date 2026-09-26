# Contributing to WordPress Skills for Claude and Codex

Thanks for contributing. This project is built around practical WordPress review workflows, so the best contributions usually make the guidance clearer, more accurate, or more useful in real codebases.

## Good Ways to Contribute

### Report an Issue

Open an issue when you find:

- Incorrect or outdated guidance
- Missing edge cases
- False positives in review patterns
- Confusing docs or examples

Helpful issue details:

- Skill name
- What went wrong
- What you expected instead
- A small code sample, if relevant

### Suggest an Improvement

Open an issue or PR for:

- New anti-patterns or best practices
- Better BAD/GOOD examples
- Improved trigger phrases
- Clearer workflow steps
- Missing WordPress, Gutenberg, theme, or WooCommerce guidance

Helpful context:

- Why the change matters
- Where it applies
- Links to docs, benchmarks, or references when available

### Improve Documentation

Documentation improvements are always useful, especially when they:

- Tighten wording
- Fix ambiguity
- Add practical examples
- Keep naming, commands, and install guidance in sync

### Add a New Skill

If you want to add a new skill, start by checking whether it belongs as:

- A new standalone skill
- A reference expansion for an existing skill
- A new command for an existing skill

That usually keeps the pack focused and avoids overlap.

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/jorgerosal/wordpress-skills.git
   cd wordpress-skills
   ```

2. Create a branch for your work:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Test your changes locally. For a single Claude skill, copying it into your Claude skills directory is often enough:

   ```bash
   cp -r claude-skills/your-skill ~/.claude/skills/
   ```

4. For Codex wrappers, copy the relevant folder into `~/.codex/skills/` or `$CODEX_HOME/skills/`, and copy the matching shared references under `claude-skills/` into `~/.codex/claude-skills/` or `$CODEX_HOME/claude-skills/`.

5. Run the repository validator:

   ```bash
   python3 scripts/validate_repo.py
   ```

6. Restart Claude Code or reload Codex if needed so the updated skill is available.

## Repository Structure

```text
claude-skills/
  wp-performance-review/
  wp-security-review/
  wp-plugin-development/
  wp-block-development/
  wp-theme-development/
  wp-woocommerce-dev/
  wp-rest-api-development/
  wp-admin-ui-development/
  wp-migration-upgrade-review/
  wp-accessibility-review/
  wp-test-strategy/
  wp-site-audit-and-onboarding/
  wp-wpcli-and-ops/
  wp-playground-development/
  wp-phpstan-review/

codex-skills/
  wp-performance-review/
  wp-security-review/
  wp-plugin-development/
  wp-block-development/
  wp-theme-development/
  wp-woocommerce-dev/
  wp-rest-api-development/
  wp-admin-ui-development/
  wp-migration-upgrade-review/
  wp-accessibility-review/
  wp-test-strategy/
  wp-site-audit-and-onboarding/
  wp-wpcli-and-ops/
  wp-playground-development/
  wp-phpstan-review/

commands/
  wp-perf-review.md
  wp-perf.md
  wp-sec-review.md
  wp-sec.md
  wp-plugin-review.md
  wp-plugin.md
  wp-block-review.md
  wp-block.md
  wp-theme-review.md
  wp-theme.md
  wp-woo-review.md
  wp-woo.md
  wp-rest-review.md
  wp-rest.md
  wp-admin-review.md
  wp-admin.md
  wp-migration-review.md
  wp-migration.md
  wp-a11y-review.md
  wp-a11y.md
  wp-test-review.md
  wp-test.md
  wp-onboard-review.md
  wp-onboard.md
  wp-ops-review.md
  wp-ops.md
  wp-playground-review.md
  wp-playground.md
  wp-phpstan-review.md
  wp-phpstan.md
```

## Skill Authoring Guidelines

Each skill wrapper should have:

- A `SKILL.md` file with YAML frontmatter
- A clear scope
- Trigger phrases that match real user requests
- Review steps that are specific enough to follow
- Cross-references when another skill should handle deeper analysis

Claude skills may include deeper in-repo references and command integrations. Codex skills can stay thinner and point at the shared reference docs under `claude-skills/`.

### `SKILL.md` Frontmatter

```markdown
---
name: skill-name
description: What this skill does, when it should be used, and which requests should trigger it.
---
```

Frontmatter rules:

- `name`: lowercase with hyphens
- `description`: concise, specific, and trigger-aware

### Good Skill Content

Strong skill docs usually:

- State when to use the skill and when not to use it
- Separate quick detection from deeper review
- Use examples that look like real WordPress code
- Explain severity consistently
- Avoid vague advice like "optimize this" without telling the model what to check

## Code and Example Standards

All PHP examples should follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/).

```php
$query = new WP_Query(
    array(
        'post_type'      => 'post',
        'posts_per_page' => 10,
        'no_found_rows'  => true,
    )
);

if ( $query->have_posts() ) {
    while ( $query->have_posts() ) {
        $query->the_post();
        // Process post.
    }
}
wp_reset_postdata();
```

Key conventions:

- Spaces inside parentheses: `function_name( $arg )`
- Use `array()` instead of `[]`
- Yoda conditions where appropriate
- Snake_case for WordPress-style functions and variables
- Prefix custom global functions

## Severity Language

Use severity labels consistently across docs:

| Level | Meaning |
|-------|---------|
| **CRITICAL** | Vulnerability, broken behavior, review blocker, or high-risk production issue |
| **WARNING** | Significant correctness, maintainability, compatibility, or performance concern |
| **INFO** | Lower-risk improvement, modernization, or follow-up opportunity |

If a skill needs domain-specific nuance, keep the global meaning intact and add the nuance inside the skill.

## Creating a New Skill

1. Create the directory structure:

   ```bash
   mkdir -p claude-skills/wp-your-skill/references
   ```

2. Add the Claude skill in `claude-skills/wp-your-skill/` with frontmatter, scope, workflow, and output guidance.

3. Add the parallel Codex wrapper in `codex-skills/wp-your-skill/` if the domain should also be available in Codex.

4. Add reference files only when they materially help the skill.

5. Add command files in `commands/` if the Claude skill should support explicit slash-command invocation.

6. Update [README.md](README.md) so the public docs reflect the new skill or command.

7. Add a release note entry in [CHANGELOG.md](CHANGELOG.md).

8. Run `python3 scripts/validate_repo.py`.

## Pull Request Checklist

Before opening a PR:

- Make sure naming and repository references are current
- Keep command examples and docs in sync
- Update README or contributing docs when behavior changes
- Add a changelog entry for user-visible changes
- Keep edits scoped to the skill or docs you are improving

## Review Expectations

PRs are easier to review when they include:

- A clear summary of the change
- The skill or command affected
- Why the update improves accuracy or usability
- Example input or output when the change affects behavior

## Code of Conduct

- Be respectful
- Be specific
- Assume good intent
- Focus on improving the work

## Questions

Open an issue with the `question` label if you want feedback before drafting a larger change.
