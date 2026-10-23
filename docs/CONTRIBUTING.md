# Contributing to ARACommit

Thanks for your interest in contributing to ARACommit, created by Funara as part of the ARA AI Ecosystem. This guide covers the local development workflow; the [project README](../README.md) links to user documentation and the [documentation index](README.md).

## Set up

```bash
git clone https://github.com/funara/aracommit.git
cd aracommit
npm ci
```

Create a focused branch for your change and keep generated output, credentials, and test data out of commits.

## Develop and verify

```bash
npm run compile
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

`npm run test:e2e` builds the extension and E2E suite, then launches the VS Code test runner. It uses disposable Git repositories and a local mock LLM; see [Testing](testing.md) before adding or debugging tests.

For manual extension-host testing, use a disposable repository and harmless changes. Cloud providers receive the staged diff and may incur charges. Keep Auto-commit and Auto-push off unless you are deliberately testing them in that disposable repository.

## Pull requests

- Keep changes focused and follow the existing TypeScript and ESLint conventions.
- Add tests for behavior changes and run the checks relevant to your change.
- Update user or contributor documentation when behavior changes.
- Explain the problem, the change, and the validation performed.

See the focused guides for [providers](adding-providers.md), [languages](adding-languages.md), [formats](adding-formats.md), and [testing](testing.md).
