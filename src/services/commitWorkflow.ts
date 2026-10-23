import * as vscode from 'vscode';
import { ConfigService } from '../utils/configService';
import { Logger } from '../utils/logger';
import { CommitMessage } from '../models/types';
import { GitService } from './gitService';
import { GitBlameAnalyzer } from './gitBlameAnalyzer';
import { AIService } from './aiService';
import { ApiKeyManager } from './apiKeyManager';
import { UserCancelledError, ApiKeyInvalidError } from '../models/errors';
import { toError } from '../utils/errorUtils';
import { mapLimit } from '../utils/concurrency';

const BLAME_CONCURRENCY = 8;
const MAX_API_KEY_RETRIES = 3;

export class CommitWorkflow {
    static async generateAndSetCommitMessage(
        sourceControlRepository?: vscode.SourceControl,
        apiKeyRetryCount: number = 0,
    ): Promise<void> {
        try {
            await this.initializeAndValidate();

            if (!sourceControlRepository) {
                const repos = await GitService.getRepositories();
                if (repos.length === 1) {
                    sourceControlRepository = repos[0];
                } else {
                    sourceControlRepository = await GitService.selectRepository(repos);
                }
            }

            // Pre-check API key if required for the provider
            const provider = ConfigService.getProvider();
            if (ApiKeyManager.requiresKeyForCurrentConfig(provider)) {
                await this.ensureApiKey(provider);
            }

            await this.executeWithProgress(async (progress, token) => {
                // Check for cancellation
                if (token.isCancellationRequested) {
                    throw new UserCancelledError();
                }

                const controller = new AbortController();
                const cancelSubscription = token.onCancellationRequested(() => {
                    controller.abort();
                });
                try {
                    const commitMessage = await this.generateAndApplyMessage(
                        progress,
                        sourceControlRepository!,
                        token,
                        controller.signal
                    );
                    Logger.log(`Commit message generated: ${commitMessage.message}`);
                } catch (error) {
                    // Anything that fails *after* the user hit Cancel is a
                    // symptom of the abort, not a real failure: git spawns and
                    // fetch both reject with AbortError, and Gemini's auto mode
                    // walks the rest of its fallback list first. Left as-is the
                    // user gets a spurious error popup for their own cancellation.
                    if (controller.signal.aborted && !(error instanceof UserCancelledError)) {
                        throw new UserCancelledError();
                    }
                    throw error;
                } finally {
                    cancelSubscription.dispose();
                }
            });
        } catch (error: unknown) {
            // Don't show error for user cancellation
            if (error instanceof UserCancelledError) {
                Logger.log('Operation cancelled by user');
                return;
            }

            if (error instanceof ApiKeyInvalidError) {
                Logger.error('Invalid API key', error);
                if (apiKeyRetryCount >= MAX_API_KEY_RETRIES) {
                    Logger.error('Max API key retries reached', error);
                    await this.handleError(new Error(
                        vscode.l10n.t('Invalid or expired API key. Maximum retry attempts reached.'),
                    ));
                    return;
                }
                const provider = ConfigService.getProvider();
                await this.handleInvalidApiKey(provider, sourceControlRepository, apiKeyRetryCount);
                return;
            }

            const err = toError(error);
            await this.handleError(err);
        }
    }

    private static async ensureApiKey(provider: string): Promise<void> {
        await ApiKeyManager.getKey(provider);
    }

    private static async handleInvalidApiKey(
        provider: string,
        sourceControlRepository?: vscode.SourceControl,
        apiKeyRetryCount: number = 0,
    ): Promise<void> {
        await Logger.showError(
            vscode.l10n.t('Invalid or expired API key. Please enter a new one.'),
        );

        try {
            await ApiKeyManager.removeKey(provider);
            await ApiKeyManager.promptForKey(provider);

            Logger.log('API key updated, retrying commit message generation');
            await this.generateAndSetCommitMessage(sourceControlRepository, apiKeyRetryCount + 1);
        } catch (error) {
            if (error instanceof UserCancelledError) {
                Logger.log('User cancelled API key update');
            }
        }
    }

    private static async initializeAndValidate(): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            throw new Error('No workspace folder is open');
        }
    }

    private static async executeWithProgress(
        action: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<void>
    ): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('ARACommit'),
                cancellable: true
            },
            action
        );
    }

    private static async generateAndApplyMessage(
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        sourceControlRepository: vscode.SourceControl,
        token: vscode.CancellationToken,
        signal: AbortSignal
    ): Promise<CommitMessage> {
        progress.report({ message: vscode.l10n.t('Analyzing changes…'), increment: 10 });

        if (token.isCancellationRequested) {
            throw new UserCancelledError();
        }

        if (!sourceControlRepository?.rootUri) {
            throw new Error('No Git repository found');
        }

        const repoPath = sourceControlRepository.rootUri.fsPath;
        const changedFiles = await GitService.getChangedFiles(repoPath, true, signal);
        if (changedFiles.length === 0) {
            throw new Error(vscode.l10n.t('No staged changes to analyze. Stage the changes you want to include.'));
        }

        if (token.isCancellationRequested) {
            throw new UserCancelledError();
        }

        const diff = await GitService.getDiff(repoPath, true, true, signal);
        if (!diff) {
            throw new Error(vscode.l10n.t('No staged changes to analyze. Stage the changes you want to include.'));
        }
        // hasHead is constant for the repo this run — resolve once instead of
        // per blame fan-out call.
        const hasHead = await GitService.hasHead(repoPath, signal);
        const blameAnalyses = await mapLimit(
            changedFiles,
            BLAME_CONCURRENCY,
            (file) => GitBlameAnalyzer.analyzeChanges(repoPath, file.path, file.status, true, signal, hasHead),
            signal,
        );
        const blameAnalysis = blameAnalyses.filter(Boolean).join('\n\n');

        if (token.isCancellationRequested) {
            throw new UserCancelledError();
        }

        const commitMessage = await AIService.generateCommitMessage(repoPath, diff, blameAnalysis, progress, {
            signal,
        });

        sourceControlRepository.inputBox.value = commitMessage.message;

        if (ConfigService.get('commit.autoCommit')) {
            await this.handleAutoCommit(sourceControlRepository);
        }

        return commitMessage;
    }

    private static async handleError(error: Error): Promise<void> {
        Logger.error('Error in CommitWorkflow:', error);
        await vscode.window.showErrorMessage(vscode.l10n.t('ARACommit: {0}', error.message));
    }

    private static async handleAutoCommit(
        repository: vscode.SourceControl,
    ): Promise<void> {
        // Last line of defense for the "a repo turns on auto-commit for you"
        // case. `restrictedConfigurations` covers the settings store and
        // `ConfigService` gates `.aracommit/config.json`, but writing to the
        // user's repo without their click is the one action worth checking at
        // the sink as well.
        if (!vscode.workspace.isTrusted) {
            Logger.warn('Auto-commit skipped: the workspace is not trusted.');
            return;
        }

        try {
            if (!repository.inputBox.value) {
                throw new Error('No commit message available');
            }

            await GitService.commitChanges(repository.inputBox.value, repository);

            if (ConfigService.get('commit.autoPush')) {
                await GitService.pushChanges(repository);
            }
        } catch (error) {
            Logger.error('Auto-commit/push failed:', toError(error));
            throw error;
        }
    }
}
