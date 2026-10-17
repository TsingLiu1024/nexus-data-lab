# v1.2.0 release readiness

Intent: finish the five improvements accepted in chat, retaining local-only processing, the dark interface and private repository visibility. Execute autonomously in this session on `improve/release-1.2`; merge and push after verification.

## Design

- Give numeric and date trends a linear continuous X axis. Position aggregated ranges at their midpoint, retaining the original range in tooltips. Show missing-axis groups separately rather than inventing coordinates. Text remains categorical. Keep the existing worker and aggregation interfaces.
- Exercise the browser suite on Ubuntu Chromium and Windows Edge. Add actual launcher smoke tests in a Chinese path, including reuse, changed sources and occupied ports. Tests must clean up only their own processes and temporary directory.
- Add weekly grouped npm and GitHub Actions Dependabot updates, with no automatic merging. Cancel superseded CI runs and keep failure artifacts separate per OS.
- Improve About, Topics, README badges and a recorded walkthrough. Link the homepage to the release overview until a public demo is explicitly commissioned.
- Publish v1.2.0 only from the tested commit, with release notes, a complete source ZIP (excluding dependencies and local state), a static-site ZIP and SHA-256 checksums. Both distributions explain their Node/server requirements. Do not change repository visibility or purchase GitHub features.

## Tasks

- [x] 1. Reproduce incorrect X spacing in browser tests; implement a tested trend model and continuous axes. Cover negative numbers, non-ISO dates, merged ranges, singletons, missing values, text and both chart kinds.
- [x] 2. Add launcher smoke coverage and Ubuntu/Windows CI; configure Dependabot. Local verification passed; cloud verification is the Task 5 publish gate.
- [x] 3. Add changelog, release instructions, accurate README presentation and walkthrough; update package version to 1.2.0.
- [ ] 4. Run unit, launcher, browser and build checks, obtain an independent code review and resolve material findings.
- [ ] 5. Merge and push; wait for both CI jobs, create matching tag and Release, upload verified packages and checksums, update GitHub metadata and verify remote state.

## Review focus

- Irregular numeric/time gaps must have proportional pixel spacing in area and bar charts.
- Missing-axis groups must remain visible in the summary; bins keep their full range labels and counts.
- Single points, negative coordinates and dates around year boundaries must render without invalid domains or misleading date labels.
- A launcher test must never kill an unrelated listener or leave its own server running.
- Release archives must exclude credentials, user datasets, node_modules and browser state; archives must be independently extractable and checksums accurate.

## Progress / rulings

- Baseline: 40 unit tests and 2 launcher tests passed; clean starting commit `2e05be7`.
- Ruling: use a branch in the existing clean checkout to retain installed dependencies and the user's established launch path. Full automation was already requested; no additional design approval round is required.
- Ruling: implement the previously recommended first five items. Multi-workspace storage and unrelated refactoring remain future work.
- Task 1: complete — 46 unit tests passed; old date spacing ratio 1 failed against expected 99, both chart kinds now pass the browser geometry checks.
- Task 2: complete locally — 2 unit tests and 1 real launcher smoke test passed. Ruling: also fix the Windows wrapper's lost exit code, reproduced by the new smoke test, because it hid launch failures from CI and callers.
- Task 3: complete — package / lockfile version 1.2.0, dynamic UI version, changelog and download instructions, refreshed screenshots, five-frame synthetic-data GIF. About / Topics will be applied after review and push.
- Task 4: local verification passed — 46 unit + 2 launcher unit + 1 smoke + 19 browser tests, TypeScript / production build, YAML parse and diff whitespace checks. Independent review pending.
