// Utility functions for text processing

/**
 * Escape special regex characters in a string
 */
export function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize text for mention comparison - removes zero-width chars and normalizes unicode
 */
export function normalizeForMention(str) {
    return (str || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
}

/**
 * Check if bot is mentioned in text
 */
export function isMentionedInText(text, username) {
    if (!text || !username) return false;
    const t = normalizeForMention(text).toLowerCase();
    const u = normalizeForMention(username).toLowerCase();
    return t.includes(`@${u}`);
}

/**
 * Remove bot mention from text
 */
export function stripMention(text, username) {
    if (!text || !username) return text || '';
    const u = escapeRegExp(normalizeForMention(username));
    return normalizeForMention(text).replace(new RegExp(`@${u}`, 'ig'), '').trim();
}

/**
 * Check if bot is mentioned via Telegram entities
 */
export function isMentionedViaEntities(message, username, botId) {
    const text = message?.text || message?.caption || '';
    const entities = message?.entities || message?.caption_entities || [];

    if (!entities.length || !text || (!username && !botId)) return false;

    const lowered = normalizeForMention(username).toLowerCase();

    for (const entity of entities) {
        if (entity.type === 'mention' && username) {
            const mentionText = normalizeForMention(text.slice(entity.offset, entity.offset + entity.length))
                .replace(/[^@a-z0-9_]/gi, '')
                .toLowerCase();
            if (mentionText === `@${lowered}`) return true;
        }
        if (entity.type === 'text_mention' && botId && entity.user?.id === botId) return true;
    }

    return false;
}

/**
 * Delay helper for retry logic
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with exponential backoff retry
 */
export async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries - 1) {
                const delayMs = baseDelayMs * Math.pow(2, attempt);
                await delay(delayMs);
            }
        }
    }

    throw lastError;
}
