# Embedding and Repros

Use this reference for docs pages, tutorials, bug reports, and embedded demos that rely on Playground.

## Official Anchors

- The Blueprint docs explicitly call out URL fragment and `blueprint-url` usage.
- Playground is positioned in the official docs as a way to experiment with WordPress quickly and share setup flows.

## Review Goals

- Make the repro easy to launch.
- Keep the landing page relevant to what the user should inspect.
- Avoid requiring side instructions that are not encoded in the repro itself.

## Good Repro Pattern

1. state the bug or behavior being demonstrated
2. provide a Blueprint or `blueprint-url`
3. set the landing page to the screen that matters
4. seed only the content/settings needed for the repro

## Lightweight Repro Template

```text
Issue:
- What is broken?

Launch:
- Blueprint file or `blueprint-url`

Expected:
- What the user should see after launch

Actual:
- What is wrong in the loaded Playground instance
```

## Embedded Demo Warnings

- iframe or embed loads a generic site instead of the relevant state
- issue report says "click around until you find it"
- repro depends on local files but is presented like a portable public demo
- no note about experimental or version-sensitive features

## Nice-to-Have Improvements

- include a short "what to look for" note
- provide one minimal repro and one richer teaching/demo variant if needed
- use snapshot output for heavier example sites instead of giant live setup sequences

## Review Question

Ask: "Could another developer reproduce this issue from the linked Playground artifact alone?" If the answer is no, the repro is still too implicit.
