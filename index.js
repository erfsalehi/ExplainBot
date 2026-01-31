// Entry point - imports and starts the bot
import { startBot } from './src/bot.js';

startBot().catch((err) => {
    console.error('Fatal error starting bot:', err);
    process.exit(1);
});
