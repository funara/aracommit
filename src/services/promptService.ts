import { CommitFormat, getTemplate } from '../templates';
import { ConfigService } from '../utils/configService';
import { CommitLintService, CommitLintEngine } from './commitLintService';
import { CustomLanguageService } from './customLanguageService';
import type { CommitLanguage } from '../utils/constants';
import type { ProgressReporter } from '../models/types';

const STRICT_FORMAT_REMINDER = `STRICT OUTPUT RULES — these override any tendency to be verbose, even on large diffs:
- Write ONE commit message a reviewer can understand without reading the diff.
- Output ONLY the commit message. No preamble, no explanation, no closing remark.
- No markdown bold (**text**), no headings, no code fences.
- First (subject) line MUST stay within the format's character limit (typically 50).
- Body bullets MUST start with "- ", each ≤ 50 chars, max 5 bullets total.
- Explain WHY the change was made — its intent, the problem it solves, or its effect — not a line-by-line restatement of the diff.
- Do not list every changed file; summarise.
- Produce exactly ONE commit message for the whole diff, even when it spans multiple files or concerns.`;

const LANGUAGE_PROMPTS: Record<Exclude<CommitLanguage, 'custom'>, string> = {
    english: 'Please write the commit message in English.',
    indonesian: 'Tulis pesan commit dalam bahasa Indonesia.',
    russian: 'Пожалуйста, напиши сообщение коммита на русском языке.',
    chinese: '请用中文写提交信息。',
    japanese: 'コミットメッセージを日本語で書いてください。',
    spanish: 'Por favor, escribe el mensaje del commit en español.',
    korean: '커밋 메시지를 한국어로 작성해 주세요.',
    german: 'Bitte schreiben Sie die Commit-Nachricht auf Deutsch.',
    french: 'Veuillez rédiger le message de commit en français.',
    portuguese: 'Por favor, escreva a mensagem do commit em português brasileiro.',
};

export class PromptService {
    private static async resolveLanguagePrompt(format: CommitFormat, progress: ProgressReporter): Promise<{ template: string; languagePrompt: string }> {
        const commitLanguage = ConfigService.get('commit.commitLanguage');

        let template: string;
        let languagePrompt: string;

        if (commitLanguage === 'custom') {
            const customLanguageName = ConfigService.get('commit.customLanguageName');
            template = await CustomLanguageService.getTemplate(format, customLanguageName, progress);
            languagePrompt = customLanguageName.trim()
                ? `Please write the commit message in ${customLanguageName}.`
                : LANGUAGE_PROMPTS.english;
        } else {
            const lang = commitLanguage as Exclude<CommitLanguage, 'custom'>;
            template = getTemplate(format, lang);
            languagePrompt = LANGUAGE_PROMPTS[lang] ?? LANGUAGE_PROMPTS.english;
        }

        return { template, languagePrompt };
    }

    /**
     * Resolve the active commitlint rule set as prompt text. Shared by
     * `generatePrompt` (appends it to the format template) and
     * `generateRefinementPrompt` (lists it for the fix-up), which previously
     * each hand-read `rulesPath` + `engine` and called `extractRules`.
     */
    private static loadRules(repoPath: string, format: string): Promise<string> {
        const rulesPath = ConfigService.get('commit.commitlint.rulesPath');
        const engine = ConfigService.get('commit.commitlint.engine') as CommitLintEngine;
        return CommitLintService.extractRules(repoPath, rulesPath, { engine, format });
    }

    private static buildPrompt(mainInstructions: string, languagePrompt: string, diff: string, blameAnalysis: string): string {
        return `
${mainInstructions}

${languagePrompt}

Git diff to analyze:
${diff}

Git blame analysis:
${blameAnalysis}

${STRICT_FORMAT_REMINDER}

Please provide ONLY the commit message, without any additional text or explanations.
`;
    }

    static async generatePrompt(repoPath: string, diff: string, blameAnalysis: string, progress: ProgressReporter): Promise<string> {
        const useCustomInstructions = ConfigService.get('commit.useCustomInstructions');
        const customInstructions = ConfigService.get('commit.customInstructions');

        if (useCustomInstructions && customInstructions.trim()) {
            return `${customInstructions}

Git diff to analyze:
${diff}

Git blame analysis:
${blameAnalysis}

${STRICT_FORMAT_REMINDER}

Please provide ONLY the commit message, without any additional text or explanations.`;
        }

        const configuredFormat = ConfigService.get('commit.commitFormat');
        const format: CommitFormat = configuredFormat === 'emojiKarma' ? 'emojiKarma' : 'conventional';
        const { template, languagePrompt } = await this.resolveLanguagePrompt(format, progress);

        let mainInstructions = template;
        if (ConfigService.get('commit.commitlint.enabled')) {
            const rules = await this.loadRules(repoPath, format);
            mainInstructions = `${template}\n\n${rules}`;
        }

        return this.buildPrompt(mainInstructions, languagePrompt, diff, blameAnalysis);
    }

    static async generateRefinementPrompt(repoPath: string, originalMessage: string, errors: string[], progress: ProgressReporter): Promise<string> {
        const configuredFormat = ConfigService.get('commit.commitFormat');
        const format: CommitFormat = configuredFormat === 'emojiKarma' ? 'emojiKarma' : 'conventional';
        const { languagePrompt } = await this.resolveLanguagePrompt(format, progress);

        // Full rule set included so the model doesn't fix one rule while breaking another
        const rules = await this.loadRules(repoPath, format);

        return `The following commit message failed validation:

${originalMessage}

Validation errors:
${errors.map(e => `- ${e}`).join('\n')}

${rules}

Rewrite the commit message fixing all the errors above while keeping every rule satisfied.
${languagePrompt}

${STRICT_FORMAT_REMINDER}

Please provide ONLY the corrected commit message, without any additional text or explanations.
`;
    }
}