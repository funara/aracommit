# Provide credentials

Credentials are stored in VS Code `SecretStorage`, not in plain-text settings. In the sidebar's **Model & Authentication** section, use **Set key** or **Sign in with OpenRouter**.

Command Palette alternatives (the command titles keep their current VS Code spelling):

- `ARACommit: Set Anthropic API Key`
- `ARACommit: Set Custom API Key`
- `ARACommit: Set DeepSeek API Key`
- `ARACommit: Set Gemini API Key`
- `ARACommit: Set OpenAI API Key`
- `ARACommit: Set OpenRouter API Key`
- `ARACommit: Set xAI API Key`
- `ARACommit: Set Ollama Auth Token` — only if the Ollama server requires authentication

Ollama does not need a credential by default. OpenRouter's public model list loads without one, but generation requires an API key or sign-in. Cloud provider requests include the staged diff; review the provider's data handling and pricing before use.
