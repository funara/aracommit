# Add an AI provider to ARACommit

Current provider IDs: `anthropic`, `custom`, `deepseek`, `gemini`, `ollama`, `openai`, `openrouter`, and `xai`.

Before implementing a provider, decide which request protocol it uses:

- For an OpenAI-compatible `/chat/completions` endpoint, add its endpoint details to the shared dispatcher.
- For a different protocol, add a dedicated service and route it through the factory.

Do not add another wrapper service for a provider that uses the shared OpenAI-compatible dispatcher.

## Provider catalog and settings

`src/services/providerCatalog.ts` is the source of static provider facts. Add a `ProviderMeta` entry containing the provider ID, picker label, credential display name and SecretStorage key, set/remove command IDs, optional key-console URL, model-list description, and key validator. The catalog drives provider ordering, credential registration, and shared metadata.

Add the ID to the `Provider` union in `src/views/webview/protocol.ts`. Add the setting defaults to `SETTING_DEFAULTS` in `src/utils/configService.ts`, and contribute the setting definitions and provider enum in `package.json`. Use `package.nls.json` for any new localized package command titles.

## Model picker behavior

`src/services/providerRegistry.ts` composes catalog metadata with each provider's selected model and model-list function. Add the runtime behavior there. Implement a fetcher in `src/services/modelLists.ts` when the provider has a model-list endpoint. If it has no list, mark it `noRefresh` and return an empty list so users can enter a model ID manually. Model-list requests and errors should follow the existing fetcher conventions.

The settings webview consumes the registry. Keep its model-selection and refresh behavior aligned with the provider's capabilities.

## Generation dispatch

### OpenAI-compatible provider

Add a row to `COMPAT_SPECS` in `src/services/openAICompatibleService.ts` with the base URL and any provider-specific headers, path, or key behavior. The shared `generateViaOpenAICompatibleProvider` derives the model and provider label from shared configuration/catalog data.

### Provider with a different protocol

Implement the generation service using the conventions in the existing services (for example, Gemini, Anthropic, or Ollama). Register it in `NON_COMPAT_SERVICES` in `src/services/aiServiceFactory.ts`. `supportsProvider()` must resolve the new provider through either this map or the compatible-protocol dispatcher.

## Credentials and package contributions

`src/commands/setApiKeys.ts` registers set/remove commands from `PROVIDER_CATALOG`; the runtime command handling is catalog-driven. Also declare the user-facing commands and titles in `package.json` and `package.nls.json` so they appear in VS Code's Command Palette. Store credentials with `ApiKeyManager`/VS Code SecretStorage, never in project settings.

Add provider-specific settings, default values, descriptions, and enum entries to `package.json`. Keep documentation and the sidebar labels consistent with the actual provider behavior. Do not expose a credential field for a provider that does not need one.

## Tests and verification

Add or update tests for:

- Provider-catalog completeness and generation dispatch (`tests/providerDispatchCompleteness.test.ts`).
- Model-list parsing, filtering, error handling, and no-refresh behavior.
- Request payload, endpoint, headers, authentication, and provider-specific errors.
- Settings model selection and credential commands, where relevant.

Run `npm run typecheck`, relevant unit tests, `npm run lint`, and `npm run compile`. Add or update the project README (`../README.md`), provider guide (`providers.md`), and configuration reference (`configuration.md`). Live credentials and provider generation require a separate manual test; use harmless staged changes and consider provider costs.
