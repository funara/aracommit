// Per-section renderers. Each takes the current ViewState and returns a
// detached DOM subtree; main.ts assembles them into the document.

import type { Provider, ViewState } from './protocol';
import { el } from './dom';
import {
    fieldLabel,
    pinnedHint,
    isPinned,
    makeSelect,
    makeCheckbox,
    makeTextInput,
    makeNumberInput,
    makeTextarea,
} from './widgets';
import { makeCombobox } from './combobox';
import { section } from './section';
import { init, L, KEYS, COMMITLINT_COMPAT_FORMATS, NO_REFRESH_PROVIDERS } from './init';
import { send, setSetting } from './vscodeApi';
import { formatSupportsCommitlint } from './commitFormatPolicy';

/** Mirrors the `aracommit.gemini.thinkingLevel` enum in package.json. */
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;

export function renderProviderPick(state: ViewState): HTMLElement {
    const providerPinned = isPinned(state, 'provider');
    const options = init.providers.map(p => ({
        value: p,
        label: L.providerLabels[p],
        dot: state.hasApiKey[p],
    }));
    options.sort((a, b) => a.label.localeCompare(b.label));
    return el('div', { class: 'provider-pick' }, [
        fieldLabel(L.provider),
        makeSelect(
            'provider',
            options,
            state.provider,
            v => setSetting(KEYS.provider, v),
            { disabled: providerPinned },
        ),
        providerPinned ? pinnedHint() : undefined,
    ]);
}

// A "Base URL" labeled text input wired to a setting. The three providers with
// a configurable endpoint differ only in element id, state source, and key.
function appendBaseUrl(body: HTMLElement, id: string, value: string, key: string): void {
    body.appendChild(fieldLabel(L.baseUrl));
    body.appendChild(makeTextInput(id, value, v => setSetting(key, v)));
}

// Provider-specific endpoint config (baseUrl / path) above the model picker.
// Only providers whose endpoint is configurable get these.
function appendEndpointConfig(body: HTMLElement, state: ViewState, p: Provider): void {
    if (p === 'openai') {
        appendBaseUrl(body, 'openai-baseurl', state.openai.baseUrl, KEYS.openaiBaseUrl);
    } else if (p === 'ollama') {
        appendBaseUrl(body, 'ollama-baseurl', state.ollama.baseUrl, KEYS.ollamaBaseUrl);
    } else if (p === 'custom') {
        appendBaseUrl(body, 'custom-baseurl', state.custom.baseUrl, KEYS.customBaseUrl);
        body.appendChild(fieldLabel(L.path));
        body.appendChild(makeTextInput(
            'custom-path',
            state.custom.chatCompletionsPath,
            v => setSetting(KEYS.customChatCompletionsPath, v),
        ));
    }

}

function makeRefreshIcon(): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(namespace, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', 'M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.36 6.36L3 16M8 16H3v5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.appendChild(path);
    return icon;
}

function appendModelPicker(body: HTMLElement, state: ViewState, p: Provider): void {
    const slot = state.models[p];
    body.appendChild(fieldLabel(L.model));

    // Model setting key name is uniformly `<provider>Model` (matches SETTING_KEYS).
    const settingKeyName = `${p}Model`;
    const currentKey = KEYS[settingKeyName];
    const currentValue = state.selected[p];

    // Combobox (text input + datalist) instead of a plain <select>: lets the
    // user type to filter the model list (essential for OpenRouter's 300+
    // models) and lets them enter a brand-new model ID that isn't in the
    // fetched list yet.
    const modelOptions: string[] = [];
    if (p === 'gemini') {
        modelOptions.push('auto');
    }
    modelOptions.push(...slot.list);

    const modelPinned = isPinned(state, settingKeyName);
    const modelCombobox = makeCombobox(
        'model',
        modelOptions,
        currentValue,
        v => setSetting(currentKey, v),
        L.modelPlaceholder,
        { disabled: modelPinned },
    );

    if (NO_REFRESH_PROVIDERS.has(p)) {
        body.appendChild(modelCombobox);
    } else {
        const refreshLabel = slot.loading ? L.refreshing : L.refresh;
        const buttonLabel = p === 'custom' && !slot.loading ? L.fetchModels : refreshLabel;
        const refreshBtn = el('button', {
            id: 'refresh-models',
            type: 'button',
            title: buttonLabel,
            disabled: slot.loading,
        }, [makeRefreshIcon()]) as HTMLButtonElement;
        refreshBtn.setAttribute('aria-label', buttonLabel);
        refreshBtn.setAttribute('aria-busy', String(slot.loading));
        refreshBtn.addEventListener('click', () => send({ type: 'refreshModels', provider: p }));
        body.appendChild(el('div', { class: 'row' }, [modelCombobox, refreshBtn]));
    }

    if (modelPinned) { body.appendChild(pinnedHint()); }

    if (p === 'openrouter') {
        body.appendChild(makeCheckbox(
            'openrouter-prefer-free',
            L.preferFreeModels,
            state.openrouter.preferFreeModels,
            v => setSetting(KEYS.openrouterPreferFreeModels, v),
        ));
    }

    if (slot.error) {
        body.appendChild(el('div', { class: 'error' }, [slot.error]));
    }
}

