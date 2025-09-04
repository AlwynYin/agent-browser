// API types for frontend communication
import { 
  SessionM, 
  ExecutionResult, 
  ToolSpec 
} from '@agent-browser/schema'

// API request/response types
export interface CreateSessionRequest {
  requirement: string
  userId: string
}

export interface CreateSessionResponse {
  sessionId: string
}

export interface ExecuteToolRequest {
  input: any
}

export interface ExecuteToolResponse extends ExecutionResult {}

export interface GetSessionResponse extends SessionM {}

export interface GetSessionsResponse {
  sessions: SessionM[]
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'status-update' | 'tool-implemented' | 'execution-result' | 'implementation-plan' | 'search-plan' | 'api-specs' | 'error'
  timestamp: string
  [key: string]: any
}

export interface StatusUpdateMessage extends WebSocketMessage {
  type: 'status-update'
  status: string
  progress?: number
}

export interface ToolImplementedMessage extends WebSocketMessage {
  type: 'tool-implemented'
  tool: ToolSpec
}

export interface ExecutionResultMessage extends WebSocketMessage {
  type: 'execution-result'
  result: ExecutionResult
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error'
  error: string
  context?: any
}