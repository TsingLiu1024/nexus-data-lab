# NEXUS Data Lab Implementation Plan

> 初版历史记录。v1.1 优化方案与执行状态见 optimization-design.md 和 optimization-plan.md。
> Goal: Build, verify and push a complete Chinese CSV analytics workspace with a dark technology theme.
> Architecture: In-memory immutable datasets, pure data operations, shared filtered rows for all consumers, React views and Recharts.
> Spec: docs/design.md
> Execution: Native execution; user explicitly requested full automation, so design, implementation and delivery proceed without intermediate review questions.

## Global constraints

- No backend, API keys, file uploads, persistence or external font dependencies.
- Import limits: 10 MiB, 50,000 rows, 100 columns; reject without silently truncating data.
- Preserve raw cell text; unique column keys; handle missing data consistently.
- Default private GitHub repository; never overwrite an existing repository.

## Review focus

- Malformed CSV and changed encoding must not replace a valid dataset.
- Numeric-looking identifiers and missing values must not corrupt sums or sorting.
- Filtered-zero and text-only datasets must render useful empty states.
- CSV formulas, quotes, newlines and duplicate column labels must export safely.
- Mobile controls, focus management and table overflow must remain usable.

## Task 1 — Data engine

- [ ] Write behavior tests for parseCsv(text, name), profileColumn(rows, column), selectRows(dataset, query, filters, sort), aggregateRows(rows, dimension, metric, mode) and serializeCsv/serializeJson.
- [ ] Observe failing assertions against skeletons, then implement src/data.ts.
- [ ] Run npm test; commit passing engine with config and plan.

## Task 2 — Analytics workspace

- [ ] Write Playwright user-flow tests in tests/workspace.spec.ts before views.
- [ ] Implement src/App.tsx, focused src/components, src/styles.css and demo dataset.
- [ ] Validate import, queries, filtering, sorting, pagination, charts, export, recovery and mobile layout in a real browser.

## Task 3 — Delivery

- [ ] Build production output and capture screenshots after visual inspection.
- [ ] Write Chinese README, MIT license, CI and manual Pages workflow.
- [ ] Run complete unit suite, browser suite, production build and dependency audit.
- [ ] Review completed source independently of implementation pass; resolve material findings.
- [ ] Create private nexus-data-lab repository using existing GitHub credentials, push main, verify remote SHA and CI result.
