import { describe, it, expect } from 'vitest';
import { buildWebviewL10n } from '../src/views/webviewL10n';
import { PROVIDER_LABELS, PROVIDER_LIVE_SOURCES } from '../src/services/providerRegistry';

describe('buildWebviewL10n', () => {
    it('returns a bundle with localized strings (mock l10n returns input)', () => {
        const bundle = buildWebviewL10n();
        expect(bundle.provider).toBe('Provider');
        expect(bundle.model).toBe('Model');
        expect(bundle.apiKey).toBe('API key');
        expect(bundle.autoCommit).toBe('Auto-commit');
        expect(bundle.advanced).toBe('Advanced');
        expect(bundle.autoOption).toBe('auto — try all available models');
    });

    it('exposes localized strings and string-valued label maps', () => {
        const bundle = buildWebviewL10n() as unknown as Record<string, unknown>;
        const mapKeys = ['formatLabels', 'languageLabels', 'providerLabels', 'liveSource'];
        const stringKeys = Object.keys(bundle).filter(key => !mapKeys.includes(key));
        for (const key of stringKeys) {
            expect(typeof bundle[key]).toBe('string');
        }
        for (const key of mapKeys) {
            expect(Object.values(bundle[key] as Record<string, unknown>).every(value => typeof value === 'string')).toBe(true);
        }
        expect(stringKeys.length).toBeGreaterThan(10);
    });

    it('pulls provider labels and live sources from the registry', () => {
        const bundle = buildWebviewL10n();
        expect(bundle.providerLabels).toBe(PROVIDER_LABELS);
        expect(bundle.liveSource).toBe(PROVIDER_LIVE_SOURCES);
    });
});
