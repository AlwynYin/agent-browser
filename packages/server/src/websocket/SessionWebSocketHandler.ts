// WebSocket integration for real-time updates following Forest's pattern
import { Server as SocketIOServer } from 'socket.io'
import { SessionStatus, ToolSpec, ExecutionResult } from '@agent-browser/schema'

export class SessionWebSocketHandler {
    private io: SocketIOServer
    
    constructor(io: SocketIOServer) {
        this.io = io
        this.setupHandlers()
    }
    
    private setupHandlers(): void {
        this.io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`)
            
            socket.on('join-session', (sessionId: string) => {
                socket.join(`session-${sessionId}`)
                console.log(`👥 Client ${socket.id} joined session ${sessionId}`)
            })
            
            socket.on('leave-session', (sessionId: string) => {
                socket.leave(`session-${sessionId}`)
                console.log(`👋 Client ${socket.id} left session ${sessionId}`)
            })
            
            socket.on('disconnect', () => {
                console.log(`🔌 Client disconnected: ${socket.id}`)
            })
        })
    }
    
    // Broadcast status updates to all clients in session
    broadcastStatusUpdate(sessionId: string, status: SessionStatus, progress?: number): void {
        const update = {
            type: 'status-update',
            sessionId, // Add sessionId to the update
            status,
            progress,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted status update for session ${sessionId}: ${status}`)
    }
    
    broadcastToolImplemented(sessionId: string, tool: ToolSpec): void {
        const update = {
            type: 'tool-implemented',
            sessionId, // Add sessionId to the update
            tool,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted tool implementation for session ${sessionId}: ${tool.name}`)
    }
    
    broadcastExecutionResult(sessionId: string, result: ExecutionResult): void {
        const update = {
            type: 'execution-result',
            sessionId, // Add sessionId to the update
            result,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted execution result for session ${sessionId}: ${result.success ? 'success' : 'failure'}`)
    }
    
    broadcastImplementationPlan(sessionId: string, plan: any): void {
        const update = {
            type: 'implementation-plan',
            plan,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted implementation plan for session ${sessionId}`)
    }
    
    broadcastSearchPlan(sessionId: string, plan: any): void {
        const update = {
            type: 'search-plan', 
            plan,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted search plan for session ${sessionId}`)
    }
    
    broadcastApiSpecs(sessionId: string, apiSpecs: any[]): void {
        const update = {
            type: 'api-specs',
            apiSpecs,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted ${apiSpecs.length} API specs for session ${sessionId}`)
    }
    
    broadcastError(sessionId: string, error: string, context?: any): void {
        const update = {
            type: 'error',
            error,
            context,
            timestamp: new Date().toISOString()
        }
        
        this.io.to(`session-${sessionId}`).emit('session-update', update)
        console.log(`📡 Broadcasted error for session ${sessionId}: ${error}`)
    }
}