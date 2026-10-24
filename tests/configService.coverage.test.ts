import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ConfigService, SETTING_DEFAULTS } from '../src/utils/configService';
import { parseAndValidateProjectConfig } from '../src/utils/projectConfigParser';

/** Point ConfigService at a real temp folder via a single workspace folder. */
function setWorkspaceFolder(fsPath: string | undefined): void {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders =
        fsPath === undefined
            ? undefined
            : [{ uri: { fsPath }, name: 'ws', index: 0 }];
}

beforeEach(() => {
    ConfigService.clearCache();
    (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = null;
});

afterEach(() => {
    vi.restoreAllMocks();
    ConfigService.clearCache();
    (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = null;
    setWorkspaceFolder(undefined);
});

describe('ConfigService.get / getConfig layering', () => {
    it('returns the SETTING_DEFAULTS default when nothing overrides it', () => {
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
        expect(ConfigService.get('gitTimeout')).toBe(120);
        expect(ConfigService.get('provider.type')).toBe('araAssistant');
    });

    it('caches the resolved value (second read does not re-inspect)', () => {
        const getConfiguration = vi.spyOn(vscode.workspace, 'getConfiguration');
        ConfigService.get('commit.autoCommit');
        const callsAfterFirst = getConfiguration.mock.calls.length;
        ConfigService.get('commit.autoCommit');
        // Cache hit: no additional getConfiguration call.
        expect(getConfiguration.mock.calls.length).toBe(callsAfterFirst);
    });

    it('prefers a project-config value over user/workspace settings', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            commit: { autoCommit: true },
        };
        expect(ConfigService.get('commit.autoCommit')).toBe(true);
    });

    it('honors workspaceValue > globalValue > defaultValue ordering from inspect', () => {
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: <T>(_k: string, d?: T) => d,
            update: async () => undefined,
            inspect: <T>() => ({
                key: 'k',
                workspaceValue: 'openrouter' as unknown as T,
                globalValue: 'openai' as unknown as T,
                defaultValue: 'gemini' as unknown as T,
            }),
        } as unknown as vscode.WorkspaceConfiguration);
        expect(ConfigService.get('provider.type')).toBe('openrouter');
    });

    it('falls back to defaultValue when getConfiguration throws (catch path)', () => {
        vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation(() => {
            throw new Error('config explosion');
        });
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
        expect(ConfigService.get('gitTimeout')).toBe(120);
    });

    it('getConfig with an empty section uses the bare key and the passed default', () => {
        // Empty section -> configKey is the bare leaf; with no override the
        // passed-in default is returned.
        expect(ConfigService.getConfig('', 'someBareKey', 99)).toBe(99);
    });
});

describe('ConfigService.isProjectOverridden', () => {
    it('is true when the project config pins the key', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            commit: { autoCommit: true },
        };
        expect(ConfigService.isProjectOverridden('commit.autoCommit')).toBe(true);
    });

    it('is false when the project config does not pin the key', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {};
        expect(ConfigService.isProjectOverridden('commit.autoCommit')).toBe(false);
    });

    it('handles a single-segment key', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            gitTimeout: 5,
        };
        expect(ConfigService.isProjectOverridden('gitTimeout')).toBe(true);
        expect(ConfigService.isProjectOverridden('apiRequestTimeout')).toBe(false);
    });
});

describe('ConfigService.getProvider', () => {
    it('returns the configured provider when valid', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            provider: { type: 'openai' },
        };
        expect(ConfigService.getProvider()).toBe('openai');
    });

    it('falls back to the default provider for an unknown provider', () => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            provider: { type: 'totally-made-up' },
        };
        expect(ConfigService.getProvider()).toBe('araAssistant');
    });
});

describe('ConfigService.getModel', () => {
    const cases: Array<[string, string, string]> = [
        ['anthropic', 'anthropic.model', 'claude-sonnet-5-5'],
        ['gemini', 'gemini.model', 'gemini-3-8-flash'],
        ['ollama', 'ollama.model', 'llama3.2'],
        ['openai', 'openai.model', 'gpt-3.5-turbo'],
        ['openrouter', 'openrouter.model', 'meta-llama/llama-3.3-70b-instruct:free'],
        ['deepseek', 'deepseek.model', 'deepseek-v4-1-flash'],
        ['xai', 'xai.model', 'grok-4-7'],
        ['custom', 'custom.model', ''],
    ];

    it.each(cases)('returns the %s model', (provider, _key, expected) => {
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            provider: { type: provider },
        };
        expect(ConfigService.getModel()).toBe(expected);
    });
});

