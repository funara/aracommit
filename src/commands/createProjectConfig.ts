import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '../utils/logger';
import { toError } from '../utils/errorUtils';
import { statOrUndefined } from '../utils/fsUtils';

export async function createProjectConfig(): Promise<void> {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            await Logger.showError(vscode.l10n.t('No workspace folder found. Please open a project first.'));
            return;
        }

        const configDir = path.join(workspaceFolder.uri.fsPath, '.aracommit');
        const configPath = path.join(configDir, 'config.json');
        const dirStats = await statOrUndefined(configDir);
        const legacyExists = dirStats?.isFile() ?? false;
        const configExists = (await statOrUndefined(configPath)) !== undefined;

        if (legacyExists || configExists) {
            const openExisting = vscode.l10n.t('Open Existing');
            const overwrite = vscode.l10n.t('Overwrite');
            const cancel = vscode.l10n.t('Cancel');
            const selection = await Logger.showWarning(
                vscode.l10n.t('A .aracommit configuration already exists in this project.'),
                openExisting,
                overwrite,
                cancel
            );

            if (selection === openExisting) {
                const target = legacyExists ? configDir : configPath;
                const uri = vscode.Uri.file(target);
                void vscode.window.showTextDocument(uri);
                return;
            } else if (selection !== overwrite) {
                return;
            }

            if (legacyExists) {
                await fs.unlink(configDir);
            }
        }

        const templateConfig = {
            provider: {
                type: 'openrouter'
            },
            commit: {
                commitLanguage: 'english',
                commitFormat: 'conventional',
                useCustomInstructions: false,
                customInstructions: '',
                autoCommit: false,
                autoPush: false
            },
            gemini: {
                model: 'auto'
            },
            openrouter: {
                model: 'meta-llama/llama-3.3-70b-instruct:free'
            },
            openai: {
                model: 'gpt-3.5-turbo',
                baseUrl: 'https://api.openai.com/v1'
            },
            ollama: {
                baseUrl: 'http://localhost:11434',
                model: 'llama3.2'
            },
        };

        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(
            configPath,
            JSON.stringify(templateConfig, null, 2),
            'utf8'
        );

        Logger.log('Created .aracommit/config.json configuration file');

        const uri = vscode.Uri.file(configPath);
        void vscode.window.showTextDocument(uri);

        Logger.log('Project configuration file (.aracommit/config.json) has been created and opened for editing.');

    } catch (error) {
        Logger.error('Error creating .aracommit/config.json file:', toError(error));
        await Logger.showError(vscode.l10n.t('Failed to create .aracommit/config.json: {0}', toError(error).message));
    }
}
