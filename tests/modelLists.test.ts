import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedGetJson } = vi.hoisted(() => ({ mockedGetJson: vi.fn() }));

vi.mock('../src/utils/httpUtils', async () => {
    const actual = await vi.importActual<typeof import('../src/utils/httpUtils')>(
        '../src/utils/httpUtils'
    );
    return {
        ...actual,
        HttpUtils: {
            stripTrailingSlashes: actual.HttpUtils.stripTrailingSlashes,
            getJson: mockedGetJson,
        },
    };
});

vi.mock('../src/services/geminiService', () => ({
    GeminiService: {},
}));

import {
    fetchCustomModels,
    fetchOpenAIModels,
    fetchOllamaModels,
    fetchOpenRouterModels,
    fetchXaiModels,
    fetchAnthropicModels,
} from '../src/services/modelLists';

describe('fetchCustomModels', () => {
    beforeEach(() => mockedGetJson.mockReset());

    it('fetches every OpenAI-compatible model id from the base URL, with optional bearer auth', async () => {
        mockedGetJson.mockResolvedValue({
            data: [
                { id: 'vendor/model' }, { id: 'gpt-4o' }, { id: 'vendor/model' },
                { id: 42 }, null, {},
            ],
        });

        const result = await fetchCustomModels('https://models.example/v1///', 'secret');

        expect(mockedGetJson).toHaveBeenCalledWith(
            'https://models.example/v1/models',
            { headers: { Authorization: 'Bearer secret' }, signal: undefined },
        );
        expect(result).toEqual(['gpt-4o', 'vendor/model']);
    });

    it('omits auth when the custom endpoint does not use an API key', async () => {
        mockedGetJson.mockResolvedValue({ data: [{ id: 'model-a' }, { id: null }] });

        await fetchCustomModels('http://localhost:1234/v1');

        expect(mockedGetJson).toHaveBeenCalledWith(
            'http://localhost:1234/v1/models',
            { headers: {}, signal: undefined },
        );
    });
});

describe('modelLists trailing-slash handling', () => {
    beforeEach(() => mockedGetJson.mockReset());

    it('strips trailing slashes from the OpenAI base URL before requesting', async () => {
        mockedGetJson.mockResolvedValue({ data: [{ id: 'gpt-4o' }] });
        await fetchOpenAIModels('key', 'https://api.openai.test///');
        expect(mockedGetJson).toHaveBeenCalledWith(
            'https://api.openai.test/models',
            expect.anything(),
        );
    });

    it('strips trailing slashes from the Ollama base URL before requesting', async () => {
        mockedGetJson.mockResolvedValue({ models: [{ name: 'llama3' }] });
        const result = await fetchOllamaModels('http://localhost:11434/');
        expect(mockedGetJson).toHaveBeenCalledWith(
            'http://localhost:11434/api/tags',
            expect.anything(),
        );
        expect(result).toEqual(['llama3']);
    });

    it('loads OpenRouter free models without requiring an API key', async () => {
        mockedGetJson.mockResolvedValue({
            data: [
                { id: 'vendor/free:free' },
                { id: 'vendor/paid', pricing: { prompt: '0.01', completion: '0.02' } },
            ],
        });
        const result = await fetchOpenRouterModels(undefined, true);
        expect(mockedGetJson).toHaveBeenCalledWith(
            'https://openrouter.ai/api/v1/models',
            { headers: {}, signal: undefined },
        );
        expect(result).toEqual(['vendor/free:free']);
    });
});

describe('modelLists static fallbacks', () => {
    beforeEach(() => mockedGetJson.mockReset());

    it('fetchXaiModels falls back to the static list when the live list is empty', async () => {
        mockedGetJson.mockResolvedValueOnce({ data: [] });
        const result = await fetchXaiModels('key');
        expect(result).toContain('grok-4-fast');
        expect(result.length).toBeGreaterThan(0);
    });

    it('fetchXaiModels rethrows when the request was aborted (cancellation propagates)', async () => {
        const controller = new AbortController();
        controller.abort();
        mockedGetJson.mockRejectedValueOnce(new Error('aborted'));
        await expect(fetchXaiModels('key', controller.signal)).rejects.toThrow('aborted');
    });

    it('fetchAnthropicModels returns the static known-models list', async () => {
        const result = await fetchAnthropicModels('key');
        expect(result).toContain('claude-sonnet-4-5-20250929');
        expect(result.length).toBeGreaterThan(0);
    });

});

