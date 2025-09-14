import { loadConfig } from '../config';
import { 
    BrowserClient, 
    BrowserTask, 
    BrowserTaskResult, 
    BrowserTaskStep, 
    BrowserOutputFile 
} from './BrowserClient';

// Browser-Use Cloud API Types
interface CreateTaskRequest {
    task: string;
    llm?: string;
    startUrl?: string;
    maxSteps?: number;
    structuredOutput?: any;
    sessionId?: string;
    metadata?: Record<string, any>;
    secrets?: Record<string, string>;
    allowedDomains?: string[];
    flashMode?: boolean;
    thinking?: boolean;
    vision?: boolean;
}

interface TaskResponse {
    id: string;
    task: string;
    llm: string;
    status: 'pending' | 'running' | 'finished' | 'failed' | 'stopped' | 'paused';
    output: any;
    structuredOutput?: any;
    steps: TaskStep[];
    outputFiles: OutputFile[];
    createdAt: string;
    updatedAt: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}

interface TaskStep {
    id: string;
    type: string;
    status: string;
    content: string;
    createdAt: string;
}

interface OutputFile {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
}

interface CreateTaskResponse {
    id: string;
}

export class BrowserUseCloudClient implements BrowserClient {
    private apiKey: string | null = null;
    private initialized = false;
    private baseUrl = 'https://api.browser-use.com/api/v2';

    private ensureInitialized() {
        if (!this.initialized) {
            const config = loadConfig();
            this.apiKey = config.browserUseApiKey;
            this.initialized = true;
            
            if (this.apiKey) {
                console.log(`🔑 BrowserUseCloudClient initialized with API key: ${this.apiKey.substring(0, 8)}...`);
            } else {
                console.log(`⚠️ BrowserUseCloudClient initialized without API key`);
            }
        }
    }

    constructor() {
        // Don't initialize immediately - wait for first use
        console.log(`🔍 BrowserUseCloudClient created (lazy initialization)`);
    }

    private async makeRequest<T>(
        endpoint: string, 
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
        body?: any
    ): Promise<T> {
        this.ensureInitialized();
        
        if (!this.apiKey) {
            throw new Error('BROWSER_USE_API_KEY is required');
        }
        
        const url = `${this.baseUrl}${endpoint}`;
        
        const headers: Record<string, string> = {
            'X-Browser-Use-API-Key': this.apiKey,
            'Content-Type': 'application/json',
        };

        const config: RequestInit = {
            method,
            headers,
        };

        if (body && (method === 'POST' || method === 'PATCH')) {
            config.body = JSON.stringify(body);
        }

        console.log(`🌐 Making ${method} request to: ${url}`);
        
        const response = await fetch(url, config);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Browser-Use API error (${response.status}): ${errorText}`);
            throw new Error(`Browser-Use API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Browser-Use API response received`);
        
        return data as T;
    }

    // BrowserClient interface implementation
    async createTask(task: BrowserTask): Promise<string> {
        console.log(`🚀 Creating browser-use task: "${task.task.substring(0, 50)}..."`);
        
        const response = await this.makeRequest<CreateTaskResponse>('/tasks', 'POST', {
            task: task.task,
            llm: task.llm || 'gemini-2.5-flash', // Fast and cost-effective
            maxSteps: task.maxSteps || 80,
            structuredOutput: task.structuredOutput,
            flashMode: task.flashMode ?? true, // Enable fast mode
            thinking: task.thinking ?? false, // Disable thinking for speed
            vision: task.vision ?? true, // Enable vision for better web understanding
            ...task
        });

        console.log(`✅ Task created with ID: ${response.id}`);
        return response.id;
    }

    async getTask(taskId: string): Promise<TaskResponse> {
        console.log(`📊 Getting task status: ${taskId}`);
        return await this.makeRequest<TaskResponse>(`/tasks/${taskId}`);
    }

    async waitForTaskCompletion(taskId: string, timeoutMs: number = 1200000): Promise<BrowserTaskResult> {
        console.log(`⏳ Waiting for task completion: ${taskId} (timeout: ${timeoutMs}ms)`);
        
        const startTime = Date.now();
        const pollInterval = 10000; // Poll every 2 seconds

        while (Date.now() - startTime < timeoutMs) {
            const task = await this.getTask(taskId);
            
            console.log(`📊 Task ${taskId} status: ${task.status}`);

            if (task.status === 'finished') {
                console.log(`✅ Task finished: ${taskId}`);
                return this.convertToBrowserTaskResult(task);
            }

            if (task.status === 'failed' || task.status === 'stopped') {
                console.log(`❌ Task failed/stopped: ${taskId}`);
                throw new Error(`Task ${task.status}: ${taskId}`);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Task timeout after ${timeoutMs}ms: ${taskId}`);
    }

    async getTaskStatus(taskId: string): Promise<BrowserTaskResult> {
        const task = await this.getTask(taskId);
        return this.convertToBrowserTaskResult(task);
    }

    getClientName(): string {
        return 'Browser-Use Cloud API';
    }

    async stopTask(taskId: string): Promise<void> {
        console.log(`🛑 Stopping task: ${taskId}`);
        await this.makeRequest(`/tasks/${taskId}`, 'PATCH', {
            action: 'stop'
        });
    }

    async getAccountInfo(): Promise<any> {
        console.log(`👤 Getting account info`);
        return await this.makeRequest('/accounts/me');
    }

    // Helper method to check if API key is working
    async isAvailable(): Promise<boolean> {
        try {
            await this.getAccountInfo();
            return true;
        } catch (error) {
            console.log(`❌ Browser-Use API unavailable: ${error.message}`);
            return false;
        }
    }

    // Convert Browser-Use API response to BrowserClient interface format
    private convertToBrowserTaskResult(task: TaskResponse): BrowserTaskResult {
        return {
            id: task.id,
            task: task.task,
            llm: task.llm,
            status: task.status,
            output: task.output,
            structuredOutput: task.structuredOutput,
            steps: task.steps.map(step => ({
                id: step.id,
                type: step.type,
                status: step.status,
                content: step.content,
                createdAt: step.createdAt
            })),
            outputFiles: task.outputFiles.map(file => ({
                id: file.id,
                name: file.fileName,
                type: file.contentType,
                url: '', // Browser-Use doesn't provide direct URLs
                size: file.sizeBytes
            })),
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            sessionId: task.sessionId,
            metadata: task.metadata
        };
    }
}