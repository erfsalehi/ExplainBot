import OpenAI from "openai";
import 'dotenv/config';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/erfsalehi/ExplainBot",
    "X-Title": "Blunt Explain Bot",
  }
});

async function testOpenRouter() {
  try {
    console.log("Testing OpenRouter connection with OpenAI SDK...");
    console.log("API Key:", process.env.OPENROUTER_API_KEY ? "Set" : "Not Set");
    
    const stream = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [
        { role: "user", content: "Hello, testing connection" }
      ],
      stream: true
    });

    console.log("Stream created successfully");
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testOpenRouter();