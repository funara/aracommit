import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/e2e/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.ts'],
            // VS Code glue is covered by extension-host tests, not unit tests.
            // The DOM-free / acquireVsCodeApi-free webview modules (popup,
            // combobox, widgets, preserveFocus, dom) ARE unit-tested via
            // happy-dom; only the entry point and vscode-api glue stay excluded.
            exclude: [
                'src/**/*.d.ts',
                'src/models/types.ts',
                'src/views/webview/main.ts',
                'src/views/webview/init.ts',
                'src/views/webview/vscodeApi.ts',
                'src/views/webview/sections.ts',
                'src/views/webview/section.ts',
                'src/extension.ts',
                'src/views/settingsWebviewProvider.ts',
                'src/services/aiService.ts',
                'src/services/commitWorkflow.ts',
                'src/commands/**',
            ],
        },
    },
    resolve: {
        alias: {
            vscode: resolve(__dirname, 'tests/__mocks__/vscode.ts'),
        },
    },
});
