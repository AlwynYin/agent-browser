// Abstract interface for browser automation clients
// This allows pluggable browser implementations (Browser-Use, Playwright, Puppeteer, etc.)

export interface BrowserTask {
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

export interface BrowserTaskStep {
    id: string;
    type: string;
    status: string;
    content: string;
    createdAt: string;
}

export interface BrowserOutputFile {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
}

export interface BrowserTaskResult {
    id: string;
    task: string;
    llm: string;
    status: 'pending' | 'running' | 'finished' | 'failed' | 'stopped' | 'paused';
    output: any;
    structuredOutput?: any;
    steps: BrowserTaskStep[];
    outputFiles: BrowserOutputFile[];
    createdAt: string;
    updatedAt: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}

/**
 * Abstract interface for browser automation clients.
 * Implementations can use different providers: Browser-Use, Playwright, Puppeteer, etc.
 */
export interface BrowserClient {
    /**
     * Check if the browser client is available and configured properly
     */
    isAvailable(): Promise<boolean>;

    /**
     * Create a new browser automation task
     * @param task - The task configuration
     * @returns The task ID for tracking
     */
    createTask(task: BrowserTask): Promise<string>;

    /**
     * Wait for a task to complete with timeout
     * @param taskId - The task ID to wait for
     * @param timeoutMs - Timeout in milliseconds
     * @returns The completed task result
     */
    waitForTaskCompletion(taskId: string, timeoutMs?: number): Promise<BrowserTaskResult>;

    /**
     * Stop a running task
     * @param taskId - The task ID to stop
     */
    stopTask(taskId: string): Promise<void>;

    /**
     * Get the current status of a task
     * @param taskId - The task ID to check
     * @returns The current task result
     */
    getTaskStatus(taskId: string): Promise<BrowserTaskResult>;

    /**
     * Get the display name of this browser client implementation
     */
    getClientName(): string;
}