# Choose an AI provider

ARACommit defaults to OpenRouter. Select a provider in the sidebar's **Model & Authentication** section, then choose a model where a list is available.

- **Anthropic** — Claude models; key required; curated model list.
- **Custom** — any OpenAI-compatible endpoint; key optional.
- **DeepSeek** — hosted API; key required.
- **Gemini** — Google API; key required; supports `auto` model selection.
- **Ollama** — local by default; no key unless the server requires authentication.
- **OpenAI** — hosted API; key required.
- **OpenRouter** — broad hosted model catalog; its public model list loads without a key, but generation requires a key or sign-in.
- **xAI** — Grok API; key required.

Cloud providers and remote endpoints receive the staged diff and may charge for usage. Choose a local Ollama server if you need local inference. See [provider setup](../providers.md) for current configuration details.
