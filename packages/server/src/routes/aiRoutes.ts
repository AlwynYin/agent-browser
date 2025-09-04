import {Router, Request, Response} from 'express';
import {aiService} from '../services/AIService';
import {orchestratorAgent, browserAgent} from '../agents/index';

export function createAIRouter(): Router {
    const router = Router();

    // AI endpoint for testing OpenAI integration
    router.post('/llm', async (req: Request, res: Response) => {
        console.log(`🤖 AI request received`);

        // Check if OpenAI service is available
        if (!aiService.isAvailable()) {
            console.log(`❌ OpenAI service not available - no API key configured`);
            res.status(503).send({error: 'AI service is not available. Please configure OpenAI API key.'});
            return;
        }

        try {
            const messages = req.body.messages;
            const modelName = req.body.modelName || 'gpt-4';
            const result = await aiService.generateResponse(messages, modelName);

            console.log(`✅ AI response generated`);
            res.send({result});
        } catch (error) {
            console.error(`❌ Error in /api/llm:`, error);
            res.status(500).send({error: 'An error occurred while processing the request.'});
        }
    });

    // Orchestrator agent test endpoint
    router.post('/orchestrator/analyze', async (req: Request, res: Response) => {
        console.log(`🧠 Orchestrator agent request received`);

        // Check if OpenAI service is available
        if (!aiService.isAvailable()) {
            console.log(`❌ OpenAI service not available - no API key configured`);
            res.status(503).send({error: 'AI service is not available. Please configure OpenAI API key.'});
            return;
        }

        try {
            const { requirement } = req.body;
            
            if (!requirement) {
                res.status(400).send({error: 'requirement field is required'});
                return;
            }

            const result = await orchestratorAgent.analyzeRequirement(requirement);

            console.log(`✅ Orchestrator analysis completed`);
            res.send({
                result,
                metadata: {
                    timestamp: new Date().toISOString(),
                    requirement,
                    toolCount: result.implementationPlan.toolRequirements.length,
                    searchCount: result.searchPlan.queries.length
                }
            });
        } catch (error) {
            console.error(`❌ Error in orchestrator analysis:`, error);
            res.status(500).send({
                error: 'An error occurred while analyzing the requirement.',
                details: error.message
            });
        }
    });

    // Browser agent test endpoint
    router.post('/browser/search', async (req: Request, res: Response) => {
        console.log(`🔍 Browser agent test request received`);

        try {
            const { searchPlan } = req.body;
            
            if (!searchPlan || !searchPlan.queries) {
                res.status(400).send({error: 'searchPlan with queries field is required'});
                return;
            }

            // Check if browser agent is available
            const available = await browserAgent.isAvailable();
            if (!available) {
                res.status(503).send({error: 'Browser agent service is not available'});
                return;
            }

            const result = await browserAgent.searchApis(searchPlan);

            console.log(`✅ Browser agent search completed`);
            res.send({
                result,
                metadata: {
                    timestamp: new Date().toISOString(),
                    queryCount: searchPlan.queries.length,
                    apiSpecCount: result.length
                }
            });
        } catch (error) {
            console.error(`❌ Error in browser agent search:`, error);
            res.status(500).send({
                error: 'An error occurred while searching APIs.',
                details: error.message
            });
        }
    });

    // Agent status endpoint
    router.get('/status', async (req: Request, res: Response) => {
        const browserAvailable = await browserAgent.isAvailable();
        
        const status = {
            openaiAvailable: aiService.isAvailable(),
            orchestratorAgent: 'available',
            browserAgent: browserAvailable ? 'available' : 'unavailable',
            engineerAgent: 'not_implemented',
            timestamp: new Date().toISOString()
        };

        console.log(`📊 Agent status requested:`, status);
        res.send(status);
    });

    return router;
}