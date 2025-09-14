import {AIService} from '../services/AIService';
import {ToolRequirement, ApiSpec, ToolSpec, TestCase, EngineerResponse} from '@agent-browser/schema';

export class ImplementerAgent {
    constructor(private aiService: AIService) {}

    async implementTool(toolRequirement: ToolRequirement, relevantApis: ApiSpec[]): Promise<ToolSpec> {
        console.log(`🛠️  ImplementerAgent.implementTool called for: "${toolRequirement.name}"`);
        console.log(`🔍 Working with ${relevantApis.length} relevant APIs`);
        
        if (!this.aiService.isAvailable()) {
            console.log('❌ ImplementerAgent: AI service not available');
            throw new Error('AI service is not available. Please configure OpenAI API key.');
        }
        
        console.log('✅ ImplementerAgent: AI service is available, proceeding...');

        const systemPrompt = `You are an expert Python software engineer specializing in chemistry computation tools. Your role is to implement robust, production-ready Python functions based on tool requirements and API specifications.

Given a tool requirement and relevant API specifications, you must create:
1. Complete, executable Python code
2. Proper error handling and validation
3. Clear docstrings following Google style
4. Input/output handling matching the specified schemas

You MUST respond with valid JSON matching this exact structure:
{
  "pythonCode": "string - complete Python function implementation",
  "dependencies": ["string array of required pip packages"],
  "implementation_notes": "string - brief explanation of implementation approach"
}

Code Requirements:
- Write a single function that matches the tool requirement exactly
- Include complete imports at the top
- Add comprehensive docstring with Args, Returns, Raises sections
- Implement proper input validation and error handling
- Handle edge cases gracefully
- Use the provided API specifications correctly
- Follow PEP 8 style guidelines
- Make the code production-ready and robust

Function signature should match:
def {tool_name}(input_data: dict) -> dict:
    """
    {tool description}
    
    Args:
        input_data (dict): Input parameters matching the input schema
        
    Returns:
        dict: Results matching the output schema
        
    Raises:
        ValueError: For invalid inputs
        RuntimeError: For computation failures
    """

Error Handling:
- Validate all inputs against the schema
- Provide clear error messages
- Handle missing dependencies gracefully  
- Catch and re-raise exceptions with context

Available APIs: You have access to the provided API specifications. Use them correctly according to their documented parameters and usage patterns.`;

        const userMessage = this.buildUserMessage(toolRequirement, relevantApis);

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
            console.log('🔄 ImplementerAgent: Sending request to AI service...');
            const response = await this.aiService.generateStructuredResponse<EngineerResponse>(
                messages,
                'o1'
            );

            console.log('🔍 ImplementerAgent: Validating response structure...');
            this.validateResponse(response);

            console.log('✅ ImplementerAgent: Implementation completed successfully');
            console.log(`📄 Generated ${response.pythonCode.length} characters of Python code`);
            console.log(`📦 Dependencies: ${response.dependencies.join(', ')}`);

            // Convert EngineerResponse to ToolSpec
            const toolSpec: ToolSpec = {
                id: crypto.randomUUID(),
                sessionId: '', // Will be set by SessionService
                name: toolRequirement.name,
                description: toolRequirement.description,
                pythonCode: response.pythonCode,
                inputSchema: toolRequirement.inputFormat,
                outputSchema: toolRequirement.outputFormat,
                dependencies: response.dependencies,
                testCases: [], // Test cases temporarily disabled to avoid JSON parsing issues
                status: 'implemented',
                createdAt: new Date()
            };

            return toolSpec;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ ImplementerAgent failed: ${errorMessage}`);
            throw new Error(`Implementer Agent failed to implement tool: ${errorMessage}`);
        }
    }

    private buildUserMessage(toolRequirement: ToolRequirement, relevantApis: ApiSpec[]): string {
        const apiSpecsText = relevantApis.map(api => `
API: ${api.name} (${api.package})
Description: ${api.description}
Parameters: ${api.parameters.map(p => `${p.name}: ${p.type}${p.required ? ' (required)' : ' (optional)'} - ${p.description}`).join(', ')}
Return Type: ${api.returnType}
Usage: ${api.usage}
Examples:
${api.examples.map(ex => `  ${ex.code} # ${ex.description}${ex.expectedOutput ? ' -> ' + ex.expectedOutput : ''}`).join('\n')}
`).join('\n---\n');

        return `Tool Requirement:
Name: ${toolRequirement.name}
Description: ${toolRequirement.description}
Input Schema: ${JSON.stringify(toolRequirement.inputFormat, null, 2)}
Output Schema: ${JSON.stringify(toolRequirement.outputFormat, null, 2)}
Required APIs: ${toolRequirement.requiredApis.join(', ')}
Priority: ${toolRequirement.priority}

Available API Specifications:
${apiSpecsText}

Please implement a complete, production-ready Python function that fulfills this tool requirement using the provided APIs. Include comprehensive error handling, validation, and test cases.

The function should:
1. Accept input_data as a dictionary matching the input schema
2. Return results as a dictionary matching the output schema  
3. Use the specified APIs correctly according to their documentation
4. Handle all edge cases and errors gracefully
5. Include clear documentation and examples

Make sure the generated code is syntactically correct and follows best practices for chemistry computation tools.`;
    }

    private validateResponse(response: any): void {
        if (!response.pythonCode || typeof response.pythonCode !== 'string') {
            throw new Error('Missing or invalid pythonCode in implementer response');
        }

        if (!Array.isArray(response.dependencies)) {
            throw new Error('dependencies must be an array');
        }


        if (!response.implementation_notes || typeof response.implementation_notes !== 'string') {
            throw new Error('Missing or invalid implementation_notes in implementer response');
        }


        // Basic Python code validation - check for common syntax issues
        if (!response.pythonCode.includes('def ') || !response.pythonCode.includes('(input_data: dict)')) {
            throw new Error('Generated code must contain a function with input_data parameter');
        }

        if (!response.pythonCode.includes('"""') && !response.pythonCode.includes("'''")) {
            throw new Error('Generated code must include docstring');
        }
    }
}