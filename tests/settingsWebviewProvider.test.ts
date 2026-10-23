import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ConfigService } from '../src/utils/configService';
import { Logger } from '../src/utils/logger';
import type { IncomingMessage, ModelSlot, Provider, ViewState } from '../src/views/webview/protocol';

const { fetchModels, selectedModel } = vi.hoisted(() => ({
    fetchModels: vi.fn(),
    selectedModel: vi.fn(),
}));

vi.mock('../src/services/providerRegistry', () => {
    const providers = ['anthropic', 'custom', 'deepseek', 'gemini', 'ollama', 'openai', 'openrouter', 'xai'];
    return {
        PROVIDERS: providers,
        NO_REFRESH_PROVIDERS: new Set(['anthropic', 'custom']),
        SECRET_KEYS: [],
        API_KEY_URLS: {},
        PROVIDER_LABELS: Object.fromEntries(providers.map(id => [id, id])),
        PROVIDER_LIVE_SOURCES: Object.fromEntries(providers.map(id => [id, id])),
        providerDef: (provider: string) => ({
            fetchModels: () => fetchModels(provider),
            selectedModel: () => selectedModel(provider),
        }),
    };
});

vi.mock('../src/services/apiKeyManager', () => ({
    ApiKeyManager: { getOptionalKey: vi.fn(async () => 'test-key') },
}));

import { SettingsWebviewProvider } from '../src/views/settingsWebviewProvider';

type Internals = {
    handleMessage(message: IncomingMessage): Promise<void>;
    refreshModelsFor(provider: Provider, force: boolean): Promise<void>;
    buildState(): Promise<ViewState>;
    models: Record<Provider, ModelSlot>;
};

function internals(provider: SettingsWebviewProvider): Internals {
    return provider as unknown as Internals;
}

function makeProvider(): Internals {
    return internals(new SettingsWebviewProvider({ subscriptions: [] } as unknown as vscode.ExtensionContext));
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

beforeEach(() => {
    fetchModels.mockReset();
    fetchModels.mockResolvedValue([]);
    selectedModel.mockReset();
    selectedModel.mockImplementation((provider: string) => `${provider}-model`);
    ConfigService.clearCache();
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: <T>(_key: string, defaultValue?: T) => defaultValue,
        update: vi.fn(async () => undefined),
        inspect: () => undefined,
    } as unknown as vscode.WorkspaceConfiguration);
});

afterEach(() => {
    vi.restoreAllMocks();
    ConfigService.clearCache();
});

describe('SettingsWebviewProvider model refresh', () => {
    it('keeps the latest forced request when earlier responses arrive late', async () => {
        const provider = makeProvider();
        const first = deferred<string[]>();
        const second = deferred<string[]>();
        fetchModels.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const firstRequest = provider.refreshModelsFor('openai', true);
        const secondRequest = provider.refreshModelsFor('openai', true);
        second.resolve(['new-model']);
        await secondRequest;
        first.resolve(['stale-model']);
        await firstRequest;

        expect(provider.models.openai.list).toEqual(['new-model']);
        expect(provider.models.openai.loading).toBe(false);
    });

    it('clears errors on retry without replacing a manually selected model', async () => {
        const provider = makeProvider();
        selectedModel.mockImplementation((id: string) => id === 'openai' ? 'custom-manual-id' : `${id}-model`);
        fetchModels.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(['recovered-model']);

        await provider.refreshModelsFor('openai', true);
        expect(provider.models.openai.loading).toBe(false);
        expect(provider.models.openai.error).toBeTruthy();
        expect((await provider.buildState()).selected.openai).toBe('custom-manual-id');

        await provider.refreshModelsFor('openai', true);
        expect(provider.models.openai.list).toEqual(['recovered-model']);
        expect(provider.models.openai.error).toBeNull();
        expect((await provider.buildState()).selected.openai).toBe('custom-manual-id');
    });

    it('keeps each provider model list isolated when switching providers', async () => {
        const provider = makeProvider();
        const errors = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
        fetchModels.mockImplementation(async (id: string) => [`${id}-one`, `${id}-two`]);

        await provider.handleMessage({ type: 'setSetting', key: 'aracommit.provider.type', value: 'openai' });
        await provider.handleMessage({ type: 'setSetting', key: 'aracommit.provider.type', value: 'openrouter' });

        expect(errors.mock.calls).toEqual([]);
        expect(provider.models.openai.list).toEqual(['openai-one', 'openai-two']);
        expect(provider.models.openrouter.list).toEqual(['openrouter-one', 'openrouter-two']);
    });

    it('forces refreshes when model-list filters or endpoints change', async () => {
        const provider = makeProvider();
        const refresh = vi.spyOn(provider, 'refreshModelsFor').mockResolvedValue();
        const changes: Array<[string, string | boolean, Provider]> = [
            ['aracommit.openrouter.preferFreeModels', true, 'openrouter'],
            ['aracommit.openai.baseUrl', 'https://models.example/v1', 'openai'],
            ['aracommit.ollama.baseUrl', 'http://localhost:11434', 'ollama'],
            ['aracommit.ollama.useAuthToken', true, 'ollama'],
        ];

        for (const [key, value] of changes) {
            await provider.handleMessage({ type: 'setSetting', key, value });
        }

        expect(refresh.mock.calls).toEqual(changes.map(([, , target]) => [target, true]));
    });
});
