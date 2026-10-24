import { describe, it, expect } from 'vitest';
import { buildWebviewL10n } from '../src/views/webviewL10n';
import { PROVIDER_LABELS } from '../src/services/providerRegistry';

describe('buildWebviewL10n', () => {
    it('returns a bundle with localized strings (mock l10n returns input)', () => {
        const bundle = buildWebviewL10n();
        expect(bundle.provider).toBe('Provider');
        expect(bundle.model).toBe('Model');
        expect(bundle.providerNotice).toBe('Provider Notice');
        expect(bundle.formatLabels.emojiKarma).toBe('Conventional with Gitmoji');
        expect(bundle.apiKey).toBe('API Keys');
        expect(bundle.keySet).toBe('(saved)');
        expect(bundle.autoCommit).toBe('Auto-commit');
        expect(bundle.advanced).toBe('Advanced');
        expect(bundle.autoOption).toBe('auto — try all available models');
        expect(bundle.araAssistantPrivacy).toBe('Notes: Provider may send changes and prompt context to third-party AI services. See provider privacy policy for details.');
    });

    it('exposes localized strings and string-valued label maps', () => {
        const bundle = buildWebviewL10n() as unknown as Record<string, unknown>;
        const mapKeys = ['formatLabels', 'languageLabels', 'providerLabels'];
        const stringKeys = Object.keys(bundle).filter(key => !mapKeys.includes(key));
        for (const key of stringKeys) {
            expect(typeof bundle[key]).toBe('string');
        }
        for (const key of mapKeys) {
            expect(Object.values(bundle[key] as Record<string, unknown>).every(value => typeof value === 'string')).toBe(true);
        }
        expect(stringKeys.length).toBeGreaterThan(10);
    });

    it('pulls provider labels from the registry', () => {
        expect(buildWebviewL10n().providerLabels).toBe(PROVIDER_LABELS);
    });
});
