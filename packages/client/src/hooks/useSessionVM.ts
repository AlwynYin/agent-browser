// Custom hook for session view model management following Forest's patterns
import { useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { SessionVM, SessionM } from '@agent-browser/schema'
import { 
  sessionViewModelsAtom, 
  webSocketConnectedAtom 
} from '../atoms/sessionAtoms'
import { api } from '../utils/api'
import { useWebSocket } from './useWebSocket'

export function useSessionVM(sessionId: string): SessionVM | null {
  const [viewModels, setViewModels] = useAtom(sessionViewModelsAtom)
  const webSocketConnected = useAtomValue(webSocketConnectedAtom)
  const { joinSession, leaveSession } = useWebSocket()
  
  useEffect(() => {
    let isCancelled = false
    
    async function initializeSessionVM() {
      if (viewModels[sessionId]) {
        // Session VM already exists
        return
      }
      
      try {
        // Fetch session data from API
        console.log(`📡 Fetching session data: ${sessionId}`)
        const sessionData = await api.getSession(sessionId)
        
        if (isCancelled) return
        
        // Create new SessionVM
        const sessionM: SessionM = sessionData
        const sessionVM = new SessionVM(sessionM, sessionId, sessionViewModelsAtom as any)
        
        // Add to view models store
        setViewModels(prev => ({
          ...prev,
          [sessionId]: sessionVM
        }))
        
        console.log(`✅ Session VM created for: ${sessionId}`)
        
      } catch (error) {
        console.error(`❌ Failed to initialize session VM for ${sessionId}:`, error)
      }
    }
    
    initializeSessionVM()
    
    return () => {
      isCancelled = true
    }
  }, [sessionId, viewModels, setViewModels])
  
  useEffect(() => {
    // Join WebSocket room when session VM is ready and WebSocket is connected
    if (viewModels[sessionId] && webSocketConnected) {
      joinSession(sessionId)
      
      return () => {
        leaveSession(sessionId)
      }
    }
  }, [sessionId, viewModels, webSocketConnected, joinSession, leaveSession])
  
  return viewModels[sessionId] || null
}

// Hook for managing multiple session VMs (for session list views)
export function useSessionVMs(sessionIds: string[]): Record<string, SessionVM> {
  const [viewModels, setViewModels] = useAtom(sessionViewModelsAtom)
  
  useEffect(() => {
    let isCancelled = false
    
    async function initializeMissingSessions() {
      const missingSessions = sessionIds.filter(id => !viewModels[id])
      
      if (missingSessions.length === 0) return
      
      try {
        // Fetch missing sessions in parallel
        const sessionPromises = missingSessions.map(id => api.getSession(id))
        const sessionResults = await Promise.allSettled(sessionPromises)
        
        if (isCancelled) return
        
        const newViewModels: Record<string, SessionVM> = {}
        
        sessionResults.forEach((result, index) => {
          const sessionId = missingSessions[index]
          
          if (result.status === 'fulfilled') {
            const sessionM: SessionM = result.value
            newViewModels[sessionId] = new SessionVM(sessionM, sessionId, sessionViewModelsAtom as any)
          } else {
            console.error(`❌ Failed to load session ${sessionId}:`, result.reason)
          }
        })
        
        if (Object.keys(newViewModels).length > 0) {
          setViewModels(prev => ({
            ...prev,
            ...newViewModels
          }))
        }
        
      } catch (error) {
        console.error('❌ Failed to initialize session VMs:', error)
      }
    }
    
    initializeMissingSessions()
    
    return () => {
      isCancelled = true
    }
  }, [sessionIds, viewModels, setViewModels])
  
  // Return only the requested session VMs
  const requestedVMs: Record<string, SessionVM> = {}
  sessionIds.forEach(id => {
    if (viewModels[id]) {
      requestedVMs[id] = viewModels[id]
    }
  })
  
  return requestedVMs
}