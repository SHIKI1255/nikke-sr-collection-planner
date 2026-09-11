# NIKKE SR Collection Item Enhancement Planner

[简体中文](README.md) | [English](README.en.md)

[![CI](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml)
[![Pages](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml)

A fully local, browser-based enhancement planner for NIKKE SR Collection Items. Enter the current Phase, EXP, and R, SR, and SSR Maintenance Kit inventory to get a recommended strategy and estimated average kit use. Record each Normal Result or Super Success to update the plan automatically.

- Use online (English): [English Page](https://shiki1255.github.io/nikke-sr-collection-planner/en/)
- Use online (Chinese): [Chinese Page](https://shiki1255.github.io/nikke-sr-collection-planner/)
- Use offline: [Download the latest Release](https://github.com/SHIKI1255/nikke-sr-collection-planner/releases/latest)
- Current program version: `v1.4.0`
- Current data baseline: `2026-07-29`
- Created by: [SHIKI1255](https://github.com/SHIKI1255)

## Features

- Uses actual Maintenance Kit quantities; every 10 kits of the same rarity support one enhancement attempt.
- Supports the current Phase, current EXP, target Phase, and reserved inventory.
- Estimates how many target completions the available inventory can support.
- Shows the current recommended kit and mixed-strategy shares.
- Provides circle, triangle, and cross recommendations for Phases 0–4, 5–9, and 10–14, limited to the selected target Phase.
- Deducts inventory and recalculates after each recorded Normal Result or Super Success.
- Uses distinct blue, purple, and gold semantics for R, SR, and SSR in both light and dark themes.
- Supports automatic system theme matching and manual light or dark selection from the top-right controls.
- Preserves calculation inputs, Phase headings, strategy marks, the data baseline, and creator information when printing or saving as PDF.
- Provides independent Chinese and English pages without a language switch or automatic redirect.
- Runs completely offline and never uploads inventory or enhancement history.

## Language Pages

The Chinese and English pages share the same calculation logic, ruleset, visual system, and local state. The build injects one language catalog into each standalone page.

The English interface consistently uses the NIKKE-oriented terms `Collection Item`, `Maintenance Kit`, `Phase`, and `Super Success`. `Normal Result` describes a regular enhancement outcome without incorrectly presenting it as a failure. Automated tests keep calculation results and interactions identical across both pages.

## Theme and Colors

The top-right selector provides `Auto`, `Light`, and `Dark` modes. The initial `Auto` mode follows the system theme. A manual light or dark selection is stored in the current browser and overrides later system changes until `Auto` is selected again.

Color supplements rather than replaces text: R is blue, SR is purple, and SSR is gold. Primary, mixed/secondary, and not-recommended states also retain circle, triangle, and cross marks.

## Understanding Recommendations

All results are probability-based estimates, not guaranteed costs for a single enhancement.

When multiple Maintenance Kits and percentages appear together, they represent a mixed-strategy share. A circle marks the primary choice, a triangle marks a secondary option in the mixed strategy, and a cross marks a kit that is not recommended for the current inventory. Record the actual outcome and recalculate after every enhancement.

## Data and Calculation

- Ruleset: [`data/rulesets/2026-07-29.json`](data/rulesets/2026-07-29.json)
- Data sources: [`data/sources.yml`](data/sources.yml)
- Audit workbook: [`reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx`](reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx)
- Calculation model: [`docs/calculation_model.md`](docs/calculation_model.md)
- Recommendation boundaries: [`docs/recommendation_boundaries.md`](docs/recommendation_boundaries.md)
- UI, VI, and content standard: [`docs/ui_content_style_guide.md`](docs/ui_content_style_guide.md)

The ruleset and program version are independent. When game data changes, update the ruleset, source records, and regression baselines instead of changing only displayed values.

The program version tracks application, interface, and build changes. The data baseline records when game probabilities and enhancement rules were reviewed. See [`CHANGELOG.md`](CHANGELOG.md) for the complete history.

## Local Validation

Node.js 20 or later is required.

```powershell
npm ci
npx playwright install chromium
npm run check
```

Build the GitHub Pages routes and standalone offline files:

```powershell
npm run build
```

Generated files are written to `dist/`. This directory is not committed.

## Source Layout

The source uses strict TypeScript, native HTML/CSS and esbuild, without a UI framework. Distribution remains a double-clickable, standalone HTML file.

- `src/core/`: pure rules validation, transition graph, optimizer and bounded cache; no DOM or storage dependency.
- `src/state/`: kit inventory, targets, history/undo and storage migration; budgets are converted to enhancement attempts.
- `src/runtime/`: themes, calculation tasks and Worker/cooperative execution.
- `src/view/`: formatting, forms, results, history and shared SVG icons.
- `src/index.html`, `src/locales/`, `src/styles/`: shared template, language catalogs and VI tokens.
- `src/app.ts`, `src/worker.ts`: page and background-computation entry points.
- `config/site.json`: ruleset/scenario selection and language build routes.

Rules are sourced from `data/rulesets/`; default inventory comes from `data/scenarios/`. Do not duplicate game constants in application code. The template is not a distributable file. The build produces both Pages routes and both standalone downloads.

See [Architecture and compatibility](docs/architecture.md). Preview and performance commands:

```powershell
npm run preview
npm run benchmark
npm run benchmark -- --baseline-ref 4e6cd64
```

Preview listens only on `127.0.0.1:4173`, with Chinese at `/` and English at `/en/`. Benchmarks report the median of five independent runs per profile. CPU throttling simulates a slower machine; it is not a physical mobile-device measurement. Compare against a pre-refactor commit.

## Refactor Highlights

- Existing layouts, VI, offline files and historical numerical baselines are preserved. The public calculation API remains compatible.
- Editing any calculation input invalidates the old plan. Recalculate manually; reaching a target never advances it automatically.
- Background work produces the current result first, then the Phase tables. Superseded tasks cannot overwrite inputs; identical requests can reuse cached results.
- Records and undo are saved before recalculation. Legacy inventory is migrated and damaged history entries are discarded.
- The page's print button waits for a complete plan. Native browser printing shows a warning instead of an incomplete or outdated report.
- With no usable inventory, the shortage belongs to a reference strategy, not a proven minimum-shortage solution. All results remain probabilistic expectations.

## Publishing

- PRs use the shared validation gate. A `main` push is validated once by the Pages workflow before deployment.
- Pushing a `v*` tag runs the same gates and creates a GitHub Release.
- Each Release contains Chinese `NIKKE_SR.html`, English `NIKKE_SR_EN.html`, and `SHA256SUMS.txt`.

See [`docs/release_process.md`](docs/release_process.md) for the detailed process.

## Contributing

Use the relevant Issue template for application defects, game-data corrections, or feature requests. Data corrections must identify the source, review date, affected scope, and whether they were verified in game. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Disclaimer

This is an unofficial fan tool and is not affiliated with SHIFT UP, Level Infinite, or any related operator. The NIKKE name and related trademarks belong to their respective owners. See [`DISCLAIMER.md`](DISCLAIMER.md).

## License

Original code and documentation in this repository are licensed under the [MIT License](LICENSE). Third-party names, trademarks, links, and factual data retain their original rights.
