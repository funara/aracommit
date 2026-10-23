# ARACommit

> **Created by Funara · Part of the ARA AI Ecosystem**
>
> Turn the changes you staged in Git into a clear, reviewable commit message—right inside VS Code.

ARACommit is a VS Code extension that asks an AI provider to describe your staged changes. You choose the provider, model, language, and commit style. ARACommit generates a message in the Source Control view; you review it and decide when to commit.

## What it does

- Analyzes **staged changes only**. Unstaged and untracked files are not included or staged for you.
- Supports Conventional and **Gitmoji Conventional** messages.
- Writes in ten bundled languages, including Indonesian, or a custom language you name.
- Connects to cloud providers, local Ollama, or a custom OpenAI-compatible endpoint.
- Keeps provider credentials in VS Code SecretStorage rather than project settings.
- Offers optional commit-message validation, custom instructions, and Smart Commit automation.

## Get started

1. Install ARACommit in VS Code.
2. Open a Git repository and stage the changes you want the message to describe.
3. In the extension sidebar, choose a provider and model. Add a credential if that provider requires one.
4. Focus the Source Control view and press <kbd>Ctrl</kbd>+<kbd>G</kbd> (<kbd>⌘</kbd>+<kbd>G</kbd> on macOS), click the extension's SCM action, or run **ARACommit: Generate Commit Message** from the Command Palette.
5. Review and edit the message, then commit when you're ready.

OpenRouter is the default provider. Its public model list can be loaded before a credential is added; generation still requires an OpenRouter key or sign-in. For setup help, see [Choose a provider](docs/walkthroughs/pick-provider.md) and [Provide credentials](docs/walkthroughs/set-api-key.md).

## Providers

The sidebar lists providers alphabetically. Cloud services require their own credentials; Ollama is local by default. Custom endpoints may be local or remote.

| Provider | What to expect |
|---|---|
| Anthropic | Claude models; API key required; model choices use a curated list. |
| Custom | Any compatible chat-completions endpoint; API key is optional. |
| DeepSeek | Cloud API; API key required. |
| Gemini | Google AI API; API key required; supports automatic model selection. |
| Ollama | Local by default; no credential unless the server requires authentication. |
| OpenAI | OpenAI API; API key required. |
| OpenRouter | A catalog of models behind one API; model list is available without a key, generation is not. |
| xAI | Grok API; API key required. |

See [provider setup and behavior](docs/providers.md) for details and [the configuration reference](docs/configuration.md) for all settings.

## Commit style and automation

- **Format:** Conventional (default) or Gitmoji Conventional.
- **Language:** English (default), Indonesian, Russian, Chinese, Japanese, Korean, German, French, Spanish, Portuguese, or a custom language.
- **Smart Commit:** optional validation and custom instructions, with Auto-commit and Auto-push available as separate opt-ins. Automation is off by default; Auto-push requires Auto-commit.

ARACommit commits the Git index only. Even with Auto-commit enabled, unstaged edits and untracked files remain outside the commit. See [commit formats](docs/commit-formats.md) and [configuration](docs/configuration.md).

## Privacy and cost

For cloud providers, ARACommit sends the staged diff to the selected service to generate a message. Review the provider's data handling terms and pricing, and do not send secrets or sensitive source code. A local Ollama instance keeps requests on that machine; a remote Ollama or Custom endpoint receives requests over the network. API credentials are stored in VS Code SecretStorage, not in `.aracommit/config.json`.

## Install from this repository

To build and install a local VSIX:

```bash
npm ci
npm run package
```

Then choose **Extensions: Install from VSIX...** in VS Code and select the generated `.vsix` file. The extension requires VS Code 1.93 or later and a local Git repository.

## Documentation

Start at the [documentation index](docs/README.md).

- [Providers](docs/providers.md) · [Configuration](docs/configuration.md) · [Commit formats](docs/commit-formats.md)
- [Custom languages](docs/custom-language.md) · [Troubleshooting](docs/troubleshooting.md)
- [Testing](docs/testing.md) · [Contributing](docs/CONTRIBUTING.md)
- Contributor guides: [add a provider](docs/adding-providers.md), [add a language](docs/adding-languages.md), or [add a format](docs/adding-formats.md)
- Getting started: [choose a provider](docs/walkthroughs/pick-provider.md), [provide credentials](docs/walkthroughs/set-api-key.md), [generate a message](docs/walkthroughs/generate.md)

## License

ARACommit is distributed under the [MIT License](LICENSE).
