// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewState } from '../src/views/webview/protocol';

const { sendMessage, setSetting } = vi.hoisted(() => ({ sendMessage: vi.fn(), setSetting: vi.fn() }));

vi.mock('../src/views/webview/init', () => ({
    init: {
        providers: ['custom'],
        formats: ['emojiKarma'],
        languages: ['english'],
        commitlintCompatFormats: [],
        noRefreshProviders: ['anthropic'],
        settingKeys: {
            provider: 'provider',
            customBaseUrl: 'custom.baseUrl',
            customChatCompletionsPath: 'custom.chatCompletionsPath',
            customModel: 'custom.model',
            customUseApiKey: 'custom.useApiKey',
        },
        apiKeyUrls: {},
    },
    L: {
        provider: 'Provider',
        commit: 'Commit message',
        format: 'Format',
        formatLabels: { emojiKarma: 'Conventional with Gitmoji' },
        language: 'Language',
        languageLabels: { english: 'English' },
        enableCustom: 'Enable custom instructions',
        modelAuth: 'Model & Authentication',
        model: 'Model',
        modelPlaceholder: 'Type a model ID',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        fetchModels: 'Fetch models',
        baseUrl: 'Base URL',
        path: 'Path',
        apiKey: 'API Keys',
        useApiKey: 'Send API key',
        authDisabled: 'Authentication disabled',
        keySet: '(saved)',
        keyRequired: 'Credential required for generation',
        credentialsSecurelyStored: 'Stored securely',
        notInList: '(not in the current list)',
        providerLabels: { custom: 'Custom (OpenAI-compatible)' },
        setKey: 'Set key',
        removeKey: 'Remove',
        getKey: 'Get key',
    },
    KEYS: {
        provider: 'provider',
        customBaseUrl: 'custom.baseUrl',
        customChatCompletionsPath: 'custom.chatCompletionsPath',
        customModel: 'custom.model',
        customUseApiKey: 'custom.useApiKey',
        commitFormat: 'commit.commitFormat',
        commitLanguage: 'commit.commitLanguage',
        useCustomInstructions: 'commit.useCustomInstructions',
    },
    COMMITLINT_COMPAT_FORMATS: new Set(),
    NO_REFRESH_PROVIDERS: new Set(['anthropic']),
}));

vi.mock('../src/views/webview/vscodeApi', () => ({
    send: sendMessage,
    setSetting,
    vscode: { getState: () => undefined, setState: vi.fn() },
}));

import { renderCommitSection, renderModelAuthSection } from '../src/views/webview/sections';

function makeState({ loading = false, saved = false, useApiKey = false } = {}): ViewState {
    return {
        projectOverrides: [],
        provider: 'custom',
        models: { custom: { list: ['vendor/model'], loading, error: null } },
        selected: { custom: 'manual-model' },
        hasApiKey: { custom: saved },
        custom: {
            baseUrl: 'https://models.example/v1',
            useApiKey,
            chatCompletionsPath: '/chat/completions',
        },
    } as unknown as ViewState;
}

beforeEach(() => {
    document.body.innerHTML = '';
    sendMessage.mockClear();
    setSetting.mockClear();
});

describe('Model & Authentication section', () => {
    it('keeps provider, endpoint, model, and fetch controls together in order', () => {
        const section = renderModelAuthSection(makeState());
        document.body.appendChild(section);

        expect(section.querySelector('.provider-pick')).not.toBeNull();
        expect([...section.querySelectorAll('label.field')].map(label => label.textContent)).toEqual([
            'Provider', 'Base URL', 'Path', 'Model', 'API Keys',
        ]);
        expect(section.querySelector<HTMLInputElement>('#model')?.type).toBe('text');

        const fetchButton = section.querySelector<HTMLButtonElement>('#refresh-models');
        expect(fetchButton?.textContent).toBe('');
        expect(fetchButton?.getAttribute('aria-label')).toBe('Fetch models');
        expect(fetchButton?.getAttribute('aria-busy')).toBe('false');
        expect(fetchButton?.title).toBe('Fetch models');
        expect(fetchButton?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
        expect(fetchButton?.querySelector('svg')?.getAttribute('focusable')).toBe('false');
        fetchButton?.click();
        expect(sendMessage).toHaveBeenCalledWith({ type: 'refreshModels', provider: 'custom' });
    });

    it('keeps the refresh icon disabled and announced while models load', () => {
        const section = renderModelAuthSection(makeState({ loading: true }));
        const button = section.querySelector<HTMLButtonElement>('#refresh-models');

        expect(button?.disabled).toBe(true);
        expect(button?.getAttribute('aria-busy')).toBe('true');
        expect(button?.textContent).toBe('');
        expect(button?.getAttribute('aria-label')).toBe('Refreshing…');
        expect(renderModelAuthSection(makeState()).querySelector('#refresh-models')?.getAttribute('aria-busy')).toBe('false');
        button?.click();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('shows a saved key inline without a duplicate credential status row', () => {
        const section = renderModelAuthSection(makeState({ saved: true, useApiKey: true }));

        expect(section.querySelector('.credential-heading .field')?.textContent).toBe('API Keys');
        expect(section.querySelector('.credential-saved')?.textContent).toBe('(saved)');
        expect(section.querySelector('.credential-status')).toBeNull();
        expect(section.textContent).not.toContain('Credential saved');
    });

    it('shows saved even while auth is disabled and retains the disabled message', () => {
        const section = renderModelAuthSection(makeState({ saved: true }));

        expect(section.querySelector('.credential-saved')?.textContent).toBe('(saved)');
        expect(section.querySelector('.credential-status')?.textContent).toContain('Authentication disabled');
    });

    it('retains the required-credential message when no key is saved', () => {
        const section = renderModelAuthSection(makeState({ useApiKey: true }));

        expect(section.querySelector('.credential-saved')).toBeNull();
        expect(section.querySelector('.credential-status')?.textContent).toContain('Credential required for generation');
    });
});

describe('Commit message section', () => {
    it('adds scoped spacing to the custom-instructions toggle and preserves its setting callback', () => {
        const section = renderCommitSection({
            projectOverrides: [],
            commit: {
                format: 'emojiKarma',
                language: 'english',
                customLanguageName: '',
                useCustomInstructions: false,
                customInstructions: '',
            },
        } as unknown as ViewState);
        const toggle = section.querySelector<HTMLInputElement>('#use-custom-instructions');

        expect(section.querySelector('#format .select-value')?.textContent).toBe('Conventional with Gitmoji');
        expect(toggle?.parentElement?.classList.contains('custom-instructions-toggle')).toBe(true);
        toggle!.checked = true;
        toggle!.dispatchEvent(new Event('change'));
        expect(setSetting).toHaveBeenCalledWith('commit.useCustomInstructions', true);
    });
});
