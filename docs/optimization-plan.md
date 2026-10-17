# NEXUS Data Lab Optimization Implementation Plan

**Goal:** Deliver all seven approved optimizations in priority order.
**Architecture:** Pure operations, resident worker with cached analytics, explicit IndexedDB persistence, staged import, Node launcher.
**Spec:** docs/optimization-design.md
**Execution:** Native in this session; user requested fully automatic implementation and push.

## Review Focus
- Numeric comparison must preserve text identifiers; trend and distribution ordering differ.
- Original file bytes govern limits; failed/cancelled import preserves active data.
- Stale worker responses cannot overwrite current query; exports use the displayed query.
- Explicit saved data must restore consistently and remain deletable.
- 50,000-row input must not block main-thread typing; fixed startup origin preserves storage.

## Task 1 — Correctness
- [ ] Add failing regressions in src/data.test.ts for typed equality, numeric axes, original-byte size.
- [ ] Implement comparison and aggregation options in src/data.ts; run suite and commit.

## Task 2 — Worker and performance
- [ ] Test pagination, query cache, sorted export and staged-import atomicity in src/analysis.test.ts.
- [ ] Implement src/analysis.ts, data.worker.ts, worker-client.ts; raw data stays in worker.
- [ ] Update App, Charts and DataTable for asynchronous paginated analytics; debounce 150ms and ignore stale results.
- [ ] Verify real worker and large-input responsiveness in browser.

## Task 3 — Startup
- [ ] Test launcher identity, occupied port and no-browser production service.
- [ ] Implement start.cmd and scripts/start.mjs with dependency/build fingerprints, service reuse and Edge opening.

## Task 4 — Workspace
- [ ] Test IndexedDB roundtrip, delete, transaction failure and saved-state validation.
- [ ] Implement src/workspace.ts and worker save/restore/delete; add UI and cross-refresh browser tests.

## Task 5 — Configured import
- [ ] Test delimiter/date formats/types and invalid conversions before implementation.
- [ ] Implement staged preview, config refresh, type overrides and confirmation in ImportDialog.
- [ ] Update previous browser imports and add configured-import regressions.

## Task 6 — Delivery
- [ ] Complete unit/browser suites, production build, audit, screenshots and independent read-only review.
- [ ] Update README/verification, archive source, push main and verify GitHub CI.
