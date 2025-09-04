// Tool execution service - integrates with external Python execution API
import { SessionRepository } from '../repositories/SessionRepository.js'
import { ExecutionResult } from '@agent-browser/schema'
import { AgentBrowserError } from '../middleware/errorHandler.js'

// Python execution API client - following Forest's external API pattern
interface PythonExecutionRequest {
    code: string
    input: any
    dependencies: string[]
    timeout?: number
}

interface PythonExecutionResponse {
    output: any
    success: boolean
    error?: string
    executionTime: number
}

export class PythonExecutionApiClient {
    constructor(
        private apiUrl: string,
        private apiKey?: string
    ) {}
    
    async execute(request: PythonExecutionRequest): Promise<PythonExecutionResponse> {
        try {
            const response = await fetch(`${this.apiUrl}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    code: request.code,
                    input: request.input,
                    dependencies: request.dependencies,
                    timeout: request.timeout || 30000
                })
            })
            
            if (!response.ok) {
                throw new Error(`Python execution failed: ${response.statusText}`)
            }
            
            return await response.json() as PythonExecutionResponse
        } catch (error: any) {
            throw new Error(`Failed to call Python execution API: ${error?.message || error}`)
        }
    }
}

interface SessionWebSocketHandler {
    broadcastExecutionResult(sessionId: string, result: ExecutionResult): void
}

export class ToolExecutionService {
    constructor(
        private sessionRepository: SessionRepository,
        private pythonExecutionApi: PythonExecutionApiClient,
        private webSocketHandler?: SessionWebSocketHandler
    ) {}
    
    async executeTool(
        toolId: string, 
        input: any,
        sessionId: string
    ): Promise<ExecutionResult> {
        const session = await this.sessionRepository.findById(sessionId)
        if (!session) {
            throw new AgentBrowserError('Session not found', 'SESSION_NOT_FOUND', 404)
        }
        
        const tool = session.tools.find(t => t.id === toolId)
        if (!tool) {
            throw new AgentBrowserError('Tool not found', 'TOOL_NOT_FOUND', 404)
        }
        
        console.log(`🔧 Executing tool ${tool.name} for session ${sessionId}`)
        
        const startTime = Date.now()
        
        try {
            // Validate input against tool's input schema
            this.validateInput(input, tool.inputSchema)
            
            // Call external Python execution API
            const result = await this.pythonExecutionApi.execute({
                code: tool.pythonCode,
                input: input,
                dependencies: tool.dependencies,
                timeout: 60000 // 1 minute timeout
            })
            
            const executionTime = Date.now() - startTime
            
            const executionResult: ExecutionResult = {
                id: crypto.randomUUID(),
                sessionId,
                toolId,
                input,
                output: result.output,
                success: result.success,
                error: result.error,
                executionTime,
                createdAt: new Date()
            }
            
            // Save execution result to session
            await this.sessionRepository.addExecutionResult(sessionId, executionResult)
            
            // Notify clients via WebSocket
            this.webSocketHandler?.broadcastExecutionResult(sessionId, executionResult)
            
            if (result.success) {
                console.log(`✅ Tool execution completed successfully: ${tool.name}`)
            } else {
                console.log(`❌ Tool execution failed: ${tool.name}, error: ${result.error}`)
            }
            
            return executionResult
            
        } catch (error: any) {
            const executionTime = Date.now() - startTime
            
            const executionResult: ExecutionResult = {
                id: crypto.randomUUID(),
                sessionId,
                toolId,
                input,
                output: null,
                success: false,
                error: error?.message || 'Unknown error',
                executionTime,
                createdAt: new Date()
            }
            
            // Save failed execution result
            await this.sessionRepository.addExecutionResult(sessionId, executionResult)
            
            // Notify clients via WebSocket
            this.webSocketHandler?.broadcastExecutionResult(sessionId, executionResult)
            
            console.error(`❌ Tool execution error for ${tool.name}:`, error)
            
            return executionResult
        }
    }
    
    private validateInput(input: any, inputSchema: any): void {
        // Basic validation - in a real implementation, you'd use a JSON schema validator
        if (!input && inputSchema.required) {
            throw new Error('Input is required but not provided')
        }
        
        // For now, just ensure input is an object if schema expects it
        if (inputSchema.type === 'object' && typeof input !== 'object') {
            throw new Error('Input must be an object')
        }
    }
    
    async getExecutionHistory(sessionId: string): Promise<ExecutionResult[]> {
        const session = await this.sessionRepository.findById(sessionId)
        if (!session) {
            throw new AgentBrowserError('Session not found', 'SESSION_NOT_FOUND', 404)
        }
        
        return session.results
    }
}