import { Telegraf } from 'telegraf';
import { OpenRouter } from "@openrouter/sdk";
import { HttpsProxyAgent } from 'https-proxy-agent';
import express from 'express';
import 'dotenv/config';

if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.OPENROUTER_API_KEY) {
  console.error('Error: TELEGRAM_BOT_TOKEN and OPENROUTER_API_KEY must be set in .env');
  process.exit(1);
}

// Proxy support
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
let agent;
if (proxy) {
  console.log(`Using proxy: ${proxy}`);
  agent = new HttpsProxyAgent(proxy);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    agent: agent,
    apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'
  }
});

// Express for Webhooks & Health Checks
const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN; // e.g., https://your-app.onrender.com

app.get('/', (req, res) => res.send('Bot is alive!'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// Start Express server regardless of mode so Render is happy
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  // Optional headers for OpenRouter
  headers: {
    "HTTP-Referer": "https://github.com/erfsalehi/ExplainBot", // Optional, for including your app on openrouter.ai rankings.
    "X-Title": "Blunt Explain Bot", // Optional. Shows in rankings on openrouter.ai.
  }
});

// The "Grok-like" personality prompt
const SYSTEM_PROMPT = `You are a blunt, brutally honest, and slightly cynical AI assistant, similar to Grok. 
Your goal is to provide direct answers without sugarcoating. 
When asked to summarize, explain, or answer a question, be concise and honest. 
Don't be mean for no reason, but don't hold back the truth. 
Avoid corporate jargon and "as an AI model" disclaimers. 
Just give the raw, honest take.`;

bot.start((ctx) => ctx.reply('I am here. Mention me in a message to get a blunt, honest answer. No sugarcoating allowed.'));

bot.help((ctx) => ctx.reply('Mention me in a group chat or reply to my messages. I will give you the cold, hard truth.'));

bot.on('message', async (ctx) => {
  try {
    const message = ctx.message;
    if (!message || !message.text) return;

    const botUsername = ctx.botInfo.username;
    const isMentioned = message.text.includes(`@${botUsername}`);
    const isReplyToBot = message.reply_to_message && message.reply_to_message.from.id === ctx.botInfo.id;

    if (isMentioned || isReplyToBot || ctx.chat.type === 'private') {
      // Clean up the text by removing the bot mention
      let userQuery = message.text.replace(`@${botUsername}`, '').trim();
      
      // If it's a reply to another message (not the bot's message), 
      // the user probably wants to summarize/explain that message.
      let contextMessage = '';
      if (message.reply_to_message && !isReplyToBot) {
        contextMessage = `\n\nContext from the message you are replying to:\n"${message.reply_to_message.text}"`;
      }

      if (!userQuery && !contextMessage) return;

      await ctx.sendChatAction('typing');

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${userQuery}${contextMessage}` }
      ];

      const stream = await openrouter.chat.send({
        model: "deepseek/deepseek-r1:free", // Using the more reliable free model name
        messages: messages,
        stream: true
      });

      let fullResponse = '';
      let lastUpdate = Date.now();
      
      let replyMessage = await ctx.reply('Thinking...', { reply_to_message_id: message.message_id });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          
          // Telegram message limit is 4096 characters
          if (fullResponse.length > 4000) {
            fullResponse = fullResponse.substring(0, 4000) + '... [Truncated due to length]';
            break; 
          }

          // Update message every 2 seconds to avoid rate limits
          if (Date.now() - lastUpdate > 2000 && fullResponse.trim()) {
            try {
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                replyMessage.message_id,
                null,
                fullResponse + '...'
              );
              lastUpdate = Date.now();
            } catch (e) {
              // Ignore edit errors
            }
          }
        }
      }

      // Final update
      if (fullResponse.trim()) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          replyMessage.message_id,
          null,
          fullResponse
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          replyMessage.message_id,
          null,
          "I have nothing to say to that."
        );
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    // Log the specific error details for debugging in Render
    if (error.response) {
      console.error('OpenRouter Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    ctx.reply('Something went wrong. Even I have my limits.').catch(() => {});
  }
});

if (WEBHOOK_DOMAIN) {
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(secretPath));
  
  bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${secretPath}`)
    .then(() => console.log(`Webhook set to ${WEBHOOK_DOMAIN}${secretPath}`))
    .catch((err) => console.error('Failed to set webhook:', err));
} else {
  bot.launch().then(() => {
    console.log('Bot is running in POLLING mode...');
  }).catch((err) => {
    console.error('Failed to launch bot:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('\n--- NETWORK ERROR ---');
      console.error('It looks like your connection to Telegram is being blocked.');
      console.error('Please check your .env file and ensure HTTPS_PROXY or TELEGRAM_API_ROOT is set correctly.');
      console.error('----------------------\n');
    }
  });
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
