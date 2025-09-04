// Core data models for agent-browser system
// Following the detailed design from phase1-systems-design.md

export enum SessionStatus {
    PENDING = 'pending',
    PLANNING = 'planning', 
    SEARCHING = 'searching',
    IMPLEMENTING = 'implementing',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

// Session represents a user's computation workflow
export interface SessionM {
    id: string
    userId: string
    requirement: string           // User's input requirement
    status: SessionStatus        // Current workflow status
    implementationPlan?: ImplementationPlan
    searchPlan?: SearchPlan
    apiSpecs: ApiSpec[]
    tools: ToolSpec[]
    results: ExecutionResult[]
    createdAt: Date
    updatedAt: Date
}

// Implementation plan from orchestrator agent
export interface ImplementationPlan {
    id: string
    sessionId: string
    toolRequirements: ToolRequirement[]
    estimatedComplexity: 'low' | 'medium' | 'high'
    dependencies: string[]       // Required packages/libraries
    createdAt: Date
}

export interface ToolRequirement {
    name: string
    description: string
    inputFormat: any            // JSON schema for inputs
    outputFormat: any           // JSON schema for outputs
    requiredApis: string[]      // API functions needed
    priority: number
}

// Search plan for browser agent
export interface SearchPlan {
    id: string
    sessionId: string
    queries: SearchQuery[]
    targetPackages: string[]    // e.g., ['ase', 'pyscf', 'rdkit']
    createdAt: Date
}

export interface SearchQuery {
    query: string
    package: string
    purpose: string             // What this search is for
    priority: number
}

// API specifications from browser agent
export interface ApiSpec {
    id: string
    sessionId: string
    name: string                // e.g., 'numpy.random.randn'
    package: string            // e.g., 'numpy'
    description: string
    usage: string              // Sample code
    parameters: Parameter[]
    returnType: string
    examples: CodeExample[]
    sourceUrl?: string
    createdAt: Date
}

export interface Parameter {
    name: string
    type: string
    description: string
    required: boolean
    defaultValue?: any
}

export interface CodeExample {
    code: string
    description: string
    expectedOutput?: string
}

// Tool specifications from engineer agent
export interface ToolSpec {
    id: string
    sessionId: string
    name: string
    description: string
    pythonCode: string
    inputSchema: any           // JSON schema
    outputSchema: any          // JSON schema
    dependencies: string[]     // Required packages
    testCases: TestCase[]
    status: 'pending' | 'implemented' | 'tested' | 'failed'
    createdAt: Date
}

export interface TestCase {
    input: any
    expectedOutput: any
    description: string
}

// Execution results
export interface ExecutionResult {
    id: string
    sessionId: string
    toolId: string
    input: any
    output: any
    success: boolean
    error?: string
    executionTime: number
    createdAt: Date
}

// Agent response structures
export interface OrchestratorResponse {
    implementationPlan: ImplementationPlan
    searchPlan: SearchPlan
}

export interface BrowserAgentOutput {
    apiSpecs: ApiSpecExtraction[]
}

export interface ApiSpecExtraction {
    name: string
    package: string
    description: string
    usage: string
    parameters: Parameter[]
    returnType: string
    examples: CodeExample[]
    sourceUrl: string
}

export interface EngineerResponse {
    pythonCode: string
    dependencies: string[]
    testCases: TestCase[]
    implementation_notes: string
}