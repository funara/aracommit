import { describe, it, expect } from 'vitest';
import { redactSecrets, toError } from '../src/utils/errorUtils';

describe('toError', () => {
    it('passes Error instances through', () => {
        const e = new Error('boom');
        expect(toError(e)).toBe(e);
    });

    it('wraps non-Error values', () => {
        const e = toError('boom');
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toBe('boom');
    });
});

describe('redactSecrets', () => {
    it('redacts file paths', () => {
        const out = redactSecrets('failed at /Users/jane/proj/src/foo.ts:23');
        expect(out).toContain('<path>');
        expect(out).not.toContain('/Users/jane');
    });

    it('redacts ?key= and &key= URL secrets', () => {
        const out = redactSecrets('https://example.test?key=secret&other=1');
        expect(out).toContain('key=<redacted>');
        expect(out).not.toContain('secret');
    });

    it('redacts Authorization and standalone Bearer tokens', () => {
        const header = redactSecrets('Authorization: Bearer sk-abc123XYZ failed');
        const standalone = redactSecrets('got Bearer abc.def-ghi back');
        expect(header).not.toContain('sk-abc123XYZ');
        expect(standalone).toContain('Bearer <redacted>');
        expect(standalone).not.toContain('abc.def-ghi');
    });

    it('redacts x-goog-api-key header values', () => {
        const out = redactSecrets('x-goog-api-key: AIzaSyABCDEFG');
        expect(out).toContain('x-goog-api-key: <redacted>');
        expect(out).not.toContain('AIzaSyABCDEFG');
    });
});
