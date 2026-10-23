import { ApiKeyValidator } from '../utils/apiKeyValidator';
import { Provider } from '../views/webview/protocol';

/**
 * The single source of truth for static, per-provider facts. This is a *leaf*
 * module — it imports only the `Provider` type and the pure `ApiKeyValidator`,
 * never `ConfigService` or `ApiKeyManager`. That keeps it free of import
 * cycles so every other layer (providerRegistry, apiKeyManager, the
 * set/remove-key commands, configService) can derive from it instead of
 * re-declaring the same facts in parallel tables that silently drift.
 *
 * Runtime behavior that needs config/secrets (current model, live model fetch)
 * lives in `providerRegistry.ts`, which composes these metadata entries with
 * the closures it can only build at that layer.
 */
export interface ProviderMeta {
    id: Provider;
    /** Display name shown in the model picker (e.g. "Anthropic Claude"). */
    label: string;
    /**
     * Name used in API-key prompts ("Enter your {displayName} API Key").
     * Intentionally distinct from `label` — e.g. Gemini's key is a "Google"
     * key, and the picker says "xAI Grok" while the prompt says "xAI".
     */
    displayName: string;
    /** SecretStorage key holding this provider's API key / auth token. */
    secretKey: string;
    /** Command id that prompts for + stores this provider's key. */
    setCmd: string;
    /** Command id that clears this provider's key. */
    removeCmd: string;
    /** "Get a key" deep link; omitted for providers with no hosted console. */
    apiKeyUrl?: string;
    /** True when there is no live `/models` endpoint (UI hides refresh). */
    noRefresh?: boolean;
    /** Validates a pasted key; returns an error string or null when valid. */
    validateKey: (key: string) => string | null;
}

const lax = ApiKeyValidator.validateNonEmpty;

export const PROVIDER_CATALOG: readonly ProviderMeta[] = ([
    {
        id: 'gemini',
        label: 'Gemini',
        displayName: 'Google',
        secretKey: 'aracommit.apiKey',
        setCmd: 'aracommit.setApiKey',
        removeCmd: 'aracommit.removeApiKey',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        validateKey: ApiKeyValidator.validateGeminiApiKey,
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        displayName: 'OpenRouter',
        secretKey: 'aracommit.openrouterApiKey',
        setCmd: 'aracommit.setOpenRouterApiKey',
        removeCmd: 'aracommit.removeOpenRouterApiKey',
        apiKeyUrl: 'https://openrouter.ai/keys',
        validateKey: lax,
    },
    {
        id: 'anthropic',
        label: 'Anthropic Claude',
        displayName: 'Anthropic',
        secretKey: 'aracommit.anthropicApiKey',
        setCmd: 'aracommit.setAnthropicApiKey',
        removeCmd: 'aracommit.removeAnthropicApiKey',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        noRefresh: true,
        validateKey: lax,
    },
    {
        id: 'openai',
        label: 'OpenAI',
        displayName: 'OpenAI',
        secretKey: 'aracommit.openaiApiKey',
        setCmd: 'aracommit.setOpenAIApiKey',
        removeCmd: 'aracommit.removeOpenAIApiKey',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        validateKey: lax,
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        displayName: 'DeepSeek',
        secretKey: 'aracommit.deepseekApiKey',
        setCmd: 'aracommit.setDeepSeekApiKey',
        removeCmd: 'aracommit.removeDeepSeekApiKey',
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        validateKey: lax,
    },
    {
        id: 'xai',
        label: 'xAI Grok',
        displayName: 'xAI',
        secretKey: 'aracommit.xaiApiKey',
        setCmd: 'aracommit.setXaiApiKey',
        removeCmd: 'aracommit.removeXaiApiKey',
        apiKeyUrl: 'https://console.x.ai/',
        validateKey: lax,
    },
    {
        id: 'ollama',
        label: 'Ollama',
        displayName: 'Ollama',
        secretKey: 'aracommit.ollamaAuthToken',
        setCmd: 'aracommit.setOllamaAuthToken',
        removeCmd: 'aracommit.removeOllamaAuthToken',
        // no hosted console — local
        validateKey: lax,
    },
    {
        id: 'custom',
        label: 'Custom (OpenAI-compatible)',
        displayName: 'Custom',
        secretKey: 'aracommit.customApiKey',
        setCmd: 'aracommit.setCustomApiKey',
        removeCmd: 'aracommit.removeCustomApiKey',
        // no hosted console
        validateKey: lax,
    },
] satisfies ProviderMeta[]).sort((a, b) => a.label.localeCompare(b.label));

/** Provider ids in alphabetical display order. */
export const PROVIDERS: readonly Provider[] = PROVIDER_CATALOG.map(d => d.id);

const META_BY_ID = new Map<Provider, ProviderMeta>(
    PROVIDER_CATALOG.map(d => [d.id, d]),
);

/** Look up a provider's metadata, throwing for an unknown id. */
export function providerMeta(id: Provider): ProviderMeta {
    const meta = META_BY_ID.get(id);
    if (!meta) {
        throw new Error(`Unknown provider: ${id}`);
    }
    return meta;
}

/** Type guard: is `value` a known provider id? */
export function isProvider(value: string): value is Provider {
    return META_BY_ID.has(value as Provider);
}