describe('ConfigService.dispose', () => {
    it('disposes registered disposables and clears caches without a watcher', () => {
        const dispose = vi.fn();
        (ConfigService as unknown as { disposables: vscode.Disposable[] }).disposables = [
            { dispose },
        ];
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            commit: { autoCommit: true },
        };
        ConfigService.dispose();
        expect(dispose).toHaveBeenCalled();
        expect(
            (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache,
        ).toBeNull();
    });

    it('disposes the project-config file watcher when present', () => {
        const watcherDispose = vi.fn();
        (ConfigService as unknown as {
            projectConfigFileWatcher: vscode.FileSystemWatcher | null;
        }).projectConfigFileWatcher = { dispose: watcherDispose } as unknown as vscode.FileSystemWatcher;
        ConfigService.dispose();
        expect(watcherDispose).toHaveBeenCalled();
        expect(
            (ConfigService as unknown as { projectConfigFileWatcher: unknown })
                .projectConfigFileWatcher,
        ).toBeNull();
    });
});

describe('ConfigService.initialize openai.baseUrl normalization', () => {
    it('normalizes the baseUrl on a config change and writes it back', async () => {
        // Capture the registered config-change listener.
        let listener: ((e: unknown) => void) | undefined;
        vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(
            (l: (e: unknown) => void) => {
                listener = l;
                return { dispose: () => undefined };
            },
        );
        const update = vi.fn(async () => undefined);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: <T>(_k: string, d?: T) => d,
            update,
            inspect: <T>(key: string) =>
                key === 'openai.baseUrl'
                    ? { key, globalValue: 'example.com/v1/' as unknown as T }
                    : undefined,
        } as unknown as vscode.WorkspaceConfiguration);
        // workspaceFolders undefined -> migrate/load/watcher early-return cleanly.
        const ctx = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        await ConfigService.initialize(ctx);
        expect(listener).toBeDefined();

        listener!({
            affectsConfiguration: (key: string) =>
                key === 'aracommit' || key === 'aracommit.openai.baseUrl',
        });

        expect(update).toHaveBeenCalledWith(
            'openai.baseUrl',
            'https://example.com/v1',
            true,
        );

        ConfigService.dispose();
    });

    it('logs (does not throw) when the baseUrl write-back fails', async () => {
        let listener: ((e: unknown) => void) | undefined;
        vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(
            (l: (e: unknown) => void) => {
                listener = l;
                return { dispose: () => undefined };
            },
        );
        // `config.update(...)` is invoked with `void`; throwing *synchronously*
        // from the call is what reaches the catch block (an async rejection
        // would become an unhandled rejection, not caught here).
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: <T>(_k: string, d?: T) => d,
            update: () => {
                throw new Error('update failed');
            },
            inspect: <T>(key: string) =>
                key === 'openai.baseUrl'
                    ? { key, globalValue: 'http://h/v1' as unknown as T }
                    : undefined,
        } as unknown as vscode.WorkspaceConfiguration);
        const ctx = { subscriptions: [] } as unknown as vscode.ExtensionContext;

        await ConfigService.initialize(ctx);
        expect(() =>
            listener!({
                affectsConfiguration: (key: string) =>
                    key === 'aracommit' || key === 'aracommit.openai.baseUrl',
            }),
        ).not.toThrow();

        ConfigService.dispose();
    });

    it('clears cache on a generic aracommit change without baseUrl', async () => {
        let listener: ((e: unknown) => void) | undefined;
        vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(
            (l: (e: unknown) => void) => {
                listener = l;
                return { dispose: () => undefined };
            },
        );
        const ctx = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        await ConfigService.initialize(ctx);
        // Prime the cache.
        ConfigService.get('commit.autoCommit');
        listener!({
            affectsConfiguration: (key: string) => key === 'aracommit',
        });
        // No throw; cache cleared internally.
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
        ConfigService.dispose();
    });
});

