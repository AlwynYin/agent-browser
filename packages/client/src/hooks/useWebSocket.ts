// WebSocket hook for real-time session updates
import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { io, Socket } from 'socket.io-client'
import { 
  webSocketConnectedAtom, 
  webSocketErrorAtom,
  sessionViewModelsAtom 
} from '../atoms/sessionAtoms'
import { WebSocketMessage, StatusUpdateMessage, ToolImplementedMessage, ExecutionResultMessage } from '../types/api'

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useAtom(webSocketConnectedAtom)
  const [error, setError] = useAtom(webSocketErrorAtom)
  const [viewModels, setViewModels] = useAtom(sessionViewModelsAtom)
  const viewModelsRef = useRef(viewModels)
  
  // Keep the ref updated with latest viewModels
  viewModelsRef.current = viewModels
  
  useEffect(() => {
    // Prevent multiple connections in React Strict Mode
    if (socketRef.current?.connected) {
      console.log('🔗 WebSocket already connected, skipping...')
      return
    }
    
    // Create WebSocket connection
    const serverUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
      : window.location.origin
      
    console.log('🔗 Connecting to WebSocket server:', serverUrl)
    
    socketRef.current = io(serverUrl, {
      transports: ['polling', 'websocket'], // Try polling first for stability
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000
    })
    
    const socket = socketRef.current
    
    socket.on('connect', () => {
      console.log('🔌 Connected to server')
      setConnected(true)
      setError(null)
    })
    
    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server')
      setConnected(false)
    })
    
    socket.on('connect_error', (err) => {
      console.error('🔌 Connection error:', err)
      setConnected(false)
      setError(err.message)
    })
    
    // Handle session updates - define handler inside effect to capture latest viewModels
    const handleSessionUpdate = (message: WebSocketMessage) => {
      console.log('📡 Received session update:', message.type)
      
      // Find the session ID from the message context
      const sessionId = extractSessionId(message)
      if (!sessionId) {
        console.warn('⚠️ Session update received without session ID:', message)
        return
      }
      
      const sessionVM = viewModelsRef.current[sessionId]
      if (!sessionVM) {
        console.warn('⚠️ Session update received for unknown session:', sessionId)
        return
      }
      
      switch (message.type) {
        case 'status-update':
          const statusMsg = message as StatusUpdateMessage
          sessionVM.onStatusUpdate(statusMsg.status as any)
          // Trigger UI update by updating the sessionViewModelsAtom
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'tool-implemented':
          const toolMsg = message as ToolImplementedMessage
          const updatedTools = [...sessionVM.sessionM.tools, toolMsg.tool]
          sessionVM.onToolsUpdate(updatedTools)
          // Trigger UI update
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'execution-result':
          const resultMsg = message as ExecutionResultMessage
          sessionVM.onResultUpdate(resultMsg.result)
          // Trigger UI update
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'implementation-plan':
          sessionVM.onImplementationPlanUpdate(message.plan)
          // Trigger UI update
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'search-plan':
          sessionVM.onSearchPlanUpdate(message.plan)
          // Trigger UI update
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'api-specs':
          sessionVM.onApiSpecsUpdate(message.apiSpecs)
          // Trigger UI update
          setViewModels(prev => ({ ...prev, [sessionId]: sessionVM }))
          break
          
        case 'error':
          console.error('❌ Session error:', message.error)
          break
          
        default:
          console.warn('⚠️ Unknown session update type:', message.type)
      }
    }
    
    socket.on('session-update', handleSessionUpdate)
    
    return () => {
      socket.disconnect()
    }
  }, [setConnected, setError])
  
  const extractSessionId = (message: WebSocketMessage): string | null => {
    // Try to extract session ID from various message types
    if ('sessionId' in message && message.sessionId) {
      return message.sessionId
    }
    if ('result' in message && message.result?.sessionId) {
      return message.result.sessionId
    }
    if ('tool' in message && message.tool?.sessionId) {
      return message.tool.sessionId
    }
    if ('plan' in message && message.plan?.sessionId) {
      return message.plan.sessionId
    }
    return null
  }
  
  const joinSession = (sessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-session', sessionId)
      console.log(`👥 Joined session: ${sessionId}`)
    }
  }
  
  const leaveSession = (sessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-session', sessionId)
      console.log(`👋 Left session: ${sessionId}`)
    }
  }
  
  return {
    connected,
    error,
    joinSession,
    leaveSession,
  }
}