# AI providers

ARACommit can generate messages through eight providers. Choose one in the sidebar's **Model & Authentication** section; the model picker lists options where available. Provider and model choices are stored as settings, while credentials are stored separately in VS Code SecretStorage.

> **Data and cost:** Cloud providers and remote endpoints receive the staged diff for analysis and may charge for requests. Do not send secrets or sensitive source code. A local Ollama server keeps the request local; a remote Ollama server does not.

## At a glance

| Provider | Endpoint style | Credential | Model list |
|---|---|---|---|
| Anthropic | Anthropic Messages API | API key | ARACommit uses a curated model list |
| Custom | OpenAI-compatible chat completions | Optional | Enter the endpoint's model ID manually |
| DeepSeek | OpenAI-compatible API | API key | Live list |
| Gemini | Google Generative Language API | API key | Live list; `auto` is supported |
| Ollama | Native Ollama API | None by default | Local `/api/tags` list |
| OpenAI | OpenAI-compatible API | API key | Live list filtered to chat-capable model families |
| OpenRouter | OpenAI-compatible API | API key or sign-in for generation | Public list; can load without a key |
| xAI | OpenAI-compatible API | API key | Live list with a curated fallback |

The default provider is OpenRouter. The model picker is available without a key, but generation requires an OpenRouter credential. The **Prefer free models** filter is off by default.

## Set up a provider

### Anthropic

1. Get an API key from [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Select **Anthropic Claude** in the sidebar and choose **Set key**.
3. Select a model from the curated list. The default is `claude-sonnet-4-5-20250929`.

ARACommit uses a curated Anthropic model list. Model availability can change, so check the provider's current model documentation when choosing a different model ID.

### Custom (OpenAI-compatible)

Use this for a server that implements the OpenAI chat-completions request format. It can be local or remote.

1. Select **Custom (OpenAI-compatible)**.
2. Set **Base URL** and **Model** to values supported by your endpoint. The model ID is entered manually.
3. If the endpoint needs authentication, enable **Send API key** and use **Set key**.

The defaults target a local LM Studio-style endpoint: `http://localhost:1234/v1`, with `/chat/completions` appended. Common local alternatives include vLLM, llama.cpp servers, and LocalAI. Check your server's own documentation for its base URL, model ID, path, and authentication requirements.

### DeepSeek

1. Create a key in the [DeepSeek platform](https://platform.deepseek.com/api_keys).
2. Select **DeepSeek** and choose **Set key**.
3. Choose a model from the live list. The configured default is `deepseek-chat`.

### Gemini

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Select **Gemini** and choose **Set key**.
3. Keep the default model `auto` to let ARACommit discover available models and try them in order, or select a specific model.

### Ollama

1. Install and start [Ollama](https://ollama.com).
2. Pull a model, for example `ollama pull llama3.2`.
3. Select **Ollama** and refresh the model list. The default server URL is `http://localhost:11434`.

Ollama needs no credential by default. If your server requires a bearer token, enable `aracommit.ollama.useAuthToken` and set it with **ARACommit: Set Ollama Auth Token**. The exact command spelling reflects the current VS Code command title.

### OpenAI

1. Create a key in [OpenAI API keys](https://platform.openai.com/api-keys).
2. Select **OpenAI** and choose **Set key**.
3. Choose a model from the live list. The current configured default is `gpt-3.5-turbo`.

The default base URL is `https://api.openai.com/v1`. For self-hosted OpenAI-compatible services, prefer the **Custom** provider so its endpoint and optional authentication are configured explicitly.

### OpenRouter

1. Select **OpenRouter** in the sidebar.
2. Choose **Sign in with OpenRouter**, or create a key at [OpenRouter Keys](https://openrouter.ai/keys) and choose **Set key**.
3. Choose a model from the public list. The configured default is `meta-llama/llama-3.3-70b-instruct:free`.

The public model list can be fetched without credentials. A credential is still required to generate a message. `aracommit.openrouter.preferFreeModels` controls whether the picker filters to free models (default: `false`). Model availability, pricing, and free-tier terms can change; check OpenRouter for current details.

### xAI

1. Create an API key in the [xAI Console](https://console.x.ai/).
2. Select **xAI Grok** and choose **Set key**.
3. Choose a model from the live list or its curated fallback. The configured default is `grok-3-mini`.

## Choosing a provider

- Choose **Ollama** for local inference when the Ollama server is running on your machine.
- Choose **Custom** for a compatible local server or a separately managed endpoint.
- Choose a cloud provider when you prefer its hosted models and accept its data handling and billing terms.
- Use OpenRouter when you want to browse multiple model families through one service.

For settings, credential commands, and project-level overrides, see the [configuration reference](configuration.md). For provider or network errors, see [troubleshooting](troubleshooting.md).
