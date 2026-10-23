# Commit formats

ARACommit offers two formats. Choose the format in the sidebar's **Commit message** section or set `aracommit.commit.commitFormat` in VS Code settings.

## Conventional

A Conventional Commits header with an optional scope, followed by an optional body:

```text
type(scope): description

- optional detail
```

Example:

```text
feat(auth): add OAuth2 login

- Add Google and GitHub providers
- Store tokens securely
```

Common types include `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, and `chore`.

## Gitmoji Conventional

The setting value is `emojiKarma`; the UI label is **Gitmoji Conventional**. It combines an emoji prefix with a Conventional-style type and optional scope:

```text
✨ feat(auth): add OAuth2 login
```

Examples of prefixes include `✨` for features, `🐛` for fixes, `📝` for documentation, `♻️` for refactoring, and `🧪` for tests.

## Validation

The built-in validator supports both formats. When the project commitlint CLI is selected, it applies to Conventional messages; Gitmoji Conventional uses ARACommit's built-in validator. See [configuration](configuration.md#smart-commit-validation) for the validator options.
