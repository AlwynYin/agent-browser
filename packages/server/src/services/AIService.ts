import OpenAI from 'openai';
import {loadConfig} from '../config';

export class AIService {
    private openai: OpenAI | null = null;
    private initialized = false;

    private ensureInitialized() {
        if (!this.initialized) {
            const config = loadConfig();
            console.log(`🔑 AIService initializing... API key present: ${!!config.openaiApiKey}`);
            this.openai = config.openaiApiKey ? new OpenAI({
                apiKey: config.openaiApiKey,
            }) : null;
            this.initialized = true;
            console.log(`✅ AIService initialized. Available: ${this.openai !== null}`);
        }
    }

    isAvailable(): boolean {
        this.ensureInitialized();
        return this.openai !== null;
    }

    async generateResponse(messages: any[], modelName: string = 'gpt-4'): Promise<string> {
        this.ensureInitialized();
        if (!this.openai) {
            console.log('❌ AIService.generateResponse: OpenAI client not available');
            throw new Error('AI service is not available. Please configure OpenAI API key.');
        }

        console.log(`🤖 AIService making OpenAI request with model: ${modelName}`);
        console.log(`📝 Message count: ${messages.length}`);

        const response = await this.openai.chat.completions.create({
            model: modelName,
            messages: messages,
        });

        const content = response.choices[0].message.content || '';
        console.log(`✅ OpenAI response received, length: ${content.length} characters`);
        
        return content;
    }

    async generateStructuredResponse<T>(messages: any[], modelName: string = 'gpt-4'): Promise<T> {
        const responseText = await this.generateResponse(messages, modelName);
        
        console.log(`🔄 Parsing JSON response...`);
        console.log(`📄 Raw response preview: ${responseText}...`);
        
        try {
            const parsed = JSON.parse(responseText) as T;
            console.log(`✅ JSON parsed successfully`);
            return parsed;
        } catch (error) {
            console.log(`❌ JSON parse failed: ${error.message}`);
            console.log(`📄 Full response that failed to parse: ${responseText}`);
            throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
        }
    }
}

export const aiService = new AIService();