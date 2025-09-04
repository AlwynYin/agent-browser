// Main server entry point for agent-browser
import { config } from 'dotenv'
import { resolve } from 'path'
import express from 'express'

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), '../../.env') })
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

import { loadConfig, validateConfig } from './config.js'
import { connectDatabase } from './database.js'
import { SessionRepository } from './repositories/SessionRepository.js'
import { SessionService } from './services/SessionService.js'
import { ToolExecutionService, PythonExecutionApiClient } from './services/ToolExecutionService.js'
import { SessionWebSocketHandler } from './websocket/SessionWebSocketHandler.js'
import { createSessionRouter, createAgentRouter } from './routes/sessionRouter.js'
import { createAIRouter } from './routes/aiRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { orchestratorAgent, browserAgent, implementerAgent } from './agents/index.js'

async function startServer() {
    try {
        // Load and validate configuration
        const config = loadConfig()
        validateConfig(config)
        
        console.log('🚀 Starting agent-browser server...')
        console.log(`📊 Environment: ${config.environment}`)
        console.log(`🌐 Port: ${config.port}`)
        
        // Connect to database
        const db = await connectDatabase(config)
        
        // Initialize repositories
        const sessionRepository = new SessionRepository(db)
        
        // Initialize external API clients
        const pythonExecutionApi = new PythonExecutionApiClient(
            config.pythonExecutionApiUrl,
            config.pythonExecutionApiKey
        )
        
        // Create Express app
        const app = express()
        const httpServer = createServer(app)
        
        // Initialize WebSocket server
        const io = new SocketIOServer(httpServer, {
            cors: {
                origin: config.corsOrigins,
                methods: ['GET', 'POST']
            }
        })
        
        const webSocketHandler = new SessionWebSocketHandler(io)
        
        // Initialize services with orchestrator, browser, and implementer agents
        const sessionService = new SessionService(
            sessionRepository,
            orchestratorAgent, // Phase 1.2: Orchestrator agent implemented
            browserAgent, // Phase 1.3: Browser agent implemented
            implementerAgent, // Phase 1.4: Implementer agent implemented
            webSocketHandler
        )
        
        const toolExecutionService = new ToolExecutionService(
            sessionRepository,
            pythonExecutionApi,
            webSocketHandler
        )
        
        // Middleware
        app.use(helmet({
            contentSecurityPolicy: config.environment === 'production'
        }))
        
        app.use(cors({
            origin: config.corsOrigins,
            credentials: true
        }))
        
        app.use(express.json({ limit: '10mb' }))
        app.use(express.urlencoded({ extended: true, limit: '10mb' }))
        
        // Request logging middleware
        app.use((req, res, next) => {
            const start = Date.now()
            res.on('finish', () => {
                const duration = Date.now() - start
                console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`)
            })
            next()
        })
        
        // Serve static files from client build
        const staticPath = resolve(process.cwd(), 'build/dist/public')
        app.use(express.static(staticPath))
        
        // API Routes
        app.use('/api/sessions', createSessionRouter(sessionRepository, sessionService, toolExecutionService))
        app.use('/api/agents', createAgentRouter())
        app.use('/api/ai', createAIRouter())
        
        // Health check
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                environment: config.environment
            })
        })
        
        // Serve index.html for all non-API routes (SPA fallback)
        app.get('*', (req, res) => {
            // Don't serve index.html for API routes
            if (req.path.startsWith('/api')) {
                return res.status(404).json({ error: 'API endpoint not found' })
            }
            res.sendFile(resolve(staticPath, 'index.html'))
        })
        
        // Error handling
        app.use(notFoundHandler)
        app.use(errorHandler)
        
        // Start server
        httpServer.listen(config.port, () => {
            console.log(`✅ Server running on port ${config.port}`)
            console.log(`🔗 Health check: http://localhost:${config.port}/health`)
            console.log(`🌐 WebSocket ready for connections`)
        })
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 SIGTERM received, shutting down gracefully...')
            httpServer.close(() => {
                console.log('✅ Server closed')
                process.exit(0)
            })
        })
        
        process.on('SIGINT', async () => {
            console.log('🛑 SIGINT received, shutting down gracefully...')
            httpServer.close(() => {
                console.log('✅ Server closed')
                process.exit(0)
            })
        })
        
    } catch (error) {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

// Start the server
startServer()