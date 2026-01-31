// Configuration module - loads and validates environment variables
import 'dotenv/config';

export const config = {
  // Required
  telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
  openRouterKey: process.env.OPENROUTER_API_KEY?.trim(),
  
  // Optional with defaults
  botUsername: process.env.BOT_USERNAME?.trim() || '',
  port: parseInt(process.env.PORT || '3000', 10),
  webhookDomain: process.env.WEBHOOK_DOMAIN?.trim() || '',
  telegramApiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
  
  // AI Configuration
  aiModel: process.env.AI_MODEL || 'tngtech/deepseek-r1t2-chimera:free',
  maxResponseLength: parseInt(process.env.MAX_RESPONSE_LENGTH || '4000', 10),
  
  // Retry configuration
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  
  // Conversation memory
  conversationTTL: parseInt(process.env.CONVERSATION_TTL_MINUTES || '30', 10), // minutes
  maxConversationMessages: parseInt(process.env.MAX_CONVERSATION_MESSAGES || '10', 10),
  
  // Proxy
  proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '',
};

// Validate required config
export function validateConfig() {
  const errors = [];
  
  if (!config.telegramToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  
  if (!config.openRouterKey) {
    errors.push('OPENROUTER_API_KEY is required');
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
