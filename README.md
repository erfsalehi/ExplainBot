# ExplainBot - Blunt AI Telegram Bot

A Telegram bot that provides brutally honest, sarcastic answers using OpenRouter AI. No sugarcoating, no corporate speak - just real talk.

## Features

- **Blunt Personality**: Responds with sarcasm and brutal honesty
- **Group Chat Support**: Mention the bot in groups
- **Context Awareness**: Reply to messages for summarization/explanation
- **Conversation Memory**: Remembers recent chat history (configurable TTL)
- **Streaming Responses**: See responses as they're generated
- **Rate Limit Handling**: Automatic retry with exponential backoff
- **Configurable Model**: Switch AI models via environment variable

## Quick Start

1. **Get tokens**:
   - Telegram: Talk to [@BotFather](https://t.me/botfather)
   - OpenRouter: Sign up at [OpenRouter.ai](https://openrouter.ai/)

2. **Configure**:
   ```bash
   cp .env.example .env
   # Edit .env with your tokens
   ```

3. **Run**:
   ```bash
   npm install
   npm start
   ```

## Configuration

See `.env.example` for all options. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | Required |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `AI_MODEL` | AI model to use | `tngtech/deepseek-r1t2-chimera:free` |
| `CONVERSATION_TTL_MINUTES` | Memory duration | `30` |
| `MAX_RESPONSE_LENGTH` | Max response chars | `4000` |

## Commands

- `/start` - Initialize the bot
- `/help` - Show usage info
- `/clear` - Clear conversation memory
- `/ping` - Health check

## Project Structure

```
├── index.js          # Entry point
├── src/
│   ├── bot.js        # Telegram handlers
│   ├── ai.js         # OpenRouter integration
│   ├── memory.js     # Conversation history
│   ├── config.js     # Configuration
│   ├── logger.js     # Structured logging
│   ├── server.js     # Health check server
│   └── utils.js      # Utility functions
├── test.js           # Test suite
└── .env.example      # Config template
```

## Deployment (Render/Railway)

1. Push to GitHub
2. Connect repo to hosting platform
3. Set environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `OPENROUTER_API_KEY`
   - `WEBHOOK_DOMAIN` (your app URL)
4. Deploy!

## Testing

```bash
npm test              # Run tests with default model
npm run test:deepseek # Test with DeepSeek model
```

## License

MIT
