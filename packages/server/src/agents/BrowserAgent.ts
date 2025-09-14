import {SearchPlan, SearchQuery, ApiSpec} from '@agent-browser/schema';
import {BrowserClient, BrowserTask} from '../services/BrowserClient';

// Documentation site mappings for chemistry packages
const DOCUMENTATION_SITES = {
    'ase': ['https://wiki.fysik.dtu.dk/ase/', 'https://ase-lib.org/'],
    'pyscf': ['https://pyscf.org/user.html', 'https://pyscf.org/pyscf_api_docs/pyscf.html'],
    'rdkit': ['https://rdkit.org/docs/', 'https://www.rdkit.org/docs/source/rdkit.html'],
    'numpy': ['https://numpy.org/doc/stable/reference/', 'https://numpy.org/devdocs/reference/'],
    'scipy': ['https://docs.scipy.org/doc/scipy/reference/', 'https://scipy.github.io/devdocs/reference/'],
    'matplotlib': ['https://matplotlib.org/stable/api/', 'https://matplotlib.org/stable/gallery/'],
    'pandas': ['https://pandas.pydata.org/docs/reference/', 'https://pandas.pydata.org/docs/user_guide/']
};

// Structured output schema for API extraction
interface ApiSpecExtraction {
    name: string;
    package: string;
    description: string;
    usage: string;
    parameters: {
        name: string;
        type: string;
        description: string;
        required: boolean;
        defaultValue?: string;
    }[];
    returnType: string;
    examples: {
        code: string;
        description: string;
        expectedOutput?: string;
    }[];
    sourceUrl: string;
}

interface BrowserAgentOutput {
    apiSpecs: ApiSpecExtraction[];
}

interface QueryResult {
    query: string;
    success: boolean;
    apiSpecs?: ApiSpec[];
    error?: string;
}

export class BrowserAgent {
    private browserClient: BrowserClient;

    constructor(browserClient: BrowserClient) {
        this.browserClient = browserClient;
        console.log(`🔍 BrowserAgent initialized with ${browserClient.getClientName()}`);
    }

    async isAvailable(): Promise<boolean> {
        console.log('🔍 BrowserAgent: Checking availability...');
        const available = await this.browserClient.isAvailable();
        console.log(`✅ BrowserAgent availability: ${available}`);
        return available;
    }

    async searchApis(
        searchPlan: SearchPlan, 
        progressCallback?: (message: string, queryIndex: number) => void,
        sessionId?: string
    ): Promise<ApiSpec[]> {
        console.log(`🔍 BrowserAgent.searchApis called with ${searchPlan.queries.length} queries`);
        
        // Check if service is available
        const available = await this.isAvailable();
        if (!available) {
            throw new Error(`${this.browserClient.getClientName()} is not available. Please check your configuration.`);
        }

        console.log(`✅ ${this.browserClient.getClientName()} is available, proceeding with search...`);

        const allApiSpecs: ApiSpec[] = [];

        try {
            console.log(`📊 Processing ${searchPlan.queries.length} queries concurrently for packages: ${searchPlan.targetPackages.join(', ')}`);
            
            // Process queries in batches of 4 concurrent sessions (reduced from 8 for stability)
            const maxConcurrent = 8;
            const results = await this.processConcurrentQueries(searchPlan.queries, maxConcurrent, progressCallback);
            
            // Flatten all results
            for (const queryResult of results) {
                if (queryResult.success && queryResult.apiSpecs) {
                    allApiSpecs.push(...queryResult.apiSpecs);
                }
            }

            console.log(`✅ Browser Agent completed. Total API specs found: ${allApiSpecs.length}`);
            return allApiSpecs;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ BrowserAgent search failed: ${errorMessage}`);
            throw new Error(`Browser Agent failed to search APIs: ${errorMessage}`);
        }
    }

    private async processConcurrentQueries(queries: SearchQuery[], maxConcurrent: number, progressCallback?: (message: string, queryIndex: number) => void): Promise<QueryResult[]> {
        const results: QueryResult[] = [];
        
        // Process queries in batches of maxConcurrent
        for (let i = 0; i < queries.length; i += maxConcurrent) {
            const batch = queries.slice(i, i + maxConcurrent);
            console.log(`🔄 Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(queries.length / maxConcurrent)} with ${batch.length} queries`);
            
            // Send progress callbacks for each query in the batch
            batch.forEach((query, batchIndex) => {
                const queryIndex = i + batchIndex + 1;
                if (progressCallback) {
                    progressCallback(`Starting search for "${query.query}" in ${query.package}`, queryIndex);
                }
            });

            // Process batch concurrently
            const batchPromises = batch.map((query, batchIndex) => 
                this.processQuery(query, i + batchIndex + 1, queries.length)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Process settled results
            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const query = batch[j];
                
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.log(`❌ Query failed: ${query.query} - ${result.reason}`);
                    results.push({
                        query: query.query,
                        success: false,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            }
            
            // Add delay between batches to avoid overwhelming the API
            if (i + maxConcurrent < queries.length) {
                console.log(`⏳ Waiting 2 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return results;
    }

