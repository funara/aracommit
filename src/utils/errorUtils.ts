export function toError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error(String(error));
}

const PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/)[^\s:,'"]{1,256}\.[a-zA-Z]{1,16}/g;
const URL_KEY_PATTERN = /([?&])key=[^&\s'"]+/gi;
const BEARER_PATTERN = /Bearer\s+[A-Z0-9._-]+/gi;
const GOOGLE_API_KEY_HEADER = /x-goog-api-key:\s*[^\s'",]+/gi;
// Consumes the scheme too (`Authorization: Bearer sk-…`), otherwise only the
// word "Bearer" is masked and the token survives.
const AUTHORIZATION_HEADER = /Authorization:\s*(?:[A-Za-z]+\s+)?[^\s'",]+/gi;

/**
 * Strip API secrets (auth headers, `?key=` query params) from arbitrary text.
 * Separate from `redactSecrets` so callers can redact credentials without
 * replacing readable file paths in local diagnostics.
 */
export function redactApiSecrets(text: string): string {
    return text
        .replace(URL_KEY_PATTERN, '$1key=<redacted>')
        .replace(BEARER_PATTERN, 'Bearer <redacted>')
        .replace(GOOGLE_API_KEY_HEADER, 'x-goog-api-key: <redacted>')
        .replace(AUTHORIZATION_HEADER, 'Authorization: <redacted>');
}

/** Strip filesystem paths and API secrets from arbitrary text. */
export function redactSecrets(text: string): string {
    return redactApiSecrets(text.replace(PATH_PATTERN, '<path>'));
}

