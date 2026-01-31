# Blunt Explain Bot (Grok-style)

A Telegram bot that provides blunt, honest, and cynical answers using OpenRouter's DeepSeek R1 model.

## Features

- **Blunt Personality**: Responds like Grok (direct, honest, cynical).
- **Group Chat Support**: Mention the bot in a group to get an answer.
- **Context Awareness**: Reply to a message and mention the bot to summarize or explain that specific message.
- **Streaming Responses**: See the bot's response as it's being generated.

## Setup

1. **Get a Telegram Bot Token**:
   - Talk to [@BotFather](https://t.me/botfather) on Telegram.
   - Create a new bot and get the token.
   - **Important**: Use `/setprivacy` and set it to `DISABLED` if you want the bot to see all messages in groups, OR just mention the bot when you want a response.

2. **Get an OpenRouter API Key**:
   - Sign up at [OpenRouter.ai](https://openrouter.ai/).
   - Create an API key.

3. **Configure Environment Variables**:
   - Create a `.env` file in the root directory (you can copy `.env.example`).
   - Add your tokens:
     ```env
     TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
     OPENROUTER_API_KEY=your_openrouter_api_key_here
     ```

4. **Install Dependencies**:
   ```bash
   npm install
   ```

## Hosting on Render (Free Tier)

1. **Create a GitHub Repository**: Push your code to a new private repository on GitHub.
2. **Sign up for [Render](https://render.com/)**.
3. **Create a New Web Service**:
   - Connect your GitHub repo.
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Configure Environment Variables** in Render's dashboard:
   - `TELEGRAM_BOT_TOKEN`: Your token.
   - `OPENROUTER_API_KEY`: Your key.
   - `WEBHOOK_DOMAIN`: The URL Render gives you (e.g., `https://explain-bot.onrender.com`).
   - `BOT_USERNAME`: Your bot username without `@` (e.g., `ExplainUsiBot`).
5. **Why Webhooks?**: By using webhooks, Telegram will "wake up" your bot whenever a new message arrives, even if Render has put it to sleep due to inactivity.

## Keeping It Awake (Free Tier)

Free hosting can go idle. If the bot feels “dead”, open this in a browser to wake it up:

- `https://YOUR-SERVICE.onrender.com/health` (should return `OK`)

If you want fewer cold-start delays, you can use an uptime monitor to ping `/health` every few minutes.

## Local Development (Polling)
If you just want to run it locally and don't have network blocks:
- Leave `WEBHOOK_DOMAIN` empty in your `.env`.
- Run `npm start`.

## Usage

- **In Groups**: Mention the bot (e.g., `@YourBotName What is the meaning of life?`).
- **Summarizing**: Reply to a long message and mention the bot with "Summarize this".
- **Explaining**: Reply to a complex message and mention the bot with "Explain this simply".
- **Private Chat**: Just send a message directly to the bot.
