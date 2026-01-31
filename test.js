// Consolidated test file for OpenRouter and environment
import { OpenRouter } from '@openrouter/sdk';
import 'dotenv/config';

const MODELS = {
    chimera: 'tngtech/deepseek-r1t2-chimera:free',
    deepseek: 'deepseek/deepseek-r1-0528:free',
};

async function testEnvironment() {
    console.log('\n=== Environment Check ===');
    console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Not Set');
    console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not Set');
    console.log('AI_MODEL:', process.env.AI_MODEL || '(using default)');
    console.log('WEBHOOK_DOMAIN:', process.env.WEBHOOK_DOMAIN || '(polling mode)');

    return process.env.OPENROUTER_API_KEY ? true : false;
}

async function testOpenRouter(modelKey = 'chimera') {
    const model = MODELS[modelKey] || MODELS.chimera;

    console.log(`\n=== Testing OpenRouter (${model}) ===`);

    const openrouter = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    try {
        const stream = await openrouter.chat.send({
            model,
            messages: [{ role: 'user', content: 'Say "test successful" in exactly 2 words.' }],
            stream: true,
        });

        console.log('Response: ');
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) process.stdout.write(content);
        }
        console.log('\n✓ Test passed!');
        return true;
    } catch (error) {
        console.error('✗ Error:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('ExplainBot Test Suite\n' + '='.repeat(40));

    const envOk = await testEnvironment();
    if (!envOk) {
        console.log('\n⚠ Skipping API tests (missing OPENROUTER_API_KEY)');
        return;
    }

    const modelArg = process.argv[2];
    await testOpenRouter(modelArg);
}

runTests();
