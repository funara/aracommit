# Custom languages

ARACommit includes ten bundled languages. Choose **custom** when you want a different language: ARACommit asks the configured provider to translate the selected commit-format template once, then caches that translation in the project.

## Set up

In VS Code Settings or the sidebar's **Commit message** section, set **Commit Language** to `custom` and enter a **Custom Language Name**, such as `Italian`, `Arabic`, or `Thai`.

The equivalent project setting is:

```json
{
  "commit": {
    "commitLanguage": "custom",
    "customLanguageName": "Italian"
  }
}
```

## Translation cache

The first time ARACommit needs the selected language and format, it checks `.aracommit/translations.json`. If the entry is missing, it requests a translation from the configured provider and saves it. Later generations reuse the cached text until that entry is removed.

The cache is keyed by the exact language name and format ID:

```json
{
  "Italian": {
    "conventional": "<translated template>",
    "emojiKarma": "<translated template>"
  }
}
```

The supported format IDs are `conventional` and `emojiKarma` (shown in the UI as **Conventional** and **Gitmoji Conventional**). Language names are case-sensitive in the cache: `Italian` and `italian` create separate entries.

You can commit `.aracommit/translations.json` to share the generated template with your team. Avoid editing the surrounding JSON structure; remove the specific language/format entry to request a fresh translation.

## Project directory

The cache is stored under `.aracommit/`. If an older project uses `.aracommit` as a single JSON file, ARACommit migrates that configuration into `.aracommit/config.json` when the extension starts, preserving the existing configuration.

## Notes

- A blank **Custom Language Name** falls back to English.
- Technical format tokens such as `feat`, `fix`, and `type(scope): description` remain in English so the output stays recognizable to Git tooling.
- Translation quality depends on the selected model. If a translation is poor, delete its cache entry and try again.
- The translation request uses the configured provider and may incur charges. The later commit-message request sends the staged diff as usual; see the [provider setup and privacy notes](providers.md).

## Troubleshooting

If translation fails, check the provider credential and endpoint in [troubleshooting](troubleshooting.md). If the wrong language is used, verify the exact language name and remove the matching entry from `.aracommit/translations.json`.
