// Session management service following Forest's service layer pattern
import { SessionRepository } from '../repositories/SessionRepository.js'
import { SessionM, SessionStatus, createSession } from '@agent-browser/schema'
import { AgentBrowserError } from '../middleware/errorHandler.js'
import { OrchestratorAgent } from '../agents/OrchestratorAgent.js'
import { BrowserAgent } from '../agents/BrowserAgent.js'
import { ImplementerAgent } from '../agents/ImplementerAgent.js'

interface SessionWebSocketHandler {
    broadcastStatusUpdate(sessionId: string, status: SessionStatus, progress?: number): void
    broadcastToolImplemented(sessionId: string, tool: any): void
}

export class SessionService {
    constructor(
        private sessionRepository: SessionRepository,
        private orchestratorAgent?: OrchestratorAgent,
        private browserAgent?: BrowserAgent,
        private implementerAgent?: ImplementerAgent,
        private webSocketHandler?: SessionWebSocketHandler
    ) {}
    
    async createSession(requirement: string, userId: string): Promise<string> {
        const session = createSession(userId, requirement)
        
        await this.sessionRepository.save(session)
        
        // Start Phase 1 workflow asynchronously
        this.executePhase1Workflow(session.id).catch(error => {
            console.error(`Phase 1 workflow failed for session ${session.id}:`, error)
            this.updateSessionStatus(session.id, SessionStatus.FAILED).catch(console.error)
        })
        
        return session.id
    }
    
    async getSession(sessionId: string): Promise<SessionM> {
        const session = await this.sessionRepository.findById(sessionId)
        if (!session) {
            throw new AgentBrowserError('Session not found', 'SESSION_NOT_FOUND', 404)
        }
        return session
    }
    
    async cancelSession(sessionId: string): Promise<void> {
        await this.updateSessionStatus(sessionId, SessionStatus.FAILED)
    }
    
    private async executePhase1Workflow(sessionId: string): Promise<void> {
        try {
            const session = await this.sessionRepository.findById(sessionId)
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`)
            }
            
            console.log(`🚀 Starting Phase 1 workflow for session ${sessionId}`)
            
            // Step 1: Generate plans (Orchestrator Agent)
            await this.updateSessionStatus(sessionId, SessionStatus.PLANNING)
            
            if (!this.orchestratorAgent) {
                throw new Error('Orchestrator agent not available')
            }
            
            const { implementationPlan, searchPlan } = 
                await this.orchestratorAgent.analyzeRequirement(session.requirement)
            
            session.implementationPlan = implementationPlan
            session.searchPlan = searchPlan
            await this.sessionRepository.save(session)
            
            // Step 2: Search for APIs (Browser Agent)
            await this.updateSessionStatus(sessionId, SessionStatus.SEARCHING)
            
            if (!this.browserAgent) {
                throw new Error('Browser agent not available')
            }
            
            console.log('🔍 Searching for APIs with Browser Agent...')
            const apiSpecs = await this.browserAgent.searchApis(searchPlan)
            
            session.apiSpecs = apiSpecs
            await this.sessionRepository.save(session)
            console.log(`✅ Found ${apiSpecs.length} API specifications`)
            
            // Step 3: Implement tools (Implementer Agent)
            await this.updateSessionStatus(sessionId, SessionStatus.IMPLEMENTING)
            
            if (!this.implementerAgent) {
                throw new Error('Implementer agent not available')
            }
            
            console.log(`🛠️  Starting tool implementation with Implementer Agent...`)
            const tools: any[] = []
            
            for (const toolReq of implementationPlan.toolRequirements) {
                const relevantApis = apiSpecs.filter(api => 
                    toolReq.requiredApis.includes(api.name)
                )
                console.log(`🔧 Implementing tool: ${toolReq.name} with ${relevantApis.length} relevant APIs`)
                const tool = await this.implementerAgent.implementTool(toolReq, relevantApis)
                
                // Set the session ID on the tool spec
                tool.sessionId = sessionId
                tools.push(tool)
                
                console.log(`✅ Tool implemented: ${tool.name}`)
                // Notify frontend of new tool
                this.webSocketHandler?.broadcastToolImplemented(sessionId, tool)
            }
            
            session.tools = tools
            await this.sessionRepository.save(session)
            
            // Complete the workflow
            await this.updateSessionStatus(sessionId, SessionStatus.COMPLETED)
            
            console.log(`✅ Phase 1 workflow completed for session ${sessionId}`)
            
        } catch (error) {
            console.error(`❌ Phase 1 workflow failed for session ${sessionId}:`, error)
            await this.updateSessionStatus(sessionId, SessionStatus.FAILED)
            throw error
        }
    }
    
    private async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
        await this.sessionRepository.updateStatus(sessionId, status)
        
        // Calculate progress percentage
        const progress = this.calculateProgress(status)
        
        // Notify clients via WebSocket
        this.webSocketHandler?.broadcastStatusUpdate(sessionId, status, progress)
        
        console.log(`📊 Session ${sessionId} status updated: ${status} (${progress}%)`)
    }
    
    private calculateProgress(status: SessionStatus): number {
        switch (status) {
            case SessionStatus.PENDING:
                return 0
            case SessionStatus.PLANNING:
                return 20
            case SessionStatus.SEARCHING:
                return 40
            case SessionStatus.IMPLEMENTING:
                return 60
            case SessionStatus.EXECUTING:
                return 80
            case SessionStatus.COMPLETED:
                return 100
            case SessionStatus.FAILED:
                return 0
            default:
                return 0
        }
    }
}