import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    mockGet,
    mockGetModelFor,
    mockGetOptionalKey,
    fetchGeminiModels,
    fetchOpenAIModels,
    fetchCustomModels,
    fetchOllamaModels,
    fetchOpenRouterModels,
    fetchAnthropicModels,
    fetchDeepSeekModels,
    fetchXaiModels,
} = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockGetModelFor: vi.fn(),
    mockGetOptionalKey: vi.fn(),
    fetchGeminiModels: vi.fn(),
    fetchOpenAIModels: vi.fn(),
    fetchCustomModels: vi.fn(),
    fetchOllamaModels: vi.fn(),
    fetchOpenRouterModels: vi.fn(),
    fetchAnthropicModels: vi.fn(),
    fetchDeepSeekModels: vi.fn(),
    fetchXaiModels: vi.fn(),
}));

vi.mock('../src/utils/configService', () => ({
    ConfigService: { get: mockGet, getModelFor: mockGetModelFor },
}));

vi.mock('../src/services/apiKeyManager', () => ({
    ApiKeyManager: { getOptionalKey: mockGetOptionalKey },
}));

vi.mock('../src/services/modelLists', () => ({
    fetchGeminiModels,
    fetchOpenAIModels,
    fetchCustomModels,
    fetchOllamaModels,
    fetchOpenRouterModels,
    fetchAnthropicModels,
    fetchDeepSeekModels,
    fetchXaiModels,
}));

import {
    PROVIDER_DEFS,
    PROVIDERS,
    NO_REFRESH_PROVIDERS,
    SECRET_KEYS,
    API_KEY_URLS,
    PROVIDER_LABELS,
    providerDef,
} from '../src/services/providerRegistry';

beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
    mockGetModelFor.mockReturnValue('Automatic · Free');
    mockGetOptionalKey.mockResolvedValue('a-key');
    fetchGeminiModels.mockResolvedValue(['g']);
    fetchOpenAIModels.mockResolvedValue(['o']);
    fetchCustomModels.mockResolvedValue(['c']);
    fetchOllamaModels.mockResolvedValue(['ol']);
    fetchOpenRouterModels.mockResolvedValue(['or']);
    fetchAnthropicModels.mockResolvedValue(['an']);
    fetchDeepSeekModels.mockResolvedValue(['ds']);
    fetchXaiModels.mockResolvedValue(['x']);
});

describe('providerRegistry derived exports', () => {
    it('PROVIDERS lists ids alphabetically by display label', () => {
        expect(PROVIDERS).toEqual([
            'anthropic', 'araAssistant', 'custom', 'deepseek', 'gemini',
            'ollama', 'openai', 'openrouter', 'xai',
        ]);
    });

    it('NO_REFRESH_PROVIDERS contains only providers flagged noRefresh', () => {
        expect([...NO_REFRESH_PROVIDERS]).toEqual(['anthropic', 'araAssistant']);
    });

    it('SECRET_KEYS lists every secret key', () => {
        expect(SECRET_KEYS).toContain('aracommit.apiKey');
        expect(SECRET_KEYS).not.toContain(undefined);
        expect(SECRET_KEYS).toHaveLength(PROVIDER_DEFS.filter(d => d.secretKey).length);
        expect(providerDef('araAssistant').secretKey).toBeUndefined();
    });

    it('API_KEY_URLS only includes providers with a console link', () => {
        expect(API_KEY_URLS.gemini).toBe('https://aistudio.google.com/app/apikey');
        // ollama and custom have no apiKeyUrl
        expect(API_KEY_URLS.ollama).toBeUndefined();
        expect(API_KEY_URLS.custom).toBeUndefined();
    });

    it('PROVIDER_LABELS maps id to label', () => {
        expect(PROVIDER_LABELS.gemini).toBe('Gemini');
        expect(PROVIDER_LABELS.custom).toBe('Custom (OpenAI-compatible)');
    });

});

describe('providerDef()', () => {
    it('returns the def for a known id', () => {
        expect(providerDef('gemini').id).toBe('gemini');
    });

    it('throws for an unknown id', () => {
        expect(() => providerDef('nope' as never)).toThrow(/Unknown provider: nope/);
    });
});

describe('selectedModel() reads config per provider', () => {
    it.each([
        ['gemini', 'gemini.model'],
        ['openrouter', 'openrouter.model'],
        ['anthropic', 'anthropic.model'],
        ['openai', 'openai.model'],
        ['deepseek', 'deepseek.model'],
        ['xai', 'xai.model'],
        ['ollama', 'ollama.model'],
        ['custom', 'custom.model'],
    ])('%s reads %s', (id, key) => {
        mockGet.mockImplementation((k: string) => (k === key ? 'the-model' : undefined));
        expect(providerDef(id as never).selectedModel()).toBe('the-model');
        expect(mockGet).toHaveBeenCalledWith(key);
    });
});

