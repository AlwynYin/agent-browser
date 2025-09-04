// Configuration for the agent-browser server
import * as process from "node:process";

export interface ServerConfig {
    port: number
    mongoUrl: string
    openaiApiKey: string
    pythonExecutionApiUrl: string
    pythonExecutionApiKey?: string
    browserUseApiKey: string
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
    
    if (!config.browserUseApiKey) {
        throw new Error('BROWSER_USE_API_KEY environment variable is required')
    }
}