import {AIService} from '../services/AIService';
import {ImplementationPlan, SearchPlan} from '@agent-browser/schema';

interface OrchestratorResponse {
    implementationPlan: ImplementationPlan;
    searchPlan: SearchPlan;
}

export class OrchestratorAgent {
    constructor(private aiService: AIService) {}

    async analyzeRequirement(requirement: string): Promise<OrchestratorResponse> {
        console.log(`🧠 OrchestratorAgent.analyzeRequirement called with: "${requirement}"`);
        
        if (!this.aiService.isAvailable()) {
            console.log('❌ OrchestratorAgent: AI service not available');
            throw new Error('AI service is not available. Please configure OpenAI API key.');
        }
        
        console.log('✅ OrchestratorAgent: AI service is available, proceeding...');

        const systemPrompt = `You are an expert software architect and chemistry computation specialist. Your role is to analyze user requirements for chemistry tools and create detailed implementation and search plans.

Given a user requirement, you must:
1. Break down the requirement into specific tools needed
2. Identify what Python packages and APIs will be required
3. Create a search plan to find the necessary API documentation
4. Estimate complexity and dependencies

You MUST respond with valid JSON matching this exact structure:
{
  "implementationPlan": {
    "toolRequirements": [
      {
        "name": "string",
        "description": "string", 
        "inputFormat": {JSON schema object},
        "outputFormat": {JSON schema object},
        "requiredApis": ["string array of API functions needed"],
        "priority": number
      }
    ],
    "estimatedComplexity": "low" | "medium" | "high",
    "dependencies": ["string array of required packages"]
  },
  "searchPlan": {
    "queries": [
      {
        "query": "string search query",
        "package": "string package name",
        "purpose": "string explanation of what this search is for",
        "priority": number
      }
    ],
    "targetPackages": ["string array of packages to search"]
  }
}

Chemistry packages you should know about:
- ASE (Atomic Simulation Environment): Structure manipulation, calculators
- PySCF: Quantum chemistry calculations
- RDKit: Cheminformatics and molecular descriptors
- NumPy/SciPy: Numerical computations
- Matplotlib: Visualization
- Pandas: Data manipulation

When creating tool requirements:
- Make tools focused and single-purpose
- Define clear input/output schemas using JSON Schema format
- Prioritize tools (1 = highest priority)
- Be specific about required API functions

When creating search plans:
- Generate specific search queries that will find relevant API documentation
- Include multiple queries per package if needed
- Focus on function signatures, parameters, and examples
- Prioritize searches based on tool importance`;

        const userMessage = `Chemistry Requirement: ${requirement}

Please analyze this requirement and create an implementation plan with the specific tools needed, plus a search plan to find the necessary API documentation.

Focus on:
- Breaking down the task into specific, implementable tools
- Identifying the exact Python functions and methods needed
- Creating targeted search queries to find API documentation
- Providing clear input/output schemas for each tool`;

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userMessage
            }
        ];

        try {
            console.log('🔄 OrchestratorAgent: Sending request to AI service...');
            const response = await this.aiService.generateStructuredResponse<OrchestratorResponse>(
                messages,
                'o3'
            );

            console.log('🔍 OrchestratorAgent: Validating response structure...');
            // Validate the response structure
            this.validateResponse(response);

            console.log('✅ OrchestratorAgent: Analysis completed successfully');
            console.log(`📊 Generated ${response.implementationPlan.toolRequirements.length} tool requirements`);
            console.log(`🔍 Generated ${response.searchPlan.queries.length} search queries`);

            return response;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ OrchestratorAgent failed: ${errorMessage}`);
            throw new Error(`Orchestrator Agent failed to analyze requirement: ${errorMessage}`);
        }
    }

    private validateResponse(response: any): void {
        if (!response.implementationPlan) {
            throw new Error('Missing implementationPlan in orchestrator response');
        }
        
        if (!response.searchPlan) {
            throw new Error('Missing searchPlan in orchestrator response');
        }

        const implPlan = response.implementationPlan;
        if (!Array.isArray(implPlan.toolRequirements)) {
            throw new Error('implementationPlan.toolRequirements must be an array');
        }

        if (!implPlan.estimatedComplexity || !['low', 'medium', 'high'].includes(implPlan.estimatedComplexity)) {
            throw new Error('implementationPlan.estimatedComplexity must be "low", "medium", or "high"');
        }

        const searchPlan = response.searchPlan;
        if (!Array.isArray(searchPlan.queries)) {
            throw new Error('searchPlan.queries must be an array');
        }

        if (!Array.isArray(searchPlan.targetPackages)) {
            throw new Error('searchPlan.targetPackages must be an array');
        }
    }
}