// Repository for session data operations
import { Db, Collection, ObjectId } from 'mongodb'
import { SessionM, SessionStatus } from '@agent-browser/schema'

export class SessionRepository {
    private collection: Collection<SessionM>
    
    constructor(db: Db) {
        this.collection = db.collection<SessionM>('sessions')
    }
    
    async save(session: SessionM): Promise<void> {
        session.updatedAt = new Date()
        
        const result = await this.collection.replaceOne(
            { id: session.id },
            session,
            { upsert: true }
        )
        
        if (!result.acknowledged) {
            throw new Error('Failed to save session')
        }
    }
    
    async findById(sessionId: string): Promise<SessionM | null> {
        const session = await this.collection.findOne({ id: sessionId })
        return session
    }
    
    async findByUserId(userId: string, limit = 50): Promise<SessionM[]> {
        const sessions = await this.collection
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray()
        
        return sessions
    }
    
    async updateStatus(sessionId: string, status: SessionStatus): Promise<void> {
        const result = await this.collection.updateOne(
            { id: sessionId },
            { 
                $set: { 
                    status,
                    updatedAt: new Date()
                }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async updateImplementationPlan(sessionId: string, implementationPlan: any): Promise<void> {
        const result = await this.collection.updateOne(
            { id: sessionId },
            {
                $set: {
                    implementationPlan,
                    updatedAt: new Date()
                }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async updateSearchPlan(sessionId: string, searchPlan: any): Promise<void> {
        const result = await this.collection.updateOne(
            { id: sessionId },
            {
                $set: {
                    searchPlan,
                    updatedAt: new Date()
                }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async addApiSpecs(sessionId: string, apiSpecs: any[]): Promise<void> {
        const result = await this.collection.updateOne(
            { id: sessionId },
            {
                $push: { apiSpecs: { $each: apiSpecs } },
                $set: { updatedAt: new Date() }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async addTool(sessionId: string, tool: any): Promise<void> {
        const result = await this.collection.updateOne(
            { id: sessionId },
            {
                $push: { tools: tool },
                $set: { updatedAt: new Date() }
            }
        )
        
        if (result.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async addExecutionResult(sessionId: string, result: any): Promise<void> {
        const updateResult = await this.collection.updateOne(
            { id: sessionId },
            {
                $push: { results: result },
                $set: { updatedAt: new Date() }
            }
        )
        
        if (updateResult.matchedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
    
    async deleteSession(sessionId: string): Promise<void> {
        const result = await this.collection.deleteOne({ id: sessionId })
        
        if (result.deletedCount === 0) {
            throw new Error(`Session not found: ${sessionId}`)
        }
    }
}