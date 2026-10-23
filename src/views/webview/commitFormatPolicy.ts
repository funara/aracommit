// Browser-safe policy shared by the settings view and extension host.
export function formatSupportsCommitlint(format: string): boolean {
    return format === 'conventional' || format === 'emojiKarma';
}