describe('ConfigService.getProjectRootPath (multi-root)', () => {
    it('returns undefined when there are no workspace folders', () => {
        setWorkspaceFolder(undefined);
        expect(ConfigService.getProjectRootPath()).toBeUndefined();
    });

    it('returns the single folder path', () => {
        setWorkspaceFolder('/only/root');
        expect(ConfigService.getProjectRootPath()).toBe('/only/root');
    });

    it('prefers the folder owning the active editor in a multi-root workspace', () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
            { uri: { fsPath: '/rootA' }, name: 'a', index: 0 },
            { uri: { fsPath: '/rootB' }, name: 'b', index: 1 },
        ];
        (vscode.window as { activeTextEditor: unknown }).activeTextEditor = {
            document: { uri: { fsPath: '/rootB/x.ts' } },
        };
        (vscode.workspace as { getWorkspaceFolder: unknown }).getWorkspaceFolder = () => ({
            uri: { fsPath: '/rootB' },
        });
        try {
            expect(ConfigService.getProjectRootPath()).toBe('/rootB');
        } finally {
            (vscode.window as { activeTextEditor: unknown }).activeTextEditor = undefined;
            delete (vscode.workspace as { getWorkspaceFolder?: unknown }).getWorkspaceFolder;
        }
    });

    it('falls back to the first folder when no editor folder matches', () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
            { uri: { fsPath: '/rootA' }, name: 'a', index: 0 },
            { uri: { fsPath: '/rootB' }, name: 'b', index: 1 },
        ];
        (vscode.window as { activeTextEditor: unknown }).activeTextEditor = {
            document: { uri: { fsPath: '/elsewhere/x.ts' } },
        };
        (vscode.workspace as { getWorkspaceFolder: unknown }).getWorkspaceFolder = () => undefined;
        try {
            expect(ConfigService.getProjectRootPath()).toBe('/rootA');
        } finally {
            (vscode.window as { activeTextEditor: unknown }).activeTextEditor = undefined;
            delete (vscode.workspace as { getWorkspaceFolder?: unknown }).getWorkspaceFolder;
        }
    });
});

describe('ConfigService project-config loading from disk', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aracommit-cfg-cov-'));
        setWorkspaceFolder(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const loadProjectConfig = () =>
        (ConfigService as unknown as { loadProjectConfig: () => Promise<void> }).loadProjectConfig();

    it('loads from the .aracommit/config.json directory layout', async () => {
        const dir = path.join(tmpDir, '.aracommit');
        fs.mkdirSync(dir);
        fs.writeFileSync(
            path.join(dir, 'config.json'),
            JSON.stringify({ commit: { autoCommit: true } }),
        );
        await loadProjectConfig();
        expect(ConfigService.get('commit.autoCommit')).toBe(true);
    });

    it('loads from the legacy .aracommit file layout', async () => {
        fs.writeFileSync(
            path.join(tmpDir, '.aracommit'),
            JSON.stringify({ commit: { autoCommit: true } }),
        );
        await loadProjectConfig();
        expect(ConfigService.get('commit.autoCommit')).toBe(true);
    });

    it('yields an empty cache when no project config exists', async () => {
        await loadProjectConfig();
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
    });

    it('yields an empty cache (and logs) on a read/parse error', async () => {
        const dir = path.join(tmpDir, '.aracommit');
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'config.json'), '{ not valid json');
        await loadProjectConfig();
        // Parse failed -> cache empty -> defaults.
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
    });

    it('with no workspace folder sets an empty cache', async () => {
        setWorkspaceFolder(undefined);
        await loadProjectConfig();
        expect(ConfigService.get('commit.autoCommit')).toBe(false);
    });
});

describe('ConfigService.setProjectConfigValue', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aracommit-setpc-'));
        setWorkspaceFolder(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const configPath = () => path.join(tmpDir, '.aracommit', 'config.json');

    it('creates .aracommit/config.json with a nested key and refreshes the cache', async () => {
        await ConfigService.setProjectConfigValue('commit.commitlint.rulesPath', './config');
        const written = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
        expect(written.commit.commitlint.rulesPath).toBe('./config');
        expect(ConfigService.get('commit.commitlint.rulesPath')).toBe('./config');
    });

    it('merges into an existing config without dropping other keys', async () => {
        const dir = path.join(tmpDir, '.aracommit');
        fs.mkdirSync(dir);
        fs.writeFileSync(configPath(), JSON.stringify({ commit: { autoCommit: true } }));
        await ConfigService.setProjectConfigValue('commit.commitlint.rulesPath', './config');
        const written = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
        expect(written.commit.autoCommit).toBe(true);
        expect(written.commit.commitlint.rulesPath).toBe('./config');
    });

    it('refuses prototype-polluting key segments', async () => {
        for (const key of ['__proto__.polluted', 'commit.constructor', 'prototype.x']) {
            await expect(ConfigService.setProjectConfigValue(key, 'x')).rejects.toThrow(
                /unsafe config key/,
            );
        }
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(fs.existsSync(configPath())).toBe(false);
    });

    it('overwrites a broken existing config rather than throwing', async () => {
        const dir = path.join(tmpDir, '.aracommit');
        fs.mkdirSync(dir);
        fs.writeFileSync(configPath(), '{ not valid json');
        await ConfigService.setProjectConfigValue('commit.commitlint.rulesPath', './config');
        const written = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
        expect(written.commit.commitlint.rulesPath).toBe('./config');
    });

    it('throws when no workspace folder is open', async () => {
        setWorkspaceFolder(undefined);
        await expect(ConfigService.setProjectConfigValue('commit.commitlint.rulesPath', 'X')).rejects.toThrow();
    });
});

