# Troubleshooting

## No staged changes

ARACommit reads the Git index only. Stage the changes you want described and check them with:

```bash
git status
git diff --cached
```

Unstaged and untracked files are intentionally excluded, even when Auto-commit is enabled. Confirm that VS Code has opened the repository containing the `.git` directory.

## Message generation fails

Open **View → Output** and select the `ARACommit` output channel for the underlying error. Check that:

- The selected provider and model are correct.
- The provider is reachable from your machine.
- A valid credential is stored when the provider requires one.
- The staged diff fits the provider's context and request limits.

Cloud requests may incur charges. ARACommit sends the staged diff to the selected cloud provider or remote endpoint; do not use sensitive content for troubleshooting.

## Authentication and rate limits

### 401 Unauthorized

The credential is missing, invalid, or revoked. In the sidebar, use **Set key** for the selected provider, or run that provider's exact **ARACommit: Set …** command from the Command Palette. For Ollama, the command is **ARACommit: Set Ollama Auth Token**. Credentials are held in VS Code SecretStorage.

### 429 Too Many Requests

The provider is rate-limiting requests. Wait and retry, or select another model/provider. Usage limits and retry policies are provider-specific; check the provider's console for current information.

### OpenRouter model list or generation

The public model list can load without a key. Message generation still requires an OpenRouter API key or sign-in. If generation fails, check the credential and selected model in the OpenRouter account.

## Network and endpoint errors

### Request timeout

`aracommit.apiRequestTimeout` defaults to 30 seconds. Increase it for a slower endpoint, or set it to `-1` to disable the timeout. Disabling a timeout can leave a request waiting indefinitely.

### Connection refused

For Ollama, ensure the server is running and that `aracommit.ollama.baseUrl` points to the reachable instance. The default is `http://localhost:11434`. A remote Ollama instance may require `aracommit.ollama.useAuthToken` and a stored token.

For **Custom**, verify the endpoint's base URL, model ID, chat-completions path, and authentication settings. A Custom endpoint must implement the OpenAI-compatible chat-completions request format. Consult the endpoint's own documentation rather than assuming another provider's URL or path.

### Model not found

The configured model ID must match one exposed by the selected endpoint. Refresh the model list when supported, or re-enter the model ID for Custom and other providers without a live list.

### Gemini reports an unavailable model

Use `auto` to let ARACommit fetch the models available to the account and try them in order, or select a model shown in the live list.

## Project configuration is not applied

- The current project file is `.aracommit/config.json`, under the repository's `.aracommit` directory.
- Check the JSON syntax and verify that the key uses the documented setting shape.
- Project config has higher priority than workspace and user settings; API credentials are never read from this file.
- In an untrusted workspace, project configuration cannot choose the provider or endpoint, enable Auto-commit/Auto-push, or select the commitlint engine and rules path. Trust the workspace only if you trust its contents.

See the [configuration reference](configuration.md) for precedence and supported project settings.

## ARACommit is missing or a command does nothing

- Confirm that the extension is installed and enabled, then reload the VS Code window.
- The `Ctrl+G` / `⌘+G` shortcut is active when the Source Control view is focused. Alternatively, run **ARACommit: Generate Commit Message** from the Command Palette.
- If the SCM action is missing, open a local Git repository and check that VS Code's built-in Git extension is enabled.
- If behavior changed after an update, verify the selected settings and provider model first; consult the [project repository](https://github.com/funara/aracommit) for current project information.
