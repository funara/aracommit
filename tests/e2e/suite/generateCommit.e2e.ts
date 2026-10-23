import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { MockLlmServer } from '../helpers/mockLlmServer';
import {
    cleanupRepo,
    getRepository,
    git,
    makeTempRepo,
    purgeSampleWorkspace,
    TempRepo,
} from '../helpers/tempRepo';
import {
    activateExtension,
    ensureOpenAIKey,
    resetCommitSettings,
    setProviderToMockOpenAI,
} from '../helpers/settings';
import { installDefaultUiStubs, restoreStubs } from '../helpers/vscodeStubs';

describe('Commit message generation', () => {
    let mock: MockLlmServer;
    let baseUrl: string;
    let repo: TempRepo;

    before(async () => {
        await activateExtension();
        await purgeSampleWorkspace();
        mock = new MockLlmServer();
        ({ baseUrl } = await mock.start());
        await setProviderToMockOpenAI(baseUrl);
        await ensureOpenAIKey();
    });

    after(async () => {
        await mock.stop();
        await purgeSampleWorkspace();
    });

    beforeEach(async () => {
        await resetCommitSettings();
        installDefaultUiStubs({ inputBox: 'e2e-test-key' });
        repo = await makeTempRepo({ initialCommit: true });
    });

    afterEach(async () => {
        mock.reset();
        restoreStubs();
        await cleanupRepo(repo);
    });

    it('writes generated message into SCM input box (modified + staged file)', async () => {
        const file = path.join(repo.path, 'README.md');
        await fs.appendFile(file, '\nmodified\n');
        await git(repo.path, 'add', 'README.md');

        await vscode.commands.executeCommand('aracommit.generateCommitMessage');

        const r = getRepository(repo.path);
        assert.equal(r.inputBox.value, 'feat: test commit message');

        assert.equal(mock.requests.length, 1);
        const body = mock.requests[0].body as { messages: { content: string }[] };
        assert.ok(body.messages?.[0]?.content?.includes('README.md'),
            `prompt should contain README.md, got: ${body.messages?.[0]?.content?.slice(0, 200)}`);
    });

    it('does not generate or auto-commit when only an untracked file exists', async () => {
        await vscode.workspace.getConfiguration('aracommit')
            .update('commit.autoCommit', true, vscode.ConfigurationTarget.Workspace);
        await fs.writeFile(path.join(repo.path, 'NEW.txt'), 'hello\n');

        await vscode.commands.executeCommand('aracommit.generateCommitMessage');

        const log = await git(repo.path, 'log', '--oneline');
        assert.equal(log.split('\n').filter(Boolean).length, 1,
            `unstaged worktree must not be committed, log:\n${log}`);
        assert.ok((await git(repo.path, 'status', '--porcelain')).includes('?? NEW.txt'));
        assert.equal(mock.requests.length, 0, 'no provider request without staged changes');
    });

    it('does not stage or auto-commit an unstaged deletion', async () => {
        await vscode.workspace.getConfiguration('aracommit')
            .update('commit.autoCommit', true, vscode.ConfigurationTarget.Workspace);
        await fs.rm(path.join(repo.path, 'README.md'));
        assert.equal((await git(repo.path, 'diff', '--cached', '--name-only')).trim(), '');
        assert.match(await git(repo.path, 'status', '--porcelain'), /^ D README\.md/m);
        assert.equal(mock.requests.length, 0, 'mock request log should be clean before generation');

        await vscode.commands.executeCommand('aracommit.generateCommitMessage', getRepository(repo.path));

        const log = await git(repo.path, 'log', '--oneline');
        assert.equal(log.split('\n').filter(Boolean).length, 1,
            `unstaged deletion must not be committed, log:\n${log}`);
        assert.match(await git(repo.path, 'status', '--porcelain'), /^ D README\.md/m);
        assert.equal(mock.requests.length, 0, 'no provider request without staged changes');
    });

    it('always generates from staged content only, including partially staged files', async () => {
        const file = path.join(repo.path, 'staged.txt');
        await fs.writeFile(file, 'staged content\n');
        await git(repo.path, 'add', 'staged.txt');
        await fs.appendFile(file, 'unstaged content\n');
        await fs.writeFile(path.join(repo.path, 'untracked.txt'), 'untracked content\n');

        await vscode.commands.executeCommand('aracommit.generateCommitMessage');

        assert.equal(mock.requests.length, 1);
        const prompt = (mock.requests[0].body as { messages: { content: string }[] })
            .messages[0].content;
        assert.ok(prompt.includes('staged.txt'));
        assert.ok(prompt.includes('staged content'));
        assert.ok(!prompt.includes('unstaged content'));
        assert.ok(!prompt.includes('untracked.txt'));
    });

    it('auto-commits only the staged snapshot and leaves unstaged edits alone', async () => {
        await vscode.workspace.getConfiguration('aracommit')
            .update('commit.autoCommit', true, vscode.ConfigurationTarget.Workspace);
        const file = path.join(repo.path, 'staged.txt');
        await fs.writeFile(file, 'staged snapshot\n');
        await git(repo.path, 'add', 'staged.txt');
        await fs.appendFile(file, 'unstaged follow-up\n');
        await fs.writeFile(path.join(repo.path, 'untracked.txt'), 'leave untracked\n');

        await vscode.commands.executeCommand('aracommit.generateCommitMessage');

        assert.equal((await git(repo.path, 'show', 'HEAD:staged.txt')).trim(), 'staged snapshot');
        const status = await git(repo.path, 'status', '--porcelain');
        assert.match(status, /^ M staged\.txt/m);
        assert.match(status, /^\?\? untracked\.txt/m);
    });
});
