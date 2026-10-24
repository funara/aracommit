import * as vscode from 'vscode';
import { ApiKeyManager } from '../services/apiKeyManager';
import { Logger } from '../utils/logger';
import { toError } from '../utils/errorUtils';
import { UserCancelledError } from '../models/errors';
import { PROVIDER_CATALOG } from '../services/providerCatalog';

/**
 * Registers the set/remove commands declared by provider metadata. Keyless
 * providers omit those commands and cannot be assigned one from the webview.
 */
export function registerSetApiKeyCommands(_context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    for (const meta of PROVIDER_CATALOG) {
        if (meta.setCmd) {
            disposables.push(vscode.commands.registerCommand(meta.setCmd, async () => {
                try {
                    await ApiKeyManager.promptForKey(meta.id);
                } catch (error) {
                    if (error instanceof UserCancelledError) {
                        return;
                    }
                    Logger.error(`Error setting ${meta.displayName} API key:`, toError(error));
                    await Logger.showError(
                        vscode.l10n.t('Failed to set API key: {0}', toError(error).message),
                    );
                }
            }));
        }
        if (meta.removeCmd) {
            disposables.push(vscode.commands.registerCommand(meta.removeCmd, async () => {
                try {
                    await ApiKeyManager.removeKey(meta.id);
                    await Logger.showInfo(
                        vscode.l10n.t('{0} API key has been removed', meta.displayName),
                    );
                } catch (error) {
                    Logger.error(`Error removing ${meta.displayName} API key:`, toError(error));
                    await Logger.showError(
                        vscode.l10n.t('Failed to remove API key: {0}', toError(error).message),
                    );
                }
            }));
        }
    }

    return disposables;
}
