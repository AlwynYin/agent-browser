// API client utilities for communicating with the backend
import {
  CreateSessionRequest,
  CreateSessionResponse,
  ExecuteToolRequest,
  ExecuteToolResponse,
  GetSessionResponse,
  GetSessionsResponse
} from '../types/api'

const API_BASE_URL = '/api'

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let errorCode: string | undefined
    
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
      errorCode = errorData.code
    } catch {
      // Ignore JSON parsing errors for error responses
    }
    
    throw new ApiError(errorMessage, response.status, errorCode)
  }
  
  return response.json()
}

export const api = {
  // Session management
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    return fetchApi<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
  
  async getSession(sessionId: string): Promise<GetSessionResponse> {
    return fetchApi<GetSessionResponse>(`/sessions/${sessionId}`)
  },
  
  async getUserSessions(userId: string, limit?: number): Promise<GetSessionsResponse> {
    const params = limit ? `?limit=${limit}` : ''
    const sessions = await fetchApi<SessionM[]>(`/sessions/user/${userId}${params}`)
    return { sessions }
  },
  
  async cancelSession(sessionId: string): Promise<void> {
    await fetchApi(`/sessions/${sessionId}/cancel`, {
      method: 'POST',
    })
  },
  
  async deleteSession(sessionId: string): Promise<void> {
    await fetchApi(`/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  },
  
  // Tool execution
  async executeTool(
    sessionId: string, 
    toolId: string, 
    request: ExecuteToolRequest
  ): Promise<ExecuteToolResponse> {
    return fetchApi<ExecuteToolResponse>(
      `/sessions/${sessionId}/tools/${toolId}/execute`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    )
  },
  
  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await fetch('/health')
    return response.json()
  }
}

export { ApiError }

import { SessionM } from '@agent-browser/schema'