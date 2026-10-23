# Add a language to ARACommit

Bundled languages are `english`, `indonesian`, `russian`, `chinese`, `japanese`, `korean`, `german`, `french`, `spanish`, and `portuguese`. The `custom` value is a runtime translation feature, not a bundled template language; see [Custom languages](custom-language.md).

For a bundled language, update the language list, both format templates, the language instruction, and the VS Code setting enum. The examples below use Italian.

## 1. Register the language

Add the lowercase ID to `SUPPORTED_LANGUAGES` in `src/utils/constants.ts`:

```typescript
export const SUPPORTED_LANGUAGES = [
  'english', 'indonesian', 'russian', 'chinese', 'japanese',
  'korean', 'german', 'french', 'spanish', 'portuguese', 'italian', 'custom',
] as const;
```

`CommitLanguage` is derived from this list. The template type in `src/templates/index.ts` excludes `custom`, so TypeScript will require a translation for every bundled language in each format.

## 2. Translate each format template

Add an `italian` entry to both:

- `src/templates/formats/conventional.ts`
- `src/templates/formats/emojiKarma.ts`

Preserve each template's rules and sections. Keep format tokens such as `feat`, `fix`, and the required header shape intact so translations remain valid commit messages.

## 3. Add the language instruction

Add an Italian entry to `LANGUAGE_PROMPTS` in `src/services/promptService.ts`. Its type is `Record<Exclude<CommitLanguage, 'custom'>, string>`; do not add `custom` here.

## 4. Update the settings contribution

Add `italian` and its display description to `aracommit.commit.commitLanguage` in `package.json`. Keep the enum order and descriptions aligned with `src/utils/constants.ts`.

## 5. Verify and document

- Add/update tests covering template lookup and prompt language selection.
- Update the language list in `docs/configuration.md` and the bundled-language count in `../README.md`; update any other guide that enumerates the languages.
- Run `npm run typecheck`, `npm run test:unit`, and `npm run compile`.
- In VS Code Settings, confirm the language is selectable in ARACommit; if practical, generate a message from a harmless staged diff and review the language and format.
