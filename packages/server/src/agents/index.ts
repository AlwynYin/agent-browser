import {OrchestratorAgent} from './OrchestratorAgent';
import {BrowserAgent} from './BrowserAgent';
import {ImplementerAgent} from './ImplementerAgent';
import {aiService} from '../services/AIService';

// Factory functions for creating agent instances
export function createOrchestratorAgent(): OrchestratorAgent {
    return new OrchestratorAgent(aiService);
}

export function createBrowserAgent(): BrowserAgent {
    return new BrowserAgent();
}

export function createImplementerAgent(): ImplementerAgent {
    return new ImplementerAgent(aiService);
}

// Singleton instances for easy access
export const orchestratorAgent = createOrchestratorAgent();
export const browserAgent = createBrowserAgent();
export const implementerAgent = createImplementerAgent();

// Export all agent classes for flexibility
export {OrchestratorAgent} from './OrchestratorAgent';
export {BrowserAgent} from './BrowserAgent';
export {ImplementerAgent} from './ImplementerAgent';