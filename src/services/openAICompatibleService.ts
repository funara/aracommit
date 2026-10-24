import { Logger } from '../utils/logger';
import type { CommitMessage, ProgressReporter, GenerateOptions } from '../models/types';
import { extractAndValidateMessage, getConfiguredTemperature, handleHttpError, resolveMaxOutputTokens, withRetryAndApiKeyGuard } from './baseAIService';
import { HttpError, HttpUtils, NetworkError } from '../utils/httpUtils';
import { RetryUtils } from '../utils/retryUtils';
import { ConfigService } from '../utils/configService';
import { ApiKeyManager } from './apiKeyManager';
import { providerMeta } from './providerCatalog';
import { Provider } from '../views/webview/protocol';
import { ConfigurationError, TruncatedResponseError } from '../models/errors';

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        finish_reason?: string;
    }>;
}

/**
 * Single request to an OpenAI-compatible `chat/completions` endpoint.
 * Used by OpenAI, OpenRouter, DeepSeek, xAI, ARA Assistant, and the
 * user-configurable "Custom" provider — every vendor that mirrors OpenAI's wire format.
 *
 * Anthropic is NOT OpenAI-compatible (different request/response shape,
 * `x-api-key` header style) — see `anthropicService.ts`.
 */
export interface OpenAICompatibleRequest {
    providerLabel: string;
    baseUrl: string;
    apiKey?: string;
    model: string;
    chatCompletionsPath?: string;
    extraHeaders?: Record<string, string>;
    /** Safe display label when the actual routed model should stay undisclosed. */
    reportedModel?: string;
}

export async function generateViaOpenAICompatible(
    request: OpenAICompatibleRequest,
    prompt: string,
    progress: ProgressReporter,
    attempt: number,
    retryFn: (
        prompt: string,
        progress: ProgressReporter,
        attempt: number,
    ) => Promise<CommitMessage>,
    options?: GenerateOptions,
): Promise<CommitMessage> {
    return withRetryAndApiKeyGuard(
        request.providerLabel,
        prompt,
        progress,
        attempt,
        retryFn,
        async () => {
            await RetryUtils.updateProgressForAttempt(progress, attempt);
            return sendOpenAICompatibleRequest(request, prompt, progress, attempt, options);
        },
    );
}

async function sendOpenAICompatibleRequest(
    request: OpenAICompatibleRequest,
    prompt: string,
    progress: ProgressReporter,
    attempt: number,
    options?: GenerateOptions,
): Promise<CommitMessage> {
    const path = request.chatCompletionsPath ?? '/chat/completions';
    const baseUrl = HttpUtils.stripTrailingSlashes(request.baseUrl);
    const payload = {
        model: request.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: getConfiguredTemperature(),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_tokens: resolveMaxOutputTokens(options, attempt),
    };

    const data = await HttpUtils.postJson<OpenAIResponse>(
        `${baseUrl}${path}`,
        payload,
        {
            headers: HttpUtils.createRequestHeaders(request.apiKey, request.extraHeaders),
            signal: options?.signal,
        },
    );

    progress.report({ message: 'Processing generated message...', increment: 90 });
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
        throw new TruncatedResponseError(
            request.providerLabel,
            `${request.reportedModel ?? request.model} exhausted max_tokens`,
        );
    }

    const message = extractAndValidateMessage(choice?.message?.content, request.providerLabel);
    const model = request.reportedModel ?? request.model;
    Logger.log(`Commit message generated using ${model} model`);
    return { message, model };
}

const ARA_ASSISTANT_MODEL_LABEL = 'Automatic · Free';
const ARA_ASSISTANT_FALLBACK_STATUSES = new Set([404, 500, 502, 503, 504]);

function getAraAssistantBuildConfig(): { endpoint: string; primaryModel: string; secondaryModel: string } {
    const endpoint = process.env.ARA_ASSISTANT_ENDPOINT ?? '';
    const primaryModel = process.env.ARA_ASSISTANT_PRIMARY_MODEL ?? '';
    const secondaryModel = process.env.ARA_ASSISTANT_SECONDARY_MODEL ?? '';
    if (!endpoint || !primaryModel || !secondaryModel) {
        throw new ConfigurationError('ARA Assistant is not configured in this build.');
    }
    return { endpoint, primaryModel, secondaryModel };
}

function araAssistantError(error: unknown): Error {
    if (error instanceof HttpError || error instanceof NetworkError) {
        const { errorMessage } = handleHttpError(error, 'ARA Assistant API');
        return new Error(`Failed to generate commit message: ${errorMessage}`);
    }
    return error instanceof Error ? error : new Error(String(error));
}