describe('parseAndValidateProjectConfig edge cases', () => {
    const parse = (raw: string) =>
        parseAndValidateProjectConfig(raw, 'test-source', SETTING_DEFAULTS) as Record<string, unknown>;

    it('returns {} when the top level is not an object', () => {
        expect(parse(JSON.stringify(['array']))).toEqual({});
        expect(parse(JSON.stringify('a string'))).toEqual({});
    });

    it('drops reserved prototype-chain section names', () => {
        const out = parse('{"__proto__": {"polluted": true}, "commit": {"autoCommit": true}}');
        expect(out.commit).toEqual({ autoCommit: true });
        expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('skips a section whose value is not an object', () => {
        const out = parse(JSON.stringify({ commit: false, other: { k: 1 } }));
        expect(out.commit).toBeUndefined();
    });

    it('passes through unknown keys and drops wrong-typed known keys', () => {
        const out = parse(
            JSON.stringify({
                commit: { autoCommit: 'wrong-type', futureSetting: 'kept' },
            }),
        ) as { commit: Record<string, unknown> };
        expect(out.commit.autoCommit).toBeUndefined();
        expect(out.commit.futureSetting).toBe('kept');
    });
});

describe('ConfigService.migrateProjectConfig', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aracommit-mig-'));
        setWorkspaceFolder(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const migrate = () =>
        (ConfigService as unknown as { migrateProjectConfig: () => Promise<void> }).migrateProjectConfig();

    it('moves a legacy .aracommit file into .aracommit/config.json', async () => {
        const legacy = path.join(tmpDir, '.aracommit');
        fs.writeFileSync(legacy, JSON.stringify({ commit: { autoCommit: true } }));
        await migrate();
        const migrated = path.join(tmpDir, '.aracommit', 'config.json');
        expect(fs.existsSync(migrated)).toBe(true);
        expect(fs.statSync(path.join(tmpDir, '.aracommit')).isDirectory()).toBe(true);
    });

    it('logs and does not throw on invalid legacy JSON', async () => {
        const legacy = path.join(tmpDir, '.aracommit');
        fs.writeFileSync(legacy, '{ broken');
        await expect(migrate()).resolves.toBeUndefined();
        // The broken file is left untouched (still a file).
        expect(fs.statSync(legacy).isFile()).toBe(true);
    });

    it('is a no-op when there is no workspace folder', async () => {
        setWorkspaceFolder(undefined);
        await expect(migrate()).resolves.toBeUndefined();
    });

    it('is a no-op when the legacy path is already a directory', async () => {
        fs.mkdirSync(path.join(tmpDir, '.aracommit'));
        await expect(migrate()).resolves.toBeUndefined();
    });
});

describe('ConfigService.initialize watcher wiring', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aracommit-init-'));
        setWorkspaceFolder(tmpDir);
    });

    afterEach(() => {
        ConfigService.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('registers a project-config file watcher and routes change events', async () => {
        const onDidChange = vi.fn();
        const onDidCreate = vi.fn();
        const onDidDelete = vi.fn();
        let changeHandler: (() => void) | undefined;
        onDidChange.mockImplementation((h: () => void) => {
            changeHandler = h;
            return { dispose: () => undefined };
        });
        const watcher = {
            onDidChange,
            onDidCreate,
            onDidDelete,
            dispose: () => undefined,
        };
        vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue(
            watcher as unknown as vscode.FileSystemWatcher,
        );
        // RelativePattern is referenced in initializeProjectConfigWatcher.
        (vscode as { RelativePattern: unknown }).RelativePattern = class {
            constructor(public base: unknown, public pattern: string) {}
        };

        const ctx = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        await ConfigService.initialize(ctx);

        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
        expect(onDidCreate).toHaveBeenCalled();
        expect(onDidDelete).toHaveBeenCalled();
        // Firing the captured change handler reloads config without throwing.
        expect(() => changeHandler?.()).not.toThrow();
    });
});

describe('ConfigService private-path edge cases', () => {
    it('getProjectRootPath returns undefined for an empty folders array', () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [];
        expect(ConfigService.getProjectRootPath()).toBeUndefined();
    });

    it('hasValidProjectConfig returns valid:true when there is no workspace root', async () => {
        setWorkspaceFolder(undefined);
        await expect(ConfigService.hasValidProjectConfig()).resolves.toEqual({
            valid: true,
        });
    });

    it('getNestedProjectValue stops when a mid-path segment is a primitive', () => {
        // commit is a primitive where an object section is expected -> isProjectOverridden false.
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            commit: 'not-an-object',
        };
        expect(ConfigService.isProjectOverridden('commit.autoCommit')).toBe(false);
    });

    it('getNestedProjectValue returns undefined when the project config root is not an object', () => {
        // Force a non-object root so the very first isPlainObject(current) guard fails.
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache =
            'corrupt' as unknown;
        const result = (
            ConfigService as unknown as {
                getNestedProjectValue: (s: string[]) => unknown;
            }
        ).getNestedProjectValue(['commit', 'autoCommit']);
        expect(result).toBeUndefined();
    });

    it('getNestedProjectValue returns undefined when descending into a primitive leaf-parent', () => {
        // provider.type.extra: provider.type is a string, so descending further fails.
        (ConfigService as unknown as { projectConfigCache: unknown }).projectConfigCache = {
            provider: { type: 'gemini' },
        };
        const result = (
            ConfigService as unknown as {
                getNestedProjectValue: (s: string[]) => unknown;
            }
        ).getNestedProjectValue(['provider', 'type', 'extra']);
        expect(result).toBeUndefined();
    });

    it('validateAndNormalizeEndpoint returns "" for an empty endpoint', () => {
        const normalize = (
            ConfigService as unknown as {
                validateAndNormalizeEndpoint: (e: string) => string;
            }
        ).validateAndNormalizeEndpoint;
        expect(normalize.call(ConfigService, '')).toBe('');
    });

    it('validateAndNormalizeEndpoint adds https:// and strips a trailing slash', () => {
        const normalize = (
            ConfigService as unknown as {
                validateAndNormalizeEndpoint: (e: string) => string;
            }
        ).validateAndNormalizeEndpoint;
        expect(normalize.call(ConfigService, 'host/api/')).toBe('https://host/api');
        expect(normalize.call(ConfigService, 'http://host/api')).toBe('http://host/api');
    });
});

