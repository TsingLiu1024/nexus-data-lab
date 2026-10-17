# v1.3.0: multi-workspace and maintenance

**Goal:** complete the remaining three approved improvements: maintainable source, multiple named local workspaces with portable backups, and useful GitHub contribution/feedback entry points. Execute autonomously, preserving dark styling, local-only data handling and private repository visibility.

## Design and ownership

- Root owns workspace validation/storage, worker protocol, workspace hook/bar, App layout extraction, lint/format configuration, tests, README/changelog, verification and release.
- Documentation worker owns CONTRIBUTING and GitHub issue/PR templates only; no shared source edits.
- Existing IndexedDB v1 `workspaces` store remains, with namespaced data/metadata keys. Migrate old `current`/`metadata` atomically and retain the old snapshot until successful migration. Loading the page still shows demo data until explicit restore.
- New metadata: stable ID, user name, source filename, row count, save timestamp and revision token. Save/rename/delete are atomic; an outdated revision refuses to overwrite another tab's update. Select new/existing workspaces, name them (1–80 trimmed characters), restore and delete explicitly. Save/rename refuse duplicate names. Backups import as a new ID, with a unique name; they never replace existing saves or active analysis.
- JSON backup envelope: `{format:'nexus-workspace', version:1, name, snapshot:SavedWorkspace}`. Validate schema/types, date formats, own row keys, preferences, numeric/date cells and budgets before writing. Maximum backup file 128 MiB and maximum dataset text payload 64 MiB; existing CSV limits (10 MiB source, 50,000 rows, 100 columns) remain. Unsupported or oversized imports preserve current and saved data. Backup export/import and serialization run in the worker, buffers transferred to avoid main-thread row cloning.
- Keep source focused: extract the large navigation and statistics layouts from App, separate workspace state/actions from its presentation, centralize download handling, use Oxlint and Prettier with CI checks. Avoid unrelated app behavior changes.
- Version 1.3.0, source/static ZIPs and checksums, refreshed screenshots/walkthrough, About/Topics/README/Release kept in sync. Two-platform CI must pass for the release commit before tagging/publishing.

## Tasks

- [x] 1. Write failing tests for safe multi-workspace storage, v1 migration, atomic failure preservation, stale-revision protection, named save/rename/delete and validated backup roundtrips.
- [x] 2. Implement storage and backup modules, worker commands and UI; add real browser flows for two saved datasets, refresh, backup, invalid imports, delete and legacy migration.
- [x] 3. Extract App layouts, configure formatting/static checks, format source/config/docs and add quality gates to CI.
- [x] 4. Integrate collaboration docs/templates and update README, changelog, screenshots and usage instructions.
- [ ] 5. Run local checks, independent review and fixes; push, verify Windows/Ubuntu CI; publish v1.3.0 and verify assets/metadata.

## Review focus

- No migration, import error, quota failure or stale revision may destroy an existing saved workspace.
- Backups must preserve raw cells, types/date formats and all analysis preferences; untrusted JSON must not bypass size/type validation.
- A selected saved workspace and active unsaved analysis must be clearly distinguishable; backup operations act on the selected save.
- Rendering and initial workspace listing must not transfer all saved datasets to the main thread.
- Formatter/lint/refactoring must preserve chart geometry, mobile width, keyboard flows, launchers and the local-data privacy contract.

## Ledger

- Baseline: clean `main` at `349d383`, v1.2.0; existing 70 checks and both platforms' CI previously passed. Work on `improve/workspaces-maintenance` in the existing checkout.
- Full automation and GitHub synchronization are explicitly authorized. Public visibility, hosting, backend/accounts and bulk dependency upgrades are outside scope.

- Ruling: typescript-eslint 8.71.2 requires TypeScript <6.1, conflicting with this project’s TypeScript 7.0.2. Use Oxlint (native TypeScript 7 support) plus Prettier; no forced peer overrides or compiler downgrade.

- Tasks 1–4 complete: 56 unit + 3 launcher unit + 1 real launcher smoke + 24 browser tests passed, along with format, lint and build. Legacy migration, late-write rollback, untrusted backups and multi-tab conflict tests are included. Collaboration docs were independently implemented and YAML-checked; seven-frame walkthrough and screenshots refreshed.
- Independent review complete: bounded new queries/backups to 32 filters and 4096 characters per query/value, preserved oversized legacy local preferences during migration/read, corrected backup extensions in collaboration docs, and added regression coverage. Final local total: 58 unit + 3 launcher unit + 1 launcher smoke + 25 browser tests (87); complete browser suite passed with concurrency 2. Publishing and remote CI remain the final gate.