    private async processQuery(query: SearchQuery, queryIndex: number, totalQueries: number): Promise<QueryResult> {
        console.log(`🔄 Query ${queryIndex}/${totalQueries}: "${query.query}" (${query.package})`);
        
        try {
            const taskDescription = this.buildSearchTask(query);
            console.log(`📝 Task description length: ${taskDescription.length} characters`);
            
            // Create structured output schema for this specific query
            const structuredOutput = {
                type: "object",
                properties: {
                    apiSpecs: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                package: { type: "string" },
                                description: { type: "string" },
                                usage: { type: "string" },
                                parameters: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            type: { type: "string" },
                                            description: { type: "string" },
                                            required: { type: "boolean" },
                                            defaultValue: { type: "string" }
                                        },
                                        required: ["name", "type", "description", "required"]
                                    }
                                },
                                returnType: { type: "string" },
                                examples: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            code: { type: "string" },
                                            description: { type: "string" },
                                            expectedOutput: { type: "string" }
                                        },
                                        required: ["code", "description"]
                                    }
                                },
                                sourceUrl: { type: "string" }
                            },
                            required: ["name", "package", "description", "usage", "parameters", "returnType", "examples", "sourceUrl"]
                        }
                    }
                },
                required: ["apiSpecs"]
            };

            // Create and execute browser task
            console.log(`🚀 Creating browser-use task for package: ${query.package}`);
            const taskId = await this.browserClient.createTask({
                task: taskDescription,
                llm: 'gemini-2.5-flash',
                maxSteps: 50,
                structuredOutput: JSON.stringify(structuredOutput),
                flashMode: true,
                thinking: false,
                vision: true
            });

            console.log(`⏳ Waiting for task completion: ${taskId}`);
            
            // Wait for completion with timeout
            let result;
            try {
                result = await this.browserClient.waitForTaskCompletion(taskId, 18000000);
            } catch (timeoutError) {
                console.log(`⚠️ Task timed out, attempting to stop task: ${taskId}`);
                try {
                    await this.browserClient.stopTask(taskId);
                    console.log(`🛑 Task stopped: ${taskId}`);
                } catch (stopError) {
                    console.log(`❌ Failed to stop task: ${stopError.message}`);
                }
                throw timeoutError;
            }

            console.log(`📄 Task completed with status: ${result.status}`);
            console.log(`📊 Task steps: ${result.steps?.length || 0}`);
            
            // Extract structured output
            if (result.structuredOutput && result.structuredOutput.apiSpecs) {
                const queryApiSpecs = result.structuredOutput.apiSpecs.map((spec: ApiSpecExtraction) => 
                    this.convertToApiSpec(spec)
                );
                
                console.log(`✅ Found ${queryApiSpecs.length} API specs for query: ${query.query}`);
                const apiNames = queryApiSpecs.map(spec => spec.name);
                console.log(`📋 Extracted APIs: ${apiNames.join(', ')}`);
                
                return {
                    query: query.query,
                    success: true,
                    apiSpecs: queryApiSpecs
                };
            } else {
                console.log(`⚠️ No structured output found for query: ${query.query}`);
                return {
                    query: query.query,
                    success: false,
                    error: 'No structured output found'
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ Query failed: ${query.query} - ${errorMessage}`);
            
            return {
                query: query.query,
                success: false,
                error: errorMessage
            };
        }
    }

    private buildSearchTask(query: SearchQuery): string {
        const sites = DOCUMENTATION_SITES[query.package] || [`https://pypi.org/project/${query.package}/`];
        
        return `You are an expert at parsing technical documentation and extracting API specifications from chemistry package documentation.

Your task is to search for API documentation related to: "${query.query}"
Package: ${query.package}
Purpose: ${query.purpose}

Navigate to these documentation sites:
${sites.map(site => `- ${site}`).join('\n')}

Search for functions, methods, or classes related to the query.
Extract comprehensive API specifications for all relevant functions you find.

For each API function you find, extract:
- Complete function name and signature
- Clear description of what the function does
- All parameters with types, descriptions, and default values
- Return type and description
- Practical code examples with expected outputs
- Source URL where the documentation was found

Quality Requirements:
- Only extract APIs with clear parameter documentation
- Include multiple related functions if they're all relevant
- Preserve exact function names and parameter names
- Capture practical, executable code examples
- Ensure all extracted information is accurate and complete

Focus on well-documented APIs with clear parameters and usage examples.
Be thorough and systematic in your search.

IMPORTANT: Return the results in the exact structured format specified. The apiSpecs array should contain all the API specifications you found.`;
    }

    private convertToApiSpec(browserSpec: ApiSpecExtraction): ApiSpec {
        return {
            id: crypto.randomUUID(),
            sessionId: '', // Will be set by SessionService
            name: browserSpec.name,
            package: browserSpec.package,
            description: browserSpec.description,
            usage: browserSpec.usage,
            parameters: browserSpec.parameters.map(param => ({
                name: param.name,
                type: param.type,
                description: param.description,
                required: param.required,
                defaultValue: param.defaultValue
            })),
            returnType: browserSpec.returnType,
            examples: browserSpec.examples.map(example => ({
                code: example.code,
                description: example.description,
                expectedOutput: example.expectedOutput
            })),
            sourceUrl: browserSpec.sourceUrl,
            createdAt: new Date()
        };
    }
}