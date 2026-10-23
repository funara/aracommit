# Configuration reference

Every VS Code setting uses the `aracommit.*` namespace. Use the sidebar's **Model & Authentication** and **Commit message** sections for provider, model, credential, and commit controls; use VS Code Settings or `.aracommit/config.json` for the full configuration surface.

## Settings priority and workspace trust

For a setting that has a project-level equivalent, the highest applicable value wins:

1. Project config: `.aracommit/config.json`
2. VS Code workspace settings
3. VS Code user settings

Per-folder `.vscode/settings.json` values are not read as ARACommit settings in a multi-root workspace. Project config is resolved from the active editor's workspace folder, falling back to the first folder.

Until a workspace is trusted, project config cannot choose the provider or certain endpoints/authentication options, enable Auto-commit or Auto-push, or select the commitlint engine/rules path. This prevents a repository's checked-in configuration from redirecting staged diffs or triggering commits before the user trusts it.

## Provider and model

Provider IDs are `anthropic`, `custom`, `deepseek`, `gemini`, `ollama`, `openai`, `openrouter`, and `xai`. The default is `openrouter`.

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.provider.type` | `"openrouter"` | Provider ID. |
| `aracommit.anthropic.model` | `"claude-sonnet-4-5-20250929"` | Anthropic model ID; the picker uses a curated list. |
| `aracommit.deepseek.model` | `"deepseek-chat"` | DeepSeek model ID. |
| `aracommit.gemini.model` | `"auto"` | Gemini model ID or `auto` to try available models. |
| `aracommit.openai.model` | `"gpt-3.5-turbo"` | OpenAI model ID. |
| `aracommit.openai.baseUrl` | `"https://api.openai.com/v1"` | OpenAI API base URL. Prefer Custom for a separate self-hosted OpenAI-compatible endpoint. |
| `aracommit.openrouter.model` | `"meta-llama/llama-3.3-70b-instruct:free"` | OpenRouter model ID. The public model list loads without a credential; generation does not. |
| `aracommit.openrouter.preferFreeModels` | `false` | Filter the model picker to free models. |
| `aracommit.xai.model` | `"grok-3-mini"` | xAI model ID. |

### Custom and Ollama endpoints

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.custom.baseUrl` | `"http://localhost:1234/v1"` | Base URL for an OpenAI-compatible chat-completions endpoint. |
| `aracommit.custom.chatCompletionsPath` | `"/chat/completions"` | Path appended to the Custom base URL. |
| `aracommit.custom.model` | `""` | Free-form model ID exposed by the Custom endpoint. |
| `aracommit.custom.useApiKey` | `false` | Whether to send the optional Custom API key. |
| `aracommit.ollama.baseUrl` | `"http://localhost:11434"` | Ollama server URL. |
| `aracommit.ollama.model` | `"llama3.2"` | Installed Ollama model. |
| `aracommit.ollama.useAuthToken` | `false` | Enable a stored bearer token for an authenticated Ollama server. |
| `aracommit.ollama.numCtx` | `0` | Ollama context window override; `0` leaves the model default unchanged. |

## Commit message