function appendAuthControls(body: HTMLElement, state: ViewState, p: Provider): void {
    let enabled = true;
    let label = L.apiKey;

    if (p === 'ollama') {
        enabled = state.ollama.useAuthToken;
        label = L.authToken;
        body.appendChild(makeCheckbox(
            'ollama-useauth',
            L.useAuthToken,
            enabled,
            v => setSetting(KEYS.ollamaUseAuthToken, v),
        ));
    } else if (p === 'custom') {
        enabled = state.custom.useApiKey;
        body.appendChild(makeCheckbox(
            'custom-useapikey',
            L.useApiKey,
            enabled,
            v => setSetting(KEYS.customUseApiKey, v),
        ));
    }

    body.appendChild(el('div', { class: 'credential-heading' }, [
        fieldLabel(label),
        state.hasApiKey[p] ? el('span', { class: 'credential-saved' }, [L.keySet]) : undefined,
    ]));
    body.appendChild(renderApiKeyButtons(state, p, enabled));
}

export function renderModelAuthSection(state: ViewState): HTMLElement {
    const p = state.provider;
    const body = el('div');

    body.appendChild(renderProviderPick(state));

    if (p !== 'araAssistant') {
        appendEndpointConfig(body, state, p);
        appendModelPicker(body, state, p);
        appendAuthControls(body, state, p);
    }

    return section('modelAuth', L.modelAuth, true, body);
}

function renderApiKeyButtons(state: ViewState, p: Provider, enabled: boolean): HTMLDivElement {
    const saved = state.hasApiKey[p];
    let statusRow: HTMLDivElement | undefined;
    if (!enabled || !saved) {
        const status = enabled ? L.keyRequired : L.authDisabled;
        const statusClass = enabled ? 'needed' : 'disabled';
        const dot = el('span', { class: 'credential-dot' });
        dot.setAttribute('aria-hidden', 'true');
        statusRow = el('div', { class: `credential-status ${statusClass}`, role: 'status' }, [dot, status]);
    }
    const actions = el('div', { class: 'actions auth-actions' });

    if (enabled || saved) {
        if (p === 'openrouter') {
            const loginBtn = el('button', { class: 'primary' }, [L.loginOpenRouter]) as HTMLButtonElement;
            loginBtn.addEventListener('click', () => send({ type: 'loginOpenRouter' }));
            actions.appendChild(loginBtn);
        }
        const setBtn = el('button', { class: 'primary' }, [L.setKey]) as HTMLButtonElement;
        setBtn.addEventListener('click', () => send({ type: 'setApiKey', provider: p }));
        actions.appendChild(setBtn);
        if (saved) {
            const removeBtn = el('button', {}, [L.removeKey]) as HTMLButtonElement;
            removeBtn.addEventListener('click', () => send({ type: 'removeApiKey', provider: p }));
            actions.appendChild(removeBtn);
        }
    }

    const keyUrl = init.apiKeyUrls[p];
    if (keyUrl) {
        const getBtn = el('button', { title: keyUrl }, [L.getKey]) as HTMLButtonElement;
        getBtn.addEventListener('click', () => send({ type: 'openExternal', url: keyUrl }));
        actions.appendChild(getBtn);
    }

    return el('div', { class: 'credential-panel' }, [
        statusRow,
        actions.children.length ? actions : undefined,
        enabled || saved ? el('div', { class: 'hint' }, [L.credentialsSecurelyStored]) : undefined,
    ]) as HTMLDivElement;
}

