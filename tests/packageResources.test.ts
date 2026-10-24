import { it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ExtensionManifest {
    scripts: Record<string, string>;
    icon: string;
    l10n: string;
    contributes: {
        commands: Array<{ icon?: { light: string; dark: string } }>;
        viewsContainers: { activitybar: Array<{ icon: string }> };
        walkthroughs: Array<{ steps: Array<{ media: { markdown: string } }> }>;
    };
}

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as ExtensionManifest;

it('keeps the root build config out of source control but includes it in the VSIX', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    const vscodeRules = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8')
        .split(/\r?\n/)
        .map(rule => rule.trim())
        .filter(rule => rule && !rule.startsWith('#'));

    expect(gitignore).toContain('.env');
    expect(vscodeRules).toContain('.env.*');
    expect(vscodeRules).toContain('!.env');
    expect(vscodeRules).not.toContain('.env');
});

it('allows all VSIX scripts to package the root environment file', () => {
    for (const script of ['package', 'package:notsc', 'package:analyze']) {
        expect(manifest.scripts[script]).toContain('--allow-package-env-file');
    }
});

it('keeps packaged icons, localization, and walkthrough media paths valid', () => {
    const resources = [
        manifest.icon,
        manifest.l10n,
        ...manifest.contributes.commands.flatMap(command => command.icon ? [command.icon.light, command.icon.dark] : []),
        ...manifest.contributes.viewsContainers.activitybar.map(container => container.icon),
        ...manifest.contributes.walkthroughs.flatMap(walkthrough => walkthrough.steps.map(step => step.media.markdown)),
    ];

    for (const resource of resources) {
        expect(fs.existsSync(path.join(root, resource)), `${resource} is missing`).toBe(true);
    }
});