ARACommit always analyzes **staged changes only**. Unstaged and untracked files are not included or staged automatically.

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.commit.commitFormat` | `"conventional"` | `conventional` or `emojiKarma` (UI label: **Gitmoji Conventional**). |
| `aracommit.commit.commitLanguage` | `"english"` | `english`, `indonesian`, `russian`, `chinese`, `japanese`, `korean`, `german`, `french`, `spanish`, `portuguese`, or `custom`. |
| `aracommit.commit.customLanguageName` | `""` | Language name used when the language is `custom`; translated templates are cached in `.aracommit/translations.json`. |
| `aracommit.commit.useCustomInstructions` | `false` | Use the custom prompt instructions instead of the built-in format template. |
| `aracommit.commit.customInstructions` | `""` | Custom instructions; required when the toggle above is enabled. |
| `aracommit.commit.autoCommit` | `false` | Commit the staged changes after generation. |
| `aracommit.commit.autoPush` | `false` | Push after auto-commit; requires Auto-commit. |

Auto-commit and Auto-push are separate opt-ins and are disabled by default. Review the staged snapshot before enabling them.

## Smart Commit validation

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.commit.commitlint.enabled` | `false` | Validate the generated message and refine it when it fails the active format's rules. |
| `aracommit.commit.commitlint.maxRetries` | `3` | Maximum validation/refinement cycles; range `1`–`10`. |
| `aracommit.commit.commitlint.engine` | `"builtin"` | `builtin` uses ARACommit's validators; `project` uses the repository's commitlint CLI for Conventional messages when available, then falls back to `builtin`. |
| `aracommit.commit.commitlint.rulesPath` | `""` | Optional path to the project commitlint config. An empty path enables root-level discovery. Applies to Conventional commits. |

The built-in validator supports Conventional and Gitmoji Conventional. The `project` engine applies only to Conventional messages, runs project code, and is available only in a trusted workspace. The project engine falls back to the built-in validator if the local CLI is unavailable. Rules can be discovered from a root `package.json` commitlint field or `commitlint.config.{js,cjs,json,yml,yaml}`.

## Request and generation limits

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.general.maxDiffSize` | `100000` | Maximum diff characters sent to the model. Larger diffs are truncated. `-1` disables truncation; use only with a model that can accept the full diff. |
| `aracommit.general.maxOutputTokens` | `4096` | Maximum model output token budget. ARACommit may retry a truncated response with a larger budget, up to its internal cap. |
| `aracommit.general.temperature` | `0.7` | Sampling temperature; lower values tend to produce more consistent wording. Range `0`–`2`. |
| `aracommit.apiRequestTimeout` | `30` | Provider request timeout in seconds. `-1` disables the timeout. |
| `aracommit.gitTimeout` | `120` | Git subprocess timeout in seconds. `-1` disables the timeout. |

### Gemini thinking

| Setting | Default | Description |
| --- | ---: | --- |
| `aracommit.gemini.thinkingBudget` | `0` | Token budget for Gemini 2.5 thinking: `0` disables where supported, `-1` lets the model decide, positive values set a cap. Gemini 2.5 Pro enforces a minimum; the setting is ignored by Gemini 3.x and older models. |
| `aracommit.gemini.thinkingLevel` | `"low"` | Gemini 3.x thinking depth: `minimal`, `low`, `medium`, or `high`. Ignored by Gemini 2.5 and older models. |

## Project configuration

Create `.aracommit/config.json` with **ARACommit: Create Project Config (.aracommit)** from the Command Palette. Only settings that need overrides must be included. Example:

```json
{
  "provider": {
    "type": "ollama"
  },
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2"
  },
  "commit": {
    "commitLanguage": "indonesian",
    "commitFormat": "emojiKarma",
    "autoCommit": false,
    "autoPush": false
  }
}
```

The older single-file `.aracommit` configuration is still recognized and migrated to `.aracommit/config.json` on activation. API keys and auth tokens are never stored in project config; use VS Code SecretStorage instead. Project config is watched for changes. Invalid JSON is reported by ARACommit.

## Credentials

Set or remove a provider credential through the sidebar's **Model & Authentication** section or Command Palette. Exact current set-command titles are:

- `ARACommit: Set Anthropic API Key`
- `ARACommit: Set Custom API Key`
- `ARACommit: Set DeepSeek API Key`
- `ARACommit: Set Gemini API Key`
- `ARACommit: Set Ollama Auth Token` (optional)
- `ARACommit: Set OpenAI API Key`
- `ARACommit: Set OpenRouter API Key` (or **Sign in with OpenRouter**)
- `ARACommit: Set xAI API Key`

For endpoint setup and provider-specific requirements, see [AI providers](providers.md). For common failures, see [troubleshooting](troubleshooting.md).
