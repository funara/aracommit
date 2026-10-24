import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const build = (args: string[], values: Record<string, string>) => spawnSync(
    process.execPath,
    ['esbuild.js', ...args],
    {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ...values },
    },
);

const syntheticConfig = {
    ARA_ASSISTANT_ENDPOINT: 'https://gateway.example/v1',
    ARA_ASSISTANT_PRIMARY_MODEL: 'test-primary',
    ARA_ASSISTANT_SECONDARY_MODEL: 'test-secondary',
};
const emptyConfig = {
    ARA_ASSISTANT_ENDPOINT: '',
    ARA_ASSISTANT_PRIMARY_MODEL: '',
    ARA_ASSISTANT_SECONDARY_MODEL: '',
};

describe('ARA Assistant build configuration', () => {
    it('injects synthetic HTTPS routes into the production extension bundle', () => {
        const result = build(['--production'], syntheticConfig);
        expect(result.status, result.stderr).toBe(0);

        const bundle = fs.readFileSync(path.join(root, 'dist', 'extension.js'), 'utf8');
        expect(bundle).toContain(syntheticConfig.ARA_ASSISTANT_ENDPOINT);
        expect(bundle).toContain(syntheticConfig.ARA_ASSISTANT_PRIMARY_MODEL);
        expect(bundle).toContain(syntheticConfig.ARA_ASSISTANT_SECONDARY_MODEL);
    }, 30_000);

    it('allows development and production builds without ARA configuration', () => {
        for (const args of [[], ['--production']]) {
            const result = build(args, emptyConfig);
            expect(result.status, result.stderr).toBe(0);
        }
    }, 30_000);

    it('rejects partial ARA configuration for production builds', () => {
        const result = build(['--production'], {
            ...syntheticConfig,
            ARA_ASSISTANT_SECONDARY_MODEL: '   ',
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Configure all ARA_ASSISTANT_* values before building the extension.');
    });

    it.each([
        ['non-HTTPS', 'http://gateway.example/v1'],
        ['credentials', 'https://user:secret@gateway.example/v1'],
        ['query', 'https://gateway.example/v1?token=secret'],
        ['fragment', 'https://gateway.example/v1#fragment'],
    ])('rejects an endpoint with %s for production builds', (_reason, endpoint) => {
        const result = build(['--production'], {
            ...syntheticConfig,
            ARA_ASSISTANT_ENDPOINT: endpoint,
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(
            'ARA_ASSISTANT_ENDPOINT must be an HTTPS URL without credentials, query, or fragment.',
        );
    });
});
