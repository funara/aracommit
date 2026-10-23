import { describe, it, expect } from 'vitest';
import { getTemplate } from '../src/templates/index';
import type { CommitFormat } from '../src/templates/index';
import { conventionalTemplate } from '../src/templates/formats/conventional';
import { emojiKarmaTemplate } from '../src/templates/formats/emojiKarma';

const allTemplates = {
    conventional: conventionalTemplate,
    emojiKarma: emojiKarmaTemplate,
};

describe('available commit format templates', () => {
    for (const [name, template] of Object.entries(allTemplates)) {
        it(`${name} includes English and Indonesian prompts`, () => {
            expect(template.english.length).toBeGreaterThan(0);
            expect(template.indonesian.length).toBeGreaterThan(0);
        });
    }
});

describe('getTemplate', () => {
    it('returns the requested format and language', () => {
        expect(getTemplate('conventional', 'english')).toBe(conventionalTemplate.english);
        expect(getTemplate('emojiKarma', 'indonesian')).toBe(emojiKarmaTemplate.indonesian);
    });

    it('falls back to Conventional for an unknown format', () => {
        expect(getTemplate('nope' as CommitFormat, 'english')).toBe(conventionalTemplate.english);
    });

    it('falls back to English for an unknown language', () => {
        expect(getTemplate('conventional', 'klingon' as never)).toBe(conventionalTemplate.english);
    });

    it('falls back to English for custom language without a translation', () => {
        expect(getTemplate('conventional', 'custom')).toBe(conventionalTemplate.english);
    });
});
