# Add a commit format to ARACommit

ARACommit supports `conventional` and `emojiKarma` (displayed as **Gitmoji Conventional**). A new format must be wired through generation, the settings UI, validation, and tests.

## Implementation checklist

1. Add a template under `src/templates/formats/` with entries for each bundled language in `src/utils/constants.ts` (currently English, Indonesian, Russian, Chinese, Japanese, Korean, German, French, Spanish, and Portuguese). `custom` is translated at runtime and is not a static template entry.
2. Register the format ID and template in `src/templates/index.ts`.
3. Update format selection/normalization in `src/services/promptService.ts`, `src/services/aiService.ts`, and `src/views/settingsWebviewProvider.ts` so the UI, prompt generation, and runtime fallback agree.
4. Add the ID and localized label to the format list in `src/views/settingsWebviewProvider.ts` and `src/views/webviewL10n.ts`; update the `aracommit.commit.commitFormat` contribution in `package.json`.
5. Add built-in validation rules in `src/services/formatRules.ts`. If the format supports commitlint, update the compatibility policy in `src/views/webview/commitFormatPolicy.ts` consistently.
6. Add tests for template lookup, format normalization, and validation. Update [Commit formats](commit-formats.md) and the [project README](../README.md).

## Verify

Run `npm run typecheck`, the relevant unit tests, and `npm run compile`. Check the new format in the sidebar and validate a generated message from harmless staged changes. If commitlint is enabled, test both the built-in validator and the configured project engine where applicable.
