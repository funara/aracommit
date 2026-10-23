import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ConfigService } from '../utils/configService';

export class SettingsValidator {
    static async validateAllSettings(): Promise<void> {
        await this.validateProjectConfig();
        await this.validateAutoPushState();
        await this.validateCustomInstructions();
    }

    static async validateProjectConfig(): Promise<void> {
        const result = await ConfigService.hasValidProjectConfig();
        if (result.valid) {
            if (result.configPath) {
                Logger.log('Project configuration (.aracommit/config.json) validated successfully');
            }
            return;
        }

        Logger.error('Error validating .aracommit file:', result.error ?? new Error('Unknown error'));

        const openTitle = vscode.l10n.t('Open File');
        const ignoreTitle = vscode.l10n.t('Ignore');
        const selection = await vscode.window.showErrorMessage(
            vscode.l10n.t('Invalid .aracommit configuration file. The file contains syntax errors.'),
            {
                modal: true,
                detail: vscode.l10n.t('The project configuration file has JSON syntax errors that prevent it from being loaded.'),
            },
            { title: openTitle, isCloseAffordance: false },
            { title: ignoreTitle, isCloseAffordance: true }
        );

        if (selection?.title === openTitle && result.configPath) {
            const uri = vscode.Uri.file(result.configPath);
            void vscode.window.showTextDocument(uri);
        }
    }

    static async validateAutoPushState(): Promise<void> {
        const isAutoPushEnabled = ConfigService.get('commit.autoPush');
        const isAutoCommitEnabled = ConfigService.get('commit.autoCommit');

        if (isAutoPushEnabled && !isAutoCommitEnabled) {
            const enableAutoCommit = vscode.l10n.t('Enable Auto Commit');
            const disableAutoPush = vscode.l10n.t('Disable Auto Push');
            const openSettings = vscode.l10n.t('Open Settings');
            const selection = await Logger.showWarning(
                vscode.l10n.t('Auto Push requires Auto Commit to be enabled. Choose an action:'),
                enableAutoCommit,
                disableAutoPush,
                openSettings
            );

            if (selection === enableAutoCommit) {
                const config = vscode.workspace.getConfiguration('aracommit');
                await config.update('commit.autoCommit', true, true);
                Logger.log('Auto Commit has been enabled');
            } else if (selection === disableAutoPush) {
                const config = vscode.workspace.getConfiguration('aracommit');
                await config.update('commit.autoPush', false, true);
                Logger.log('Auto Push has been disabled');
            } else if (selection === openSettings) {
                void vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'aracommit.commit'
                );
            }
        }
    }

    static async validateCustomInstructions(): Promise<void> {
        const useCustomInstructions = ConfigService.get('commit.useCustomInstructions');
        const instructions = ConfigService.get('commit.customInstructions');

        if (useCustomInstructions && !instructions.trim()) {
            void Logger.showWarning(
                vscode.l10n.t('Custom Instructions are enabled but empty. Please add some instructions.')
            );
        }
    }

}
