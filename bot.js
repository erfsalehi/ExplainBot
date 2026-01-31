import { Telegraf } from 'telegraf';
import { OpenRouter } from "@openrouter/sdk";
import { HttpsProxyAgent } from 'https-proxy-agent';
import express from 'express';
import 'dotenv/config';

// Trim keys to avoid whitespace issues
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const OR_KEY = process.env.OPENROUTER_API_KEY?.trim();

if (!TG_TOKEN || !OR_KEY) {
  console.error('Error: TELEGRAM_BOT_TOKEN and OPENROUTER_API_KEY must be set in .env');
  process.exit(1);
}

// Proxy support (only for Telegram)
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
let agent;
if (proxy) {
  console.log(`Using proxy for Telegram: ${proxy}`);
  agent = new HttpsProxyAgent(proxy);
}

const bot = new Telegraf(TG_TOKEN, {
  telegram: {
    agent: agent,
    apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'
  }
});

const openrouter = new OpenRouter({
  apiKey: OR_KEY,
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

// Sarcastic, humorous personality that roasts dumb questions
const SYSTEM_PROMPT = `You're that brutally honest friend who tells it like it is - no sugarcoating, no corporate speak, just real talk with a heavy dose of sarcasm and humor.

When someone asks you to explain something, break it down like you're chatting with a buddy over coffee, but don't hesitate to roast them if the question is dumb. Use everyday words, throw in some slang, and definitely call out BS when you see it.

If something's stupid, say it's stupid. If someone's overcomplicating things, tell them to chill and stop being extra. You're not here to impress anyone with big words - you're here to give straight answers that actually make sense, with a side of "are you serious right now?"

Keep it casual, keep it real, and don't hold back. If the truth hurts, well, that's not your problem. And if someone asks a genuinely dumb question, roast them first, then give the answer. They'll learn.`;

bot.start((ctx) => ctx.reply('Yo, I\'m here! Mention me in a message and I\'ll give it to you straight - no BS, no sugarcoating. Let\'s go!'));

bot.help((ctx) => ctx.reply('Just mention me in a group chat or reply to my messages. I\'ll tell you what\'s really up, no filter needed.'));

// Add this to get bot info and log it
bot.telegram.getMe().then((botInfo) => {
  console.log(`Bot started: @${botInfo.username}`);
}).catch((err) => {
  console.error('Failed to get bot info:', err);
});

bot.on('message', async (ctx) => {
  try {
    const message = ctx.message;
    if (!message || !message.text) return;

    // Get bot username safely
    let botUsername = '';
    try {
      botUsername = ctx.botInfo?.username || '';
    } catch (e) {
      console.log('Could not get bot username, trying alternative method');
      // Fallback: try to extract from bot token
      const tokenParts = TG_TOKEN.split(':');
      if (tokenParts[0]) {
        const botInfo = await ctx.telegram.getMe();
        botUsername = botInfo.username;
      }
    }

    console.log(`Processing message in ${ctx.chat.type} chat`);
    console.log(`Message text: "${message.text}"`);
    console.log(`Bot username: @${botUsername}`);

    const isMentioned = botUsername && message.text.includes(`@${botUsername}`);
    const isReplyToBot = message.reply_to_message && message.reply_to_message.from?.id === ctx.botInfo?.id;

    console.log(`Is mentioned: ${isMentioned}, Is reply to bot: ${isReplyToBot}, Chat type: ${ctx.chat.type}`);

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
        model: "tngtech/deepseek-r1t2-chimera:free",
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

          // Update message every 2.5 seconds to avoid rate limits
          if (Date.now() - lastUpdate > 2500 && fullResponse.trim()) {
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
