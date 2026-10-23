# Testing ARACommit

ARACommit has a fast unit-test suite and an end-to-end suite that launches the extension in VS Code. The end-to-end suite uses temporary repositories and a local mock LLM; it does not verify real credentials, live provider generation, or visual responsiveness.

## Run the checks

```bash
npm ci
npm run test:unit     # Vitest unit tests
npm run test:e2e      # VS Code extension-host tests
npm test               # both suites
npm run lint
npm run typecheck
npm run compile
```

`npm run test:e2e` runs the E2E TypeScript build and extension compile through its `pretest:e2e` hook, then starts the VS Code test runner. The first run may download VS Code Stable. The runner configuration is in `.vscode-test.mjs`.

## Unit tests

Unit tests use Vitest and the VS Code API mock at `tests/__mocks__/vscode.ts`. They cover pure logic and service behavior without launching the VS Code extension host. Use them for settings, prompts, validators, provider payloads, and other isolated code.

```bash
npm run test:unit
npm run test:unit:watch
```

## End-to-end tests

The E2E suite runs under `@vscode/test-cli` with the real VS Code Git extension. It opens the workspace defined in `tests/e2e/sample.code-workspace`, creates disposable Git repositories, and points provider requests at a local mock server. Tests cover activation, staged-only message generation, partially staged changes, multi-repository selection, auto-commit/push, provider errors, and cancellation.

The mock server and temporary-repository helpers live in `tests/e2e/helpers/`; test cases live in `tests/e2e/suite/`. Tests do not send diffs to a live cloud provider.

To keep temporary repositories after a failing run for inspection:

```bash
ARACOMMIT_E2E_KEEP=1 npm run test:e2e
```

For VS Code CLI options supported by the current test runner, pass them after `--`, for example:

```bash
npm run test:e2e -- --grep "auto-commit"
```

## Manual Extension Development Host test

For manual UI or live-provider testing:

1. Install dependencies with `npm ci`.
2. Start the development build with `npm run watch`.
3. Launch an Extension Development Host from VS Code's **Run and Debug** view. This checkout does not include a shared `.vscode/launch.json`; if needed, create a local launch configuration with `type: "extensionHost"`, `request: "launch"`, and `args: ["--extensionDevelopmentPath=${workspaceFolder}"]`.
4. In the host, open a disposable Git repository and stage a harmless change.
5. Keep Auto-commit and Auto-push disabled while checking provider switching, keyboard behavior, commit formats, and languages.

Live-provider tests send the staged diff to the selected service and may incur charges. Use non-sensitive content and opt into automation only in the disposable repository. Unit and E2E results do not replace this manual check.
