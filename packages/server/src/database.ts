// MongoDB connection and setup
import { MongoClient, Db } from 'mongodb'
import { ServerConfig } from './config.js'

let client: MongoClient | null = null
let database: Db | null = null

export async function connectDatabase(config: ServerConfig): Promise<Db> {
    if (database) {
        return database
    }
    
    try {
        console.log('🔌 Connecting to MongoDB...')
        client = new MongoClient(config.mongoUrl)
        await client.connect()
        
        database = client.db()
        
        // Test the connection
        await database.admin().ping()
        console.log('✅ Connected to MongoDB successfully')
        
        // Create indexes
        await createIndexes(database)
        
        return database
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error)
        throw error
    }
}

export async function disconnectDatabase(): Promise<void> {
    if (client) {
        await client.close()
        client = null
        database = null
        console.log('🔌 Disconnected from MongoDB')
    }
}

export function getDatabase(): Db {
    if (!database) {
        throw new Error('Database not connected. Call connectDatabase() first.')
    }
    return database
}

async function createIndexes(db: Db): Promise<void> {
    try {
        // Sessions collection indexes
        await db.collection('sessions').createIndex({ userId: 1, createdAt: -1 })
        await db.collection('sessions').createIndex({ status: 1 })
        await db.collection('sessions').createIndex({ updatedAt: -1 })
        
        // API specs collection indexes  
        await db.collection('apiSpecs').createIndex({ sessionId: 1 })
        await db.collection('apiSpecs').createIndex({ name: 1, package: 1 })
        
        // Tools collection indexes
        await db.collection('tools').createIndex({ sessionId: 1 })
        await db.collection('tools').createIndex({ name: 1 })
        
        // Execution results collection indexes
        await db.collection('executionResults').createIndex({ sessionId: 1, createdAt: -1 })
        await db.collection('executionResults').createIndex({ toolId: 1 })
        
        console.log('📋 Database indexes created successfully')
    } catch (error) {
        console.error('⚠️  Failed to create indexes:', error)
    }
}