async function generateAraAssistant(
    prompt: string,
    progress: ProgressReporter,
    attempt: number,
    options?: GenerateOptions,
): Promise<CommitMessage> {
    const config = getAraAssistantBuildConfig();
    const request = (model: string): OpenAICompatibleRequest => ({
        providerLabel: 'ARA Assistant',
        baseUrl: config.endpoint,
        model,
        reportedModel: ARA_ASSISTANT_MODEL_LABEL,
    });

    await RetryUtils.updateProgressForAttempt(progress, attempt);
    try {
        return await sendOpenAICompatibleRequest(
            request(config.primaryModel), prompt, progress, attempt, options,
        );
    } catch (error) {
        if (!(error instanceof HttpError) || !ARA_ASSISTANT_FALLBACK_STATUSES.has(error.status)) {
            throw araAssistantError(error);
        }
        options?.signal?.throwIfAborted();
        progress.report({ message: 'Primary route unavailable; trying the free backup...', increment: 0 });
        try {
            return await sendOpenAICompatibleRequest(
                request(config.secondaryModel), prompt, progress, attempt, options,
            );
        } catch (fallbackError) {
            throw araAssistantError(fallbackError);
        }
    }
}

/**
 * Per-provider variation for the OpenAI-compatible wire format. Everything an
 * individual provider used to express in its own `*Service.ts` wrapper now
 * lives as one row here; the shared dispatcher below reads it. Fields that are
 * identical for configurable providers (the `providerLabel` = catalog
 * `displayName`, the `<id>.model` setting key, the default `getApiKey` of `getKey(id)`, the
 * default `/chat/completions` path) are derived, not repeated.
 */
interface CompatProviderSpec {
    /** Endpoint base URL. A thunk because some read live config. */
    baseUrl: () => string;
    /** Provider-specific attribution/routing headers (e.g. OpenRouter). */
    extraHeaders?: Record<string, string>;
    /** Override the chat-completions path (e.g. user-configurable Custom). */
    chatCompletionsPath?: () => string;
    /** Override key acquisition (e.g. Custom's optional `useApiKey` toggle). */
    getApiKey?: () => Promise<string | undefined>;
}

const COMPAT_SPECS: Partial<Record<Provider, CompatProviderSpec>> = {
    openai: { baseUrl: () => ConfigService.get('openai.baseUrl') },
    xai: { baseUrl: () => 'https://api.x.ai/v1' },
    deepseek: { baseUrl: () => 'https://api.deepseek.com' },
    openrouter: {
        baseUrl: () => 'https://openrouter.ai/api/v1',
        extraHeaders: {
            // OpenRouter uses this optional title for app attribution.
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'X-Title': 'ARACommit',
        },
    },
    araAssistant: { baseUrl: () => process.env.ARA_ASSISTANT_ENDPOINT ?? '' },
    custom: {
        // User-configured OpenAI-compatible endpoint (LM Studio, vLLM,
        // llama.cpp, LocalAI, Together, Fireworks, …). `apiKey` is optional:
        // self-hosted models often need no auth, so the key is only fetched
        // when the `custom.useApiKey` toggle is on.
        baseUrl: () => ConfigService.get('custom.baseUrl'),
        chatCompletionsPath: () => ConfigService.get('custom.chatCompletionsPath'),
        getApiKey: async () =>
            ConfigService.get('custom.useApiKey')
                ? ApiKeyManager.getKey('custom')
                : undefined,
    },
};

/** True when `provider` speaks the OpenAI `/chat/completions` wire format. */
export function isOpenAICompatibleProvider(provider: Provider): boolean {
    return provider in COMPAT_SPECS;
}

/**
 * Single entry point for every OpenAI-compatible provider. Replaces the seven
 * near-identical `*Service.ts` wrapper classes: looks up the provider's row in
 * `COMPAT_SPECS`, derives the rest from the catalog/settings, and delegates to
 * `generateViaOpenAICompatible`.
 */
export async function generateViaOpenAICompatibleProvider(
    provider: Provider,
    prompt: string,
    progress: ProgressReporter,
    attempt: number = 1,
    options?: GenerateOptions,
): Promise<CommitMessage> {
    const spec = COMPAT_SPECS[provider];
    if (!spec) {
        throw new Error(`Provider '${provider}' is not OpenAI-compatible`);
    }
    if (provider === 'araAssistant') {
        return generateAraAssistant(prompt, progress, attempt, options);
    }
    const apiKey = spec.getApiKey
        ? await spec.getApiKey()
        : await ApiKeyManager.getKey(provider);

    return generateViaOpenAICompatible(
        {
            providerLabel: providerMeta(provider).displayName,
            baseUrl: spec.baseUrl(),
            apiKey,
            model: ConfigService.getModelFor(provider),
            chatCompletionsPath: spec.chatCompletionsPath?.(),
            extraHeaders: spec.extraHeaders,
        },
        prompt,
        progress,
        attempt,
        (p, pr, a) => generateViaOpenAICompatibleProvider(provider, p, pr, a, options),
        options,
    );
}
