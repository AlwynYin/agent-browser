// Error handling middleware following Forest patterns
import express from 'express'

export class AgentBrowserError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 400,
        public sessionId?: string,
        public agentType?: string
    ) {
        super(message)
        this.name = 'AgentBrowserError'
    }
}

export function errorHandler(
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    console.error('Server error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    })
    
    if (error instanceof AgentBrowserError) {
        res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
            sessionId: error.sessionId,
            agentType: error.agentType
        })
        return
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
        res.status(400).json({
            error: 'Invalid request data',
            code: 'VALIDATION_ERROR',
            details: error.message
        })
        return
    }
    
    // Handle MongoDB errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        res.status(500).json({
            error: 'Database error',
            code: 'DATABASE_ERROR'
        })
        return
    }
    
    // Generic error
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    })
}

export function notFoundHandler(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.path
    })
}

// Async handler wrapper to catch async errors
export function asyncHandler(
    fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>
) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}