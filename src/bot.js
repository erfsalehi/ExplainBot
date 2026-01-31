import { Telegraf } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { validateConfig, config } from './config.js';
import { logger } from './logger.js';
import { app, startServer } from './server.js';
import { SYSTEM_PROMPT, createChatStream, processStream } from './ai.js';
import { addMessage, clearConversation, getConversation } from './memory.js';
import { isMentionedInText, isMentionedViaEntities, stripMention } from './utils.js';

export async function startBot() {
    validateConfig();

    const agent = config.proxy ? new HttpsProxyAgent(config.proxy) : undefined;

    const bot = new Telegraf(config.telegramToken, {
        telegram: {
            agent,
            apiRoot: config.telegramApiRoot,
        },
    });

    const botInfo = await bot.telegram.getMe();
    const botId = botInfo.id;
    const botUsername = (config.botUsername || botInfo.username || '').replace(/^@/, '');

    logger.info('Bot initialized', { username: botUsername ? `@${botUsername}` : '', botId, webhookMode: !!config.webhookDomain });

    bot.start((ctx) => ctx.reply('Yo, I\'m here. Mention me and I\'ll answer like a normal human with an attitude.'));
    bot.help((ctx) => ctx.reply('Mention me in a group or DM me. I reply in English or فارسی فقط.'));
    bot.command('ping', (ctx) => ctx.reply('pong'));
    bot.command('clear', (ctx) => {
        clearConversation(ctx.chat.id);
        return ctx.reply('Done. I wiped the chat memory. Try not to waste it again.');
    });

    async function maybeRespond(ctx, message) {
        const text = message?.text || message?.caption || '';
        if (!text) return;

        const mentioned = isMentionedViaEntities(message, botUsername, botId) || isMentionedInText(text, botUsername);
        const replyToBot = message?.reply_to_message?.from?.id === botId;
        const isPrivate = ctx.chat?.type === 'private';

        if (!isPrivate && !mentioned && !replyToBot) return;

        const userQuery = stripMention(text, botUsername);

        let contextMessage = '';
        const repliedText = message?.reply_to_message?.text || message?.reply_to_message?.caption || '';
        if (message?.reply_to_message && !replyToBot && repliedText) {
            contextMessage = `\n\nContext from the message you are replying to:\n"${repliedText}"`;
        }

        if (!userQuery && !contextMessage) return;

        const chatId = ctx.chat.id;
        const combinedUser = `${userQuery}${contextMessage}`.trim();

        addMessage(chatId, 'user', combinedUser);

        const history = getConversation(chatId).map((m) => ({ role: m.role, content: m.content }));
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

        await ctx.sendChatAction('typing');

        const placeholder = await ctx.reply('Thinking...', { reply_to_message_id: message.message_id });

        const stream = await createChatStream(messages);

        let lastUpdate = Date.now();
        const response = await processStream(stream, async (partial) => {
            if (Date.now() - lastUpdate < 2500) return;
            if (!partial.trim()) return;
            try {
                await ctx.telegram.editMessageText(ctx.chat.id, placeholder.message_id, null, partial + '...');
                lastUpdate = Date.now();
            } catch (e) {
            }
        });

        addMessage(chatId, 'assistant', response);

        const finalText = response.trim() ? response : 'Nothing to say.';
        try {
            await ctx.telegram.editMessageText(ctx.chat.id, placeholder.message_id, null, finalText);
        } catch (e) {
            await ctx.reply(finalText, { reply_to_message_id: message.message_id });
        }
    }

    bot.on('message', (ctx) => maybeRespond(ctx, ctx.message));
    bot.on('edited_message', (ctx) => maybeRespond(ctx, ctx.editedMessage));
    bot.on('channel_post', (ctx) => maybeRespond(ctx, ctx.channelPost));
    bot.on('edited_channel_post', (ctx) => maybeRespond(ctx, ctx.editedChannelPost));

    await startServer();

    if (config.webhookDomain) {
        const secretPath = `/telegraf/${bot.secretPathComponent()}`;
        app.use(secretPath, bot.webhookCallback(secretPath));
        await bot.telegram.setWebhook(`${config.webhookDomain}${secretPath}`);
        logger.info('Webhook set', { url: `${config.webhookDomain}${secretPath}` });
    } else {
        await bot.launch();
        logger.info('Bot launched (polling mode)');
    }

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
