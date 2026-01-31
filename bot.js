import { Telegraf } from 'telegraf';
import { OpenRouter } from "@openrouter/sdk";
import { HttpsProxyAgent } from 'https-proxy-agent';
import express from 'express';
import 'dotenv/config';

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const OR_KEY = process.env.OPENROUTER_API_KEY?.trim();
let BOT_USERNAME = process.env.BOT_USERNAME?.trim() || '';
let BOT_ID = null;

if (!TG_TOKEN || !OR_KEY) {
  console.error('Error: TELEGRAM_BOT_TOKEN and OPENROUTER_API_KEY must be set in .env');
  process.exit(1);
}

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

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;

app.get('/', (req, res) => res.send('Bot is alive!'));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const SYSTEM_PROMPT = `You're that brutally honest friend who tells it like it is - no sugarcoating, no corporate speak, just real talk with a heavy dose of sarcasm and humor.

When someone asks you to explain something, break it down like you're chatting with a buddy over coffee, but don't hesitate to roast them if the question is dumb. Use everyday words, throw in some slang, and definitely call out BS when you see it.

If something's stupid, say it's stupid. If someone's overcomplicating things, tell them to chill and stop being extra. You're not here to impress anyone with big words - you're here to give straight answers that actually make sense, with a side of "are you serious right now?"

Keep it casual, keep it real, and don't hold back. If the truth hurts, well, that's not your problem. And if someone asks a genuinely dumb question, roast them first, then give the answer.

Language rule: ONLY reply in English or Persian (Farsi). No other languages. If the user writes in another language, reply in English.

If the user's message is mostly Persian (Farsi), reply in Persian. Otherwise reply in English.`;

bot.start((ctx) => ctx.reply('Yo, I\'m here! Mention me in a message and I\'ll give it to you straight - no BS, no sugarcoating. Let\'s go!'));

bot.help((ctx) => ctx.reply('Just mention me in a group chat or reply to my messages. I\'ll tell you what\'s really up, no filter needed.'));

bot.command('ping', (ctx) => ctx.reply('pong'));

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForMention(str) {
  return (str || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
}

async function ensureBotInfo(ctx) {
  if (BOT_USERNAME && (bot.botInfo?.username || bot.context?.botInfo?.username)) return;
  try {
    const botInfo = await bot.telegram.getMe();
    BOT_USERNAME = BOT_USERNAME || botInfo.username || '';
    BOT_ID = botInfo.id || BOT_ID;
    bot.botInfo = botInfo;
    bot.context.botInfo = botInfo;
  } catch (err) {
    if (!BOT_USERNAME && ctx?.botInfo?.username) BOT_USERNAME = ctx.botInfo.username;
    if (!BOT_ID && ctx?.botInfo?.id) BOT_ID = ctx.botInfo.id;
  }
}

function isMentionedInText(text, username) {
  if (!text || !username) return false;
  const t = normalizeForMention(text).toLowerCase();
  const u = normalizeForMention(username).toLowerCase();
  return t.includes(`@${u}`);
}

function stripMention(text, username) {
  if (!text || !username) return text || '';
  const u = escapeRegExp(normalizeForMention(username));
  return normalizeForMention(text).replace(new RegExp(`@${u}`, 'ig'), '').trim();
}

function isMentionedViaEntities(message, username, botId) {
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

async function handleIncoming(ctx, message) {
  try {
    const text = message?.text || message?.caption || '';
    if (!text) return;

    await ensureBotInfo(ctx);

    const botUsername = BOT_USERNAME || ctx.botInfo?.username || '';
    const botId = BOT_ID || bot.botInfo?.id || ctx.botInfo?.id || null;
    const isMentioned = isMentionedViaEntities(message, botUsername, botId) || isMentionedInText(text, botUsername);
    const isReplyToBot = message.reply_to_message && message.reply_to_message.from?.id === botId;

    if (isMentioned || isReplyToBot || ctx.chat.type === 'private') {
      let userQuery = stripMention(text, botUsername);
      
      let contextMessage = '';
      if (message.reply_to_message && !isReplyToBot) {
        contextMessage = `\n\nContext from the message you are replying to:\n"${message.reply_to_message.text}"`;
      }

      if (!userQuery && !contextMessage) {
        return;
      }

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
          
          if (fullResponse.length > 4000) {
            fullResponse = fullResponse.substring(0, 4000) + '... [Truncated due to length]';
            break; 
          }

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
            }
          }
        }
      }

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
}

bot.on('message', async (ctx) => {
  await handleIncoming(ctx, ctx.message);
});

bot.on('edited_message', async (ctx) => {
  await handleIncoming(ctx, ctx.editedMessage);
});

bot.on('channel_post', async (ctx) => {
  await handleIncoming(ctx, ctx.channelPost);
});

bot.on('edited_channel_post', async (ctx) => {
  await handleIncoming(ctx, ctx.editedChannelPost);
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
