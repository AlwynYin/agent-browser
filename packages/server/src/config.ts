// Configuration for the agent-browser server
import * as process from "node:process";

export interface ServerConfig {
    port: number
    mongoUrl: string
    openaiApiKey: string
    pythonExecutionApiUrl: string
    pythonExecutionApiKey?: string
    browserUseApiKey: string
    browserServiceMode: 'cloud' | 'local' | 'mock'
    browserServicePort: number
    browserServiceAutoStart: boolean
    corsOrigins: string[]
    environment: 'development' | 'production' | 'test'
}

export function loadConfig(): ServerConfig {
    return {
        port: parseInt(process.env.PORT || '3001'),
        mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/agent-browser',
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        pythonExecutionApiUrl: process.env.PYTHON_EXECUTION_API_URL || 'http://localhost:8000',
        pythonExecutionApiKey: process.env.PYTHON_EXECUTION_API_KEY,
        browserUseApiKey: process.env.BROWSER_USE_API_KEY || '',
        browserServiceMode: (process.env.BROWSER_SERVICE_MODE as ServerConfig['browserServiceMode']) || 'cloud',
        browserServicePort: parseInt(process.env.BROWSER_SERVICE_PORT || '8001'),
        browserServiceAutoStart: process.env.BROWSER_SERVICE_AUTO_START === 'true',
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
        environment: (process.env.NODE_ENV as ServerConfig['environment']) || 'development'
    }
}

// Validate required configuration
export function validateConfig(config: ServerConfig): void {
    if (!config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required')
    }
    
    if (!config.mongoUrl) {
        throw new Error('MONGO_URL environment variable is required')
    }
    
    // Only require Browser-Use API key when using cloud mode
    if (config.browserServiceMode === 'cloud' && !config.browserUseApiKey) {
        throw new Error('BROWSER_USE_API_KEY environment variable is required when BROWSER_SERVICE_MODE=cloud')
    }
    
    // Warn about local service requirements
    if (config.browserServiceMode === 'local') {
        console.log('🔧 Local browser service mode enabled');
        console.log(`   Service should be running on port ${config.browserServicePort}`);
        console.log('   Ensure Python dependencies are installed: pip install -e .');
    }
}