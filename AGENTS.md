# Repository instructions

This repository publishes a browser-only NIKKE SR collection-item planner.

## Non-negotiable boundaries

- Keep the application fully static and local-first. Do not add analytics,
  remote inventory storage, authentication, or data uploads without explicit
  project-owner approval.
- Treat `data/rulesets/` as the auditable game-data baseline.
- Preserve the exposed `window.__SR_CALCULATOR__` API unless a versioned
  migration and updated browser tests are included.
- Do not edit expected totals without recomputing them from the ruleset.
- Do not add third-party game art or copyrighted assets without documented
  permission.
- Do not commit `dist/`, `node_modules/`, browser reports, or local state.

## Required checks

Run `npm test` and `npm run test:browser` before publishing. A release must be
built from the same source state deployed to GitHub Pages.