describe('ConfigService.onProjectConfigChange dispose idempotency (branch 98)', () => {
    it('dispose is a no-op when the listener was already removed', () => {
        const sub = ConfigService.onProjectConfigChange(() => undefined);
        sub.dispose(); // idx >= 0 -> splice
        // Second dispose: indexOf returns -1 -> the `idx >= 0` guard is false.
        expect(() => sub.dispose()).not.toThrow();
    });
});

describe('ConfigService.initialize config-listener branches', () => {
    let listener: ((e: unknown) => void) | undefined;

    function captureListener(): void {
        vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(
            (l: (e: unknown) => void) => {
                listener = l;
                return { dispose: () => undefined };
            },
        );
    }

    afterEach(() => {
        ConfigService.dispose();
        listener = undefined;
    });

    it('ignores a change that does not affect aracommit (branch 135 false)', async () => {
        captureListener();
        const clearSpy = vi.spyOn(ConfigService, 'clearCache');
        await ConfigService.initialize({ subscriptions: [] } as unknown as vscode.ExtensionContext);
        clearSpy.mockClear();
        listener!({ affectsConfiguration: () => false });
        // Not affecting aracommit -> clearCache not called from the listener body.
        expect(clearSpy).not.toHaveBeenCalled();
    });

    it('skips the baseUrl normalization when the resolved baseUrl is empty (branch 139 false)', async () => {
        captureListener();
        // Resolve openai.baseUrl to an empty string so `if (baseUrl)` is false.
        const update = vi.fn(async () => undefined);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: <T>(_k: string, d?: T) => d,
            update,
            inspect: <T>(key: string) =>
                key === 'openai.baseUrl'
                    ? { key, globalValue: '' as unknown as T }
                    : undefined,
        } as unknown as vscode.WorkspaceConfiguration);
        await ConfigService.initialize({ subscriptions: [] } as unknown as vscode.ExtensionContext);
        listener!({
            affectsConfiguration: (key: string) =>
                key === 'aracommit' || key === 'aracommit.openai.baseUrl',
        });
        // baseUrl empty -> no write-back attempted.
        expect(update).not.toHaveBeenCalled();
    });
});
