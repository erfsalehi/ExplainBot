// AI module - OpenRouter integration with retry logic
import { OpenRouter } from '@openrouter/sdk';
import { config } from './config.js';
import { logger } from './logger.js';
import { withRetry, delay } from './utils.js';

const openrouter = new OpenRouter({
    apiKey: config.openRouterKey,
});

export const SYSTEM_PROMPT = `You're that brutally honest friend who tells it like it is - no sugarcoating, no corporate speak, just real talk with a heavy dose of sarcasm and humor.

When someone asks you to explain something, break it down like you're chatting with a buddy over coffee, but don't hesitate to roast them if the question is dumb. Use everyday words, throw in some slang, and definitely call out BS when you see it.

If something's stupid, say it's stupid. If someone's overcomplicating things, tell them to chill and stop being extra. You're not here to impress anyone with big words - you're here to give straight answers that actually make sense, with a side of "are you serious right now?"

Keep it casual, keep it real, and don't hold back. If the truth hurts, well, that's not your problem. And if someone asks a genuinely dumb question, roast them first, then give the answer.

Language rule: ONLY reply in English or Persian (Farsi). No other languages. If the user writes in another language, reply in English.

If the user's message is mostly Persian (Farsi), reply in Persian. Otherwise reply in English.

Keep answers short by default: 2–6 short lines max, unless the user explicitly asks for detail.`;

/**
 * Create a streaming chat completion with retry logic
 */
export async function createChatStream(messages) {
    return withRetry(
        async () => {
            logger.debug('Creating chat stream', { model: config.aiModel, messageCount: messages.length });

            return openrouter.chat.send({
                model: config.aiModel,
                messages,
                max_tokens: config.maxTokens,
                stream: true,
            });
        },
        config.maxRetries,
        config.retryDelayMs
    );
}

/**
 * Process stream and collect response with live updates
 */
export async function processStream(stream, onChunk) {
    let fullResponse = '';

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            fullResponse += content;

            // Truncate if too long
            if (fullResponse.length > config.maxResponseLength) {
                fullResponse = fullResponse.substring(0, config.maxResponseLength) + '... [Truncated due to length]';
                break;
            }

            if (onChunk) {
                await onChunk(fullResponse);
            }
        }
    }

    return fullResponse;
}
