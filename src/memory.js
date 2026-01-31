// Conversation memory - in-memory store for conversation history
import { config } from './config.js';
import { logger } from './logger.js';

// Structure: Map<chatId, { messages: [{role, content, timestamp}], lastActivity: Date }>
const conversations = new Map();

/**
 * Get conversation history for a chat
 */
export function getConversation(chatId) {
    const conv = conversations.get(chatId);
    if (!conv) return [];

    // Filter out expired messages and return
    const cutoff = Date.now() - (config.conversationTTL * 60 * 1000);
    return conv.messages.filter(m => m.timestamp > cutoff);
}

/**
 * Add a message to conversation history
 */
export function addMessage(chatId, role, content) {
    if (!conversations.has(chatId)) {
        conversations.set(chatId, { messages: [], lastActivity: Date.now() });
    }

    const conv = conversations.get(chatId);
    conv.messages.push({
        role,
        content,
        timestamp: Date.now(),
    });
    conv.lastActivity = Date.now();

    // Trim to max messages (keep system + recent)
    if (conv.messages.length > config.maxConversationMessages) {
        conv.messages = conv.messages.slice(-config.maxConversationMessages);
    }
}

/**
 * Clear conversation history for a chat
 */
export function clearConversation(chatId) {
    conversations.delete(chatId);
    logger.debug('Cleared conversation', { chatId });
}

/**
 * Cleanup expired conversations (call periodically)
 */
export function cleanupConversations() {
    const cutoff = Date.now() - (config.conversationTTL * 60 * 1000);
    let cleaned = 0;

    for (const [chatId, conv] of conversations.entries()) {
        if (conv.lastActivity < cutoff) {
            conversations.delete(chatId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.debug('Cleaned up expired conversations', { count: cleaned });
    }
}

/**
 * Get memory stats
 */
export function getMemoryStats() {
    return {
        activeConversations: conversations.size,
        totalMessages: Array.from(conversations.values()).reduce((sum, c) => sum + c.messages.length, 0),
    };
}

// Cleanup every 5 minutes
setInterval(cleanupConversations, 5 * 60 * 1000);
