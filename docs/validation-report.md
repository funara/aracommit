# ARACommit validation snapshot

This report records checks for the documented change set; it is not a guarantee about later changes or a release certification.

- **Unit tests:** `npm run test:unit` — 944 tests passed across 55 files.
- **E2E:** `npm run test:e2e` — 15 passed. The E2E suite uses disposable repositories and a local mock LLM. An earlier run had one failure in the unstaged-deletion case; after strengthening its preconditions and explicitly targeting its repository, two full reruns passed. This confirms the updated test setup passes, but does not establish the cause of the earlier failure.
- **Static checks/build:** `npm run lint`, `npm run typecheck`, and `npm run compile` passed. The LSP sweep reported zero errors; auxiliary style/security analyzer warnings remain. The reported prototype-pollution path in `src/utils/configService.ts` rejects `__proto__`, `constructor`, and `prototype` for each path segment, including the leaf.
- **Not verified:** no manual Extension Development Host visual test, real credentials, live-provider generation, or responsive UI review was performed. Those remain for manual testing in a disposable repository; keep Auto-commit and Auto-push off initially.

## Documentation-only refresh

- Reviewed all 16 Markdown files; relative links and local heading anchors were checked.
- Parsed `package.json` and compared the documented setting keys and defaults with `SETTING_DEFAULTS` and the contributed VS Code settings.
- LSP diagnostics found no issues across the supported documentation/manifest files. `.gitignore` has no configured LSP server; ignore behavior was checked directly.
- Unit/E2E tests, lint, typecheck, compile, live-provider calls, and manual UI checks were not rerun for this documentation-only refresh. The historical results above refer to the earlier change set.

## Layout, branding, and ignore update

- Grouped by purpose: `src/`, `tests/`, and `docs/` remain their functional parents; walkthroughs and `CONTRIBUTING.md` now live under `docs/`; icons and localization now live under `assets/`.
- Updated VS Code manifest references for walkthroughs, icons, and localization. A package-resource regression test checks all manifest resource paths.
- Normalized displayed branding to **ARACommit** and removed stale product-specific attributes and dead build/coverage references. Stable `aracommit.*` IDs and config paths remain unchanged.
- Updated `.gitignore` for generated translation cache and TypeScript build info while keeping `.aracommit/config.json` shareable.
- **Validation:** 945 unit tests passed; all 15 E2E tests passed; lint, typecheck, compile, and `npm run package` passed. The VSIX contains 17 files, including all relocated icons/localization and all three walkthroughs. Relative Markdown links in 16 files resolve, and ignore checks confirmed generated files are ignored while project config remains shareable.
- **Not verified:** no manual UI test or live-provider request was performed; these require a disposable workspace and real credentials.
