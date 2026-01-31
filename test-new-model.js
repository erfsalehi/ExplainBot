import { OpenRouter } from "@openrouter/sdk";
import 'dotenv/config';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function testOpenRouter() {
  try {
    console.log("Testing OpenRouter connection...");
    console.log("API Key:", process.env.OPENROUTER_API_KEY ? "Set" : "Not Set");
    
    const stream = await openrouter.chat.send({
      model: "tngtech/deepseek-r1t2-chimera:free",
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