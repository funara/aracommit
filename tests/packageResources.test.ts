import { it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ExtensionManifest {
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
