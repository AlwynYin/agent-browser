import {OrchestratorAgent} from './OrchestratorAgent';
import {BrowserAgent} from './BrowserAgent';
import {ImplementerAgent} from './ImplementerAgent';
import {aiService} from '../services/AIService';
import {BrowserClient} from '../services/BrowserClient';
import {BrowserUseCloudClient} from '../services/BrowserUseCloudClient';
import {LocalBrowserUseClient} from '../services/LocalBrowserUseClient';
import {MockBrowserClient} from '../services/MockBrowserClient';
import {loadConfig} from '../config';

// Factory functions for creating agent instances
export function createOrchestratorAgent(): OrchestratorAgent {
    return new OrchestratorAgent(aiService);
}

export function createBrowserAgent(browserClient?: BrowserClient): BrowserAgent {
    const client = browserClient || createDefaultBrowserClient();
    return new BrowserAgent(client);
}

export function createImplementerAgent(): ImplementerAgent {
    return new ImplementerAgent(aiService);
}

// Browser client factory function - allows easy swapping of implementations
export function createDefaultBrowserClient(): BrowserClient {
    const config = loadConfig();
    const mode = config.browserServiceMode || process.env.BROWSER_SERVICE_MODE || 'cloud';
    
    switch (mode.toLowerCase()) {
        case 'local':
            console.log('🔧 Using Local Browser-Use client');
            return new LocalBrowserUseClient();
        case 'mock':
            console.log('🔧 Using Mock Browser client');
            return new MockBrowserClient();
        case 'cloud':
        default:
            console.log('🔧 Using Browser-Use Cloud client');
            return new BrowserUseCloudClient();
    }
}

// Alternative browser client factories for different implementations
export function createBrowserUseCloudClient(): BrowserClient {
    return new BrowserUseCloudClient();
}

export function createLocalBrowserUseClient(): BrowserClient {
    return new LocalBrowserUseClient();
}

export function createMockBrowserClient(): BrowserClient {
    return new MockBrowserClient();
}

// TODO: Add other browser client implementations
// export function createPlaywrightClient(): BrowserClient {
//     return new PlaywrightBrowserClient();
// }
//
// export function createPuppeteerClient(): BrowserClient {
//     return new PuppeteerBrowserClient();
// }

// Singleton instances for easy access
export const orchestratorAgent = createOrchestratorAgent();
export const browserAgent = createBrowserAgent(); // Uses createDefaultBrowserClient() which respects config
export const implementerAgent = createImplementerAgent();

// Export all agent classes for flexibility
export {OrchestratorAgent} from './OrchestratorAgent';
export {BrowserAgent} from './BrowserAgent';
export {ImplementerAgent} from './ImplementerAgent';