// Main exports for @agent-browser/schema package
export * from './models'
export * from './viewModels'

import { SessionM, SessionStatus, ImplementationPlan, SearchPlan } from './models'
// Use simple UUID generation for now
function generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Utility functions for working with models
export function createSession(userId: string, requirement: string): SessionM {
    return {
        id: generateId(),
        userId,
        requirement,
        status: SessionStatus.PENDING,
        apiSpecs: [],
        tools: [],
        results: [],
        createdAt: new Date(),
        updatedAt: new Date()
    }
}

export function createImplementationPlan(sessionId: string): ImplementationPlan {
    return {
        id: generateId(),
        sessionId,
        toolRequirements: [],
        estimatedComplexity: 'medium',
        dependencies: [],
        createdAt: new Date()
    }
}

export function createSearchPlan(sessionId: string): SearchPlan {
    return {
        id: generateId(),
        sessionId,
        queries: [],
        targetPackages: [],
        createdAt: new Date()
    }
}