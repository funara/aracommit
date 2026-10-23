import { conventionalTemplate } from './formats/conventional';
import { emojiKarmaTemplate } from './formats/emojiKarma';
import { SUPPORTED_LANGUAGES } from '../utils/constants';
import type { CommitLanguage } from '../utils/constants';
import { Logger } from '../utils/logger';

type CommitTemplate = Record<Exclude<CommitLanguage, 'custom'>, string>;

export type CommitFormat = 'conventional' | 'emojiKarma';

const templates: Record<CommitFormat, CommitTemplate> = {
    conventional: conventionalTemplate,
    emojiKarma: emojiKarmaTemplate,
} as const;

const isValidFormat = (format: string): format is CommitFormat =>
    Object.keys(templates).includes(format);

type KnownLanguage = Exclude<CommitLanguage, 'custom'>;

const isValidLanguage = (language: string): language is KnownLanguage =>
    SUPPORTED_LANGUAGES.includes(language as CommitLanguage) && language !== 'custom';

export function getTemplate(format: CommitFormat, language: CommitLanguage): string {
    if (!isValidFormat(format)) {
        Logger.warn(`Invalid format "${format}", falling back to conventional`);
        format = 'conventional';
    }

    const template = templates[format];

    if (!isValidLanguage(language)) {
        if (language !== 'custom') {
            Logger.warn(`Invalid language "${language}", falling back to english`);
        }
        return template.english;
    }

    return template[language];
}