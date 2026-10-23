import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { activateExtension } from '../helpers/settings';

const EXPECTED_COMMANDS = [
    'aracommit.generateCommitMessage',
    'aracommit.setApiKey',
    'aracommit.setOpenAIApiKey',
    'aracommit.removeApiKey',
    'aracommit.removeOpenAIApiKey',
    'aracommit.setOllamaAuthToken',
    'aracommit.removeOllamaAuthToken',
    'aracommit.createProjectConfig',
    'aracommit.selectGeminiModel',
];

const EXPECTED_VIEW_COMMANDS = [
    'aracommit.settings.focus',
];

describe('Activation', () => {
    before(async () => {
        await activateExtension();
    });

    it('extension is active', async () => {
        const ext = vscode.extensions.getExtension('funara.aracommit');
        assert.ok(ext);
        assert.equal(ext.isActive, true);
    });

    it('all contributed commands are registered', async () => {
        const registered = new Set(await vscode.commands.getCommands(true));
        for (const cmd of EXPECTED_COMMANDS) {
            assert.ok(registered.has(cmd), `command ${cmd} is not registered`);
        }
    });

    it('webview view is contributed', async () => {
        const registered = new Set(await vscode.commands.getCommands(true));
        for (const cmd of EXPECTED_VIEW_COMMANDS) {
            assert.ok(registered.has(cmd), `view focus command ${cmd} is not registered`);
        }
    });

    it('vscode.git built-in extension is available', () => {
        const git = vscode.extensions.getExtension('vscode.git');
        assert.ok(git, 'vscode.git extension missing');
        assert.equal(git.isActive, true);
    });
});
