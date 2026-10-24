import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationError } from '../src/models/errors';
import type { GenerateOptions, ProgressReporter } from '../src/models/types';
import { HttpError, HttpUtils, NetworkError } from '../src/utils/httpUtils';

vi.mock('../src/utils/logger', () => ({ Logger: { log: vi.fn() } }));
vi.mock('../src/utils/retryUtils', () => ({
    RetryUtils: { updateProgressForAttempt: vi.fn(async () => undefined) },
}));
vi.mock('../src/services/apiKeyManager', () => ({ ApiKeyManager: { getKey: vi.fn() } }));
vi.mock('../src/services/baseAIService', () => ({
    extractAndValidateMessage: (content: string | undefined) => {
        if (!content) throw new Error('Invalid response');
        return content.trim();
    },
    getConfiguredTemperature: () => 0.7,
    handleHttpError: (error: Error) => ({ errorMessage: error.message, shouldRetry: false }),
    resolveMaxOutputTokens: () => 128,
    withRetryAndApiKeyGuard: vi.fn(),
}));

import { generateViaOpenAICompatibleProvider } from '../src/services/openAICompatibleService';

const ENV_KEYS = [
    'ARA_ASSISTANT_ENDPOINT',
    'ARA_ASSISTANT_PRIMARY_MODEL',
    'ARA_ASSISTANT_SECONDARY_MODEL',
] as const;
const originalEnv = new Map<string, string | undefined>();
const progress: ProgressReporter = { report: vi.fn() };
const prompt = 'staged diff prompt';

function successfulResponse(content = 'fix: staged changes'): unknown {
    return { choices: [{ message: { content } }] };
}

function generate(options?: GenerateOptions): Promise<{ message: string; model: string }> {
    return generateViaOpenAICompatibleProvider('araAssistant', prompt, progress, 1, options);
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
        originalEnv.set(key, process.env[key]);
    }
    process.env.ARA_ASSISTANT_ENDPOINT = 'https://gateway.example/v1/';
    process.env.ARA_ASSISTANT_PRIMARY_MODEL = 'synthetic-primary';
    process.env.ARA_ASSISTANT_SECONDARY_MODEL = 'synthetic-secondary';
});

afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
        const value = originalEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    originalEnv.clear();
});

describe('ARA Assistant OpenAI-compatible routing', () => {
    it('uses the configured primary route without exposing its model or sending a key', async () => {
        const post = vi.spyOn(HttpUtils, 'postJson').mockResolvedValue(successfulResponse() as never);

        await expect(generate()).resolves.toEqual({
            message: 'fix: staged changes',
            model: 'Automatic · Free',
        });
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][0]).toBe('https://gateway.example/v1/chat/completions');
        expect((post.mock.calls[0][1] as { model: string }).model).toBe('synthetic-primary');
        expect(post.mock.calls[0][2].headers.Authorization).toBeUndefined();
    });

    it('tries the secondary route after an eligible typed HTTP failure', async () => {
        const post = vi.spyOn(HttpUtils, 'postJson')
            .mockRejectedValueOnce(new HttpError(503, { error: 'temporarily unavailable' }))
            .mockResolvedValueOnce(successfulResponse('fix: fallback route') as never);

        await expect(generate()).resolves.toEqual({
            message: 'fix: fallback route',
            model: 'Automatic · Free',
        });
        expect(post.mock.calls.map(call => (call[1] as { model: string }).model)).toEqual([
            'synthetic-primary',
            'synthetic-secondary',
        ]);
    });

    it.each([400, 401, 402, 403, 409, 422, 429, 501])(
        'does not fall back for HTTP %i',
        async status => {
            const post = vi.spyOn(HttpUtils, 'postJson').mockRejectedValueOnce(new HttpError(status, 'rejected'));
            await expect(generate()).rejects.toThrow('Failed to generate commit message');
            expect(post).toHaveBeenCalledTimes(1);
        },
    );

    it('does not fall back when cancellation happens between the primary and backup routes', async () => {
        const controller = new AbortController();
        const post = vi.spyOn(HttpUtils, 'postJson').mockImplementationOnce(async () => {
            controller.abort();
            throw new HttpError(503, 'primary unavailable');
        });

        await expect(generate({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(post).toHaveBeenCalledTimes(1);
    });

    it('stops after one failed backup request', async () => {
        const post = vi.spyOn(HttpUtils, 'postJson')
            .mockRejectedValueOnce(new HttpError(503, 'primary unavailable'))
            .mockRejectedValueOnce(new HttpError(502, 'backup unavailable'));

        await expect(generate()).rejects.toThrow('Failed to generate commit message');
        expect(post).toHaveBeenCalledTimes(2);
    });

    it('does not fall back for network errors, arbitrary errors, or cancellation', async () => {
        const network = vi.spyOn(HttpUtils, 'postJson').mockRejectedValueOnce(
            new NetworkError('network unavailable', new TypeError('fetch failed')),
        );
        await expect(generate()).rejects.toThrow('Failed to generate commit message');
        expect(network).toHaveBeenCalledTimes(1);

        vi.restoreAllMocks();
        const arbitrary = new Error('unexpected failure');
        const arbitraryPost = vi.spyOn(HttpUtils, 'postJson').mockRejectedValueOnce(arbitrary);
        await expect(generate()).rejects.toBe(arbitrary);
        expect(arbitraryPost).toHaveBeenCalledTimes(1);

        vi.restoreAllMocks();
        const cancellation = new Error('request cancelled');
        cancellation.name = 'AbortError';
        const cancelPost = vi.spyOn(HttpUtils, 'postJson').mockRejectedValueOnce(cancellation);
        await expect(generate()).rejects.toBe(cancellation);
        expect(cancelPost).toHaveBeenCalledTimes(1);
    });

    it('fails clearly at use time when build configuration is missing', async () => {
        delete process.env.ARA_ASSISTANT_ENDPOINT;
        const post = vi.spyOn(HttpUtils, 'postJson');

        await expect(generate()).rejects.toBeInstanceOf(ConfigurationError);
        await expect(generate()).rejects.toThrow('ARA Assistant is not configured in this build.');
        expect(post).not.toHaveBeenCalled();
    });
});