describe('fetchModels() success paths', () => {
    it('ARA Assistant uses the generic route label and needs no model-list request', async () => {
        expect(providerDef('araAssistant').selectedModel()).toBe('Automatic · Free');
        expect(mockGetModelFor).toHaveBeenCalledWith('araAssistant');
        expect(await providerDef('araAssistant').fetchModels()).toEqual([]);
        expect(mockGetOptionalKey).not.toHaveBeenCalled();
    });

    it('gemini passes the resolved key', async () => {
        expect(await providerDef('gemini').fetchModels()).toEqual(['g']);
        expect(fetchGeminiModels).toHaveBeenCalledWith('a-key');
    });

    it('openrouter passes an optional key and preferFreeModels', async () => {
        mockGet.mockImplementation((k: string) => (k === 'openrouter.preferFreeModels' ? true : undefined));
        expect(await providerDef('openrouter').fetchModels()).toEqual(['or']);
        expect(fetchOpenRouterModels).toHaveBeenCalledWith('a-key', true);
    });

    it('openrouter model listing works without a key', async () => {
        mockGetOptionalKey.mockResolvedValue(undefined);
        expect(await providerDef('openrouter').fetchModels()).toEqual(['or']);
        expect(fetchOpenRouterModels).toHaveBeenCalledWith(undefined, undefined);
    });

    it('anthropic passes the key', async () => {
        expect(await providerDef('anthropic').fetchModels()).toEqual(['an']);
        expect(fetchAnthropicModels).toHaveBeenCalledWith('a-key');
    });

    it('openai passes key and baseUrl', async () => {
        mockGet.mockImplementation((k: string) => (k === 'openai.baseUrl' ? 'https://x' : undefined));
        expect(await providerDef('openai').fetchModels()).toEqual(['o']);
        expect(fetchOpenAIModels).toHaveBeenCalledWith('a-key', 'https://x');
    });

    it('deepseek passes the key', async () => {
        expect(await providerDef('deepseek').fetchModels()).toEqual(['ds']);
        expect(fetchDeepSeekModels).toHaveBeenCalledWith('a-key');
    });

    it('xai passes the key', async () => {
        expect(await providerDef('xai').fetchModels()).toEqual(['x']);
        expect(fetchXaiModels).toHaveBeenCalledWith('a-key');
    });

    it('ollama with auth token enabled passes baseUrl + token', async () => {
        mockGet.mockImplementation((k: string) => {
            if (k === 'ollama.useAuthToken') return true;
            if (k === 'ollama.baseUrl') return 'http://localhost:11434';
            return undefined;
        });
        mockGetOptionalKey.mockResolvedValue('tok');
        expect(await providerDef('ollama').fetchModels()).toEqual(['ol']);
        expect(fetchOllamaModels).toHaveBeenCalledWith('http://localhost:11434', 'tok');
    });

    it('ollama without auth token passes undefined token and does not require a key', async () => {
        mockGet.mockImplementation((k: string) => {
            if (k === 'ollama.useAuthToken') return false;
            if (k === 'ollama.baseUrl') return 'http://localhost:11434';
            return undefined;
        });
        expect(await providerDef('ollama').fetchModels()).toEqual(['ol']);
        expect(fetchOllamaModels).toHaveBeenCalledWith('http://localhost:11434', undefined);
        expect(mockGetOptionalKey).not.toHaveBeenCalled();
    });

    it('custom fetches models without auth when the toggle is off', async () => {
        mockGet.mockImplementation((k: string) => (k === 'custom.baseUrl' ? 'http://localhost:1234/v1' : undefined));
        expect(await providerDef('custom').fetchModels()).toEqual(['c']);
        expect(fetchCustomModels).toHaveBeenCalledWith('http://localhost:1234/v1', undefined);
        expect(mockGetOptionalKey).not.toHaveBeenCalled();
    });

    it('custom fetches models with the saved key when auth is enabled', async () => {
        mockGet.mockImplementation((k: string) => {
            if (k === 'custom.baseUrl') return 'https://models.example/v1';
            if (k === 'custom.useApiKey') return true;
            return undefined;
        });
        expect(await providerDef('custom').fetchModels()).toEqual(['c']);
        expect(mockGetOptionalKey).toHaveBeenCalledWith('custom');
        expect(fetchCustomModels).toHaveBeenCalledWith('https://models.example/v1', 'a-key');
    });
});

describe('fetchModels() missing-key throws (requireKey)', () => {
    it.each([
        ['gemini', 'Gemini'],
        ['anthropic', 'Anthropic'],
        ['openai', 'OpenAI'],
        ['deepseek', 'DeepSeek'],
        ['xai', 'xAI'],
    ])('%s throws when key is missing', async (id, label) => {
        mockGetOptionalKey.mockResolvedValue(undefined);
        await expect(providerDef(id as never).fetchModels()).rejects.toThrow(
            `${label} API key is not set`,
        );
    });
});
