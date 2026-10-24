import { describe, it, expect } from 'vitest';
import { ApiKeyValidator } from '../src/utils/apiKeyValidator';
import { PROVIDER_CATALOG } from '../src/services/providerCatalog';

describe('ApiKeyValidator lax validators (validateNonEmpty)', () => {
    it('rejects empty', () => {
        expect(ApiKeyValidator.validateNonEmpty('')).toBe('API key cannot be empty');
    });
    it('accepts any non-empty key', () => {
        expect(ApiKeyValidator.validateNonEmpty('some-$weird/key')).toBeNull();
    });
});

describe('provider catalog wires each provider to a validator', () => {
    // Every key-bearing provider except Gemini uses the non-empty validator.
    const keyBearing = PROVIDER_CATALOG.filter(p => p.validateKey);
    const lax = keyBearing.filter(p => p.id !== 'gemini');
    for (const p of lax) {
        it(`${p.id}: rejects empty`, () => {
            expect(p.validateKey!('')).toBe('API key cannot be empty');
        });
        it(`${p.id}: accepts any non-empty key`, () => {
            expect(p.validateKey!('some-$weird/key')).toBeNull();
        });
    }

    it('keyless ARA Assistant has no credential metadata', () => {
        const araAssistant = PROVIDER_CATALOG.find(p => p.id === 'araAssistant')!;
        expect(araAssistant.validateKey).toBeUndefined();
        expect(araAssistant.secretKey).toBeUndefined();
        expect(araAssistant.setCmd).toBeUndefined();
        expect(araAssistant.removeCmd).toBeUndefined();
    });

    it('gemini uses the charset-aware validator', () => {
        const gemini = PROVIDER_CATALOG.find(p => p.id === 'gemini')!;
        expect(gemini.validateKey!('AQ.Ab8_test.Key-1')).toBeNull();
        expect(gemini.validateKey!('bad$char!')).toBe('API key contains invalid characters');
    });

});
