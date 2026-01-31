// Express server for health checks and webhooks
import express from 'express';
import { config } from './config.js';
import { logger } from './logger.js';
import { getMemoryStats } from './memory.js';

export const app = express();

// Health check endpoint with detailed status
app.get('/', (req, res) => res.send('Bot is alive!'));

app.get('/health', (req, res) => {
    const memStats = getMemoryStats();

    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            ...memStats,
        },
        config: {
            model: config.aiModel,
            webhookMode: !!config.webhookDomain,
        },
    });
});

/**
 * Start the Express server
 */
export function startServer() {
    return new Promise((resolve) => {
        app.listen(config.port, () => {
            logger.info('Server started', { port: config.port });
            resolve();
        });
    });
}
