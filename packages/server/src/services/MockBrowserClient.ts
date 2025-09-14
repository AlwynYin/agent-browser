import { 
    BrowserClient, 
    BrowserTask, 
    BrowserTaskResult, 
    BrowserTaskStep, 
    BrowserOutputFile 
} from './BrowserClient';

/**
 * Mock browser client for testing and development purposes.
 * Simulates browser automation without making actual API calls.
 */
export class MockBrowserClient implements BrowserClient {
    private taskCounter = 0;
    private tasks: Map<string, BrowserTaskResult> = new Map();

    getClientName(): string {
        return 'Mock Browser Client (Testing)';
    }

    async isAvailable(): Promise<boolean> {
        console.log('🔍 MockBrowserClient: Always available for testing');
        return true;
    }

    async createTask(task: BrowserTask): Promise<string> {
        const taskId = `mock-task-${++this.taskCounter}`;
        console.log(`🚀 MockBrowserClient: Creating mock task ${taskId} for "${task.task.substring(0, 50)}..."`);
        
        // Create a mock task result
        const mockResult: BrowserTaskResult = {
            id: taskId,
            task: task.task,
            llm: task.llm || 'mock-llm',
            status: 'pending',
            output: 'Mock task created',
            structuredOutput: this.generateMockApiSpecs(task),
            steps: [
                {
                    id: 'step-1',
                    type: 'navigation',
                    status: 'completed',
                    content: 'Navigated to mock documentation site',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'step-2',
                    type: 'extraction',
                    status: 'completed',
                    content: 'Extracted mock API specifications',
                    createdAt: new Date().toISOString()
                }
            ],
            outputFiles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionId: task.sessionId,
            metadata: task.metadata
        };

        this.tasks.set(taskId, mockResult);
        return taskId;
    }

    async waitForTaskCompletion(taskId: string, timeoutMs: number = 1200000): Promise<BrowserTaskResult> {
        console.log(`⏳ MockBrowserClient: Simulating task completion for ${taskId}`);
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Mock task not found: ${taskId}`);
        }

        // Mark task as finished
        task.status = 'finished';
        task.output = 'Mock task completed successfully';
        task.updatedAt = new Date().toISOString();

        console.log(`✅ MockBrowserClient: Task ${taskId} completed`);
        return task;
    }

    async getTaskStatus(taskId: string): Promise<BrowserTaskResult> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Mock task not found: ${taskId}`);
        }
        return task;
    }

    async stopTask(taskId: string): Promise<void> {
        console.log(`🛑 MockBrowserClient: Stopping mock task ${taskId}`);
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'stopped';
            task.updatedAt = new Date().toISOString();
        }
    }

    /**
     * Generate mock API specifications for testing
     */
    private generateMockApiSpecs(task: BrowserTask): any {
        // Extract package name from task description
        const packageMatch = task.task.match(/Package: (\w+)/);
        const packageName = packageMatch ? packageMatch[1] : 'mock-package';

        return {
            apiSpecs: [
                {
                    name: `${packageName}.mock_function`,
                    package: packageName,
                    description: `Mock function for ${packageName} testing`,
                    usage: `${packageName}.mock_function(param1, param2=None)`,
                    parameters: [
                        {
                            name: 'param1',
                            type: 'string',
                            description: 'Mock parameter 1',
                            required: true
                        },
                        {
                            name: 'param2',
                            type: 'optional[string]',
                            description: 'Optional mock parameter 2',
                            required: false,
                            defaultValue: 'None'
                        }
                    ],
                    returnType: 'MockResult',
                    examples: [
                        {
                            code: `${packageName}.mock_function("test")`,
                            description: 'Basic usage example',
                            expectedOutput: 'MockResult(value="test")'
                        }
                    ],
                    sourceUrl: `https://mock-docs.example.com/${packageName}`
                },
                {
                    name: `${packageName}.another_mock_function`,
                    package: packageName,
                    description: `Another mock function for ${packageName}`,
                    usage: `${packageName}.another_mock_function(data, options={})`,
                    parameters: [
                        {
                            name: 'data',
                            type: 'array',
                            description: 'Input data array',
                            required: true
                        },
                        {
                            name: 'options',
                            type: 'dict',
                            description: 'Configuration options',
                            required: false,
                            defaultValue: '{}'
                        }
                    ],
                    returnType: 'ProcessedData',
                    examples: [
                        {
                            code: `${packageName}.another_mock_function([1, 2, 3])`,
                            description: 'Process array data',
                            expectedOutput: 'ProcessedData([1, 2, 3])'
                        }
                    ],
                    sourceUrl: `https://mock-docs.example.com/${packageName}/advanced`
                }
            ]
        };
    }
}