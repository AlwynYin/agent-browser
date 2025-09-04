// Session management routes following Forest's Express.js routing pattern
import express, { Router } from 'express'
import { SessionRepository } from '../repositories/SessionRepository.js'
import { SessionService } from '../services/SessionService.js'
import { ToolExecutionService } from '../services/ToolExecutionService.js'
import { asyncHandler, AgentBrowserError } from '../middleware/errorHandler.js'
import { createSession } from '@agent-browser/schema'

export function createSessionRouter(
    sessionRepository: SessionRepository,
    sessionService: SessionService,
    toolExecutionService: ToolExecutionService
): Router {
    const router = express.Router()
    
    // Create new session
    router.post('/', asyncHandler(async (req, res) => {
        const { requirement, userId } = req.body
        
        if (!requirement || typeof requirement !== 'string') {
            throw new AgentBrowserError('Requirement is required and must be a string', 'INVALID_REQUIREMENT')
        }
        
        if (!userId || typeof userId !== 'string') {
            throw new AgentBrowserError('User ID is required and must be a string', 'INVALID_USER_ID')
        }
        
        const sessionId = await sessionService.createSession(requirement, userId)
        res.json({ sessionId })
    }))
    
    // Get session details
    router.get('/:id', asyncHandler(async (req, res) => {
        const sessionId = req.params.id
        const session = await sessionRepository.findById(sessionId)
        
        if (!session) {
            throw new AgentBrowserError('Session not found', 'SESSION_NOT_FOUND', 404)
        }
        
        res.json(session)
    }))
    
    // Get user sessions
    router.get('/user/:userId', asyncHandler(async (req, res) => {
        const userId = req.params.userId
        const limit = parseInt(req.query.limit as string) || 50
        
        const sessions = await sessionRepository.findByUserId(userId, limit)
        res.json(sessions)
    }))
    
    // Execute tool
    router.post('/:id/tools/:toolId/execute', asyncHandler(async (req, res) => {
        const { id: sessionId, toolId } = req.params
        const { input } = req.body
        
        if (!input) {
            throw new AgentBrowserError('Input is required for tool execution', 'MISSING_INPUT')
        }
        
        const result = await toolExecutionService.executeTool(toolId, input, sessionId)
        res.json(result)
    }))
    
    // Cancel session
    router.post('/:id/cancel', asyncHandler(async (req, res) => {
        const sessionId = req.params.id
        await sessionService.cancelSession(sessionId)
        res.json({ success: true })
    }))
    
    // Delete session
    router.delete('/:id', asyncHandler(async (req, res) => {
        const sessionId = req.params.id
        await sessionRepository.deleteSession(sessionId)
        res.json({ success: true })
    }))
    
    return router
}

// Agent debugging routes
export function createAgentRouter(): Router {
    const router = express.Router()
    
    // Get agent status (placeholder for future agent monitoring)
    router.get('/status', asyncHandler(async (req, res) => {
        res.json({
            orchestrator: { status: 'ready', version: '1.0.0' },
            browser: { status: 'ready', version: '1.0.0' },
            implementer: { status: 'ready', version: '1.0.0' }
        })
    }))
    
    return router
}