export function renderCommitSection(state: ViewState): HTMLElement {
    const body = el('div');
    const formatPinned = isPinned(state, 'commitFormat');
    body.appendChild(fieldLabel(L.format));
    body.appendChild(makeSelect(
        'format',
        init.formats.map(f => ({ value: f, label: L.formatLabels[f] ?? f })),
        state.commit.format,
        v => setSetting(KEYS.commitFormat, v),
        { disabled: formatPinned },
    ));
    if (formatPinned) { body.appendChild(pinnedHint()); }

    const languagePinned = isPinned(state, 'commitLanguage');
    body.appendChild(fieldLabel(L.language));
    body.appendChild(makeSelect(
        'language',
        init.languages.map(l => ({ value: l, label: L.languageLabels[l] ?? l })),
        state.commit.language,
        v => setSetting(KEYS.commitLanguage, v),
        { disabled: languagePinned },
    ));
    if (languagePinned) { body.appendChild(pinnedHint()); }

    if (state.commit.language === 'custom') {
        body.appendChild(fieldLabel(L.customLanguage));
        body.appendChild(makeTextInput(
            'custom-language',
            state.commit.customLanguageName,
            v => setSetting(KEYS.customLanguageName, v),
        ));
    }

    const customInstructionsToggle = makeCheckbox(
        'use-custom-instructions',
        L.enableCustom,
        state.commit.useCustomInstructions,
        v => setSetting(KEYS.useCustomInstructions, v),
    );
    customInstructionsToggle.classList.add('custom-instructions-toggle');
    body.appendChild(customInstructionsToggle);
    if (state.commit.useCustomInstructions) {
        body.appendChild(fieldLabel(L.customInstructions));
        body.appendChild(makeTextarea(
            'custom-text',
            state.commit.customInstructions,
            v => setSetting(KEYS.customInstructions, v),
        ));
        body.appendChild(el('div', { class: 'hint' }, [L.customInstructionsPh]));
    }

    return section('commit', L.commit, true, body);
}

export function renderSmartCommitSection(state: ViewState): HTMLElement {
    const body = el('div');
    const supportsCommitlint = formatSupportsCommitlint(state.commit.format);

    body.appendChild(el('div', { class: 'group-heading' }, [L.validation]));
    body.appendChild(makeCheckbox(
        'commitlint-enabled',
        L.commitlintEnabled,
        state.commit.commitlintEnabled && supportsCommitlint,
        v => setSetting(KEYS.commitlintEnabled, v),
        { disabled: !supportsCommitlint },
    ));

    if (state.commit.commitlintEnabled && supportsCommitlint) {
        if (COMMITLINT_COMPAT_FORMATS.has(state.commit.format) && state.commit.commitlintCliAvailable) {
            body.appendChild(fieldLabel(L.commitlintEngine));
            body.appendChild(makeSelect(
                'commitlint-engine',
                [
                    { value: 'builtin', label: 'Built-in static rules' },
                    { value: 'project', label: 'Project commitlint (node_modules)' },
                ],
                state.commit.commitlintEngine,
                v => setSetting(KEYS.commitlintEngine, v),
            ));
        } else if (!COMMITLINT_COMPAT_FORMATS.has(state.commit.format)) {
            body.appendChild(el('div', { class: 'hint' }, [
                'This format is checked by built-in rules; project commitlint cannot parse it.',
            ]));
        }

        body.appendChild(fieldLabel(L.commitlintMaxRetries));
        body.appendChild(makeNumberInput(
            'commitlint-max-retries',
            state.commit.commitlintMaxRetries,
            v => setSetting(KEYS.commitlintMaxRetries, v),
        ));

        if (state.commit.format === 'conventional') {
            body.appendChild(fieldLabel(L.commitlintRulesPath));
            body.appendChild(makeTextInput(
                'commitlint-rules-path',
                state.commit.commitlintRulesPath,
                v => setSetting(KEYS.commitlintRulesPath, v),
                './config',
            ));
            body.appendChild(el('div', { class: 'hint' }, [
                'Path to the commitlint config file. Relative to the repo root, or absolute. Empty = auto-discover.',
            ]));
        }
    }

    body.appendChild(el('div', { class: 'group-divider' }));
    body.appendChild(el('div', { class: 'group-heading' }, [L.automation]));
    const trustHint = state.trusted ? undefined : L.untrusted;
    body.appendChild(makeCheckbox(
        'auto-commit',
        L.autoCommit,
        state.commit.autoCommit,
        v => setSetting(KEYS.autoCommit, v),
        { disabled: !state.trusted, hint: trustHint },
    ));

    const autoPushHint = !state.trusted ? L.untrusted : state.commit.autoCommit ? undefined : L.autoPushNeedsCommit;
    body.appendChild(makeCheckbox(
        'auto-push',
        L.autoPush,
        state.commit.autoPush,
        v => setSetting(KEYS.autoPush, v),
        {
            disabled: !state.trusted || !state.commit.autoCommit,
            hint: autoPushHint,
        },
    ));

    return section('smartCommit', L.smartCommit, true, body);
}

export function renderAdvancedSection(state: ViewState): HTMLElement {
    const body = el('div');

    body.appendChild(fieldLabel(L.apiTimeout));
    body.appendChild(makeNumberInput(
        'api-timeout',
        state.advanced.apiRequestTimeout,
        v => setSetting(KEYS.apiRequestTimeout, v),
    ));
    body.appendChild(fieldLabel(L.gitTimeout));
    body.appendChild(makeNumberInput(
        'git-timeout',
        state.advanced.gitTimeout,
        v => setSetting(KEYS.gitTimeout, v),
    ));
    body.appendChild(el('div', { class: 'hint' }, [L.timeoutHint]));

    body.appendChild(fieldLabel(L.maxDiffSize));
    body.appendChild(makeNumberInput(
        'max-diff-size',
        state.advanced.maxDiffSize,
        v => setSetting(KEYS.maxDiffSize, v),
    ));
    body.appendChild(el('div', { class: 'hint' }, [L.maxDiffSizeHint]));

    body.appendChild(fieldLabel(L.temperature));
    body.appendChild(makeNumberInput(
        'temperature',
        state.advanced.temperature,
        v => setSetting(KEYS.temperature, v),
    ));
    body.appendChild(el('div', { class: 'hint' }, [L.temperatureHint]));

    body.appendChild(fieldLabel(L.maxOutputTokens));
    body.appendChild(makeNumberInput(
        'max-output-tokens',
        state.advanced.maxOutputTokens,
        v => setSetting(KEYS.maxOutputTokens, v),
    ));
    body.appendChild(el('div', { class: 'hint' }, [L.maxOutputTokensHint]));

    // Gemini-only: the two thinking knobs. Both are shown because a single
    // Gemini install switches between 2.5 and 3.x models (and `auto` picks for
    // you), and each family only honours one of them.
    if (state.provider === 'gemini') {
        body.appendChild(fieldLabel(L.geminiThinkingBudget));
        body.appendChild(makeNumberInput(
            'gemini-thinking-budget',
            state.gemini.thinkingBudget,
            v => setSetting(KEYS.geminiThinkingBudget, v),
        ));
        body.appendChild(el('div', { class: 'hint' }, [L.geminiThinkingBudgetHint]));

        body.appendChild(fieldLabel(L.geminiThinkingLevel));
        body.appendChild(makeSelect(
            'gemini-thinking-level',
            THINKING_LEVELS.map(value => ({ value, label: value })),
            state.gemini.thinkingLevel,
            v => setSetting(KEYS.geminiThinkingLevel, v),
        ));
        body.appendChild(el('div', { class: 'hint' }, [L.geminiThinkingLevelHint]));
    }

    // Ollama-only: context window override. Surfaced regardless of selected
    // provider since the Advanced section already collects cross-cutting
    // settings — keeps related Ollama settings discoverable.
    if (state.provider === 'ollama') {
        body.appendChild(fieldLabel(L.ollamaNumCtx));
        body.appendChild(makeNumberInput(
            'ollama-num-ctx',
            state.ollama.numCtx,
            v => setSetting(KEYS.ollamaNumCtx, v),
        ));
        body.appendChild(el('div', { class: 'hint' }, [L.ollamaNumCtxHint]));
    }

    return section('advanced', L.advanced, true, body);
}

export function renderProviderNoticeSection(state: ViewState): HTMLDetailsElement | null {
    if (state.provider !== 'araAssistant') {
        return null;
    }

    const body = el('div');
    body.appendChild(el('div', { class: 'hint info', role: 'note' }, [L.araAssistantPrivacy]));
    return section('providerNotice', L.providerNotice, false, body);
}
