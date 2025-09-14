// Component for displaying session events and logs
import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress
} from '@mui/material'
import {
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  AutoAwesome as AutoAwesomeIcon,
  Error as ErrorIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  CloudDownload as DownloadIcon,
  Build as BuildIcon
} from '@mui/icons-material'
import { io, Socket } from 'socket.io-client'
import { SessionStatus } from '@agent-browser/schema'

interface SessionEvent {
  id: string
  type: 'status_update' | 'tool_implemented' | 'execution_result' | 'error' | 'info'
  message: string
  timestamp: Date
  data?: any
  icon: React.ReactNode
  color: 'primary' | 'success' | 'error' | 'warning' | 'info'
}

interface EventLogProps {
  sessionId: string
}

export function EventLog({ sessionId }: EventLogProps) {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [connected, setConnected] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)

  // Add event helper function
  const addEvent = (
    type: SessionEvent['type'], 
    message: string, 
    data?: any,
    icon?: React.ReactNode,
    color?: SessionEvent['color']
  ) => {
    const newEvent: SessionEvent = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: new Date(),
      data,
      icon: icon || getDefaultIcon(type),
      color: color || getDefaultColor(type)
    }
    setEvents(prev => [...prev, newEvent])
  }

  const getDefaultIcon = (type: SessionEvent['type']) => {
    switch (type) {
      case 'status_update': return <AutoAwesomeIcon />
      case 'tool_implemented': return <CodeIcon />
      case 'execution_result': return <PlayIcon />
      case 'error': return <ErrorIcon />
      default: return <InfoIcon />
    }
  }

  const getDefaultColor = (type: SessionEvent['type']): SessionEvent['color'] => {
    switch (type) {
      case 'status_update': return 'primary'
      case 'tool_implemented': return 'info'
      case 'execution_result': return 'success'
      case 'error': return 'error'
      default: return 'primary'
    }
  }

  const getStatusIcon = (status: SessionStatus) => {
    switch (status) {
      case 'pending': return <InfoIcon />
      case 'planning': return <AutoAwesomeIcon />
      case 'searching': return <DownloadIcon />
      case 'implementing': return <BuildIcon />
      case 'completed': return <CheckIcon />
      case 'failed': return <ErrorIcon />
      default: return <InfoIcon />
    }
  }

  // Initialize component and connect to WebSocket for real-time events
  useEffect(() => {
    if (!sessionId) return
    
    // Add initial events
    addEvent('info', 'Event log initialized', { sessionId })
    
    // Create WebSocket connection
    const socketConnection = io('/', {
      transports: ['websocket'],
      forceNew: true
    })
    
    setSocket(socketConnection)
    
    // Connection event handlers
    socketConnection.on('connect', () => {
      console.log('EventLog: Connected to server')
      setConnected(true)
      addEvent('info', 'Connected to session', { sessionId })
      
      // Join the session room
      socketConnection.emit('join-session', sessionId)
    })
    
    socketConnection.on('disconnect', () => {
      console.log('EventLog: Disconnected from server')
      setConnected(false)
      addEvent('error', 'Disconnected from session')
    })
    
    socketConnection.on('connect_error', (error) => {
      console.error('EventLog: Connection error:', error)
      setConnected(false)
      addEvent('error', `Connection error: ${error.message}`)
    })
    
    // Listen for the unified session-update event from the server
    socketConnection.on('session-update', (update) => {
      console.log('EventLog: Session update:', update)
      
      switch (update.type) {
        case 'status-update':
          addEvent('status_update', `Session status: ${update.status}`, update, getStatusIcon(update.status))
          break
          
        case 'tool-implemented':
          addEvent('tool_implemented', `Tool implemented: ${update.tool.name}`, update, <CodeIcon />, 'info')
          break
          
        case 'execution-result':
          const success = update.result.success !== false
          addEvent(
            'execution_result', 
            `Tool executed: ${success ? 'succeeded' : 'failed'}`, 
            update, 
            success ? <PlayIcon /> : <ErrorIcon />,
            success ? 'success' : 'error'
          )
          break
          
        case 'implementation-plan':
          addEvent('info', 'Implementation plan created', update, <BuildIcon />, 'primary')
          break
          
        case 'search-plan':
          addEvent('info', 'Search plan created', update, <DownloadIcon />, 'primary')
          break
          
        case 'api-specs':
          addEvent('info', `Found ${update.apiSpecs.length} API specifications`, update, <DownloadIcon />, 'success')
          break
          
        case 'error':
          // Check if this is a search progress event (special case)
          if (update.context?.type === 'search-progress') {
            addEvent('info', update.error, update, <DownloadIcon />, 'primary')
          } else {
            addEvent('error', update.error, update, <ErrorIcon />, 'error')
          }
          break
          
        default:
          addEvent('info', `Update: ${update.type}`, update, <InfoIcon />, 'primary')
          break
      }
    })
    
    // Cleanup on unmount
    return () => {
      console.log('EventLog: Cleaning up WebSocket connection')
      socketConnection.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [sessionId])

  
  const formatTime = (timestamp: Date): string => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }
  
  return (
    <Accordion defaultExpanded={true}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TimelineIcon sx={{ mr: 1 }} />
          <Typography variant="h6">
            Event Log
          </Typography>
          <Chip 
            label={`${events.length} events`}
            size="small" 
            variant="outlined"
            sx={{ ml: 2 }} 
          />
          {!connected && (
            <Chip 
              label="Disconnected"
              size="small" 
              color="error"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      </AccordionSummary>
      
      <AccordionDetails>
        {!connected && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                Connecting to session...
              </Typography>
            </Box>
          </Alert>
        )}
        
        <List>
          {events.map((event) => (
            <ListItem key={event.id}>
              <ListItemIcon>
                <Box sx={{ color: `${event.color}.main` }}>
                  {event.icon}
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={event.message}
                secondary={
                  <span>
                    {formatTime(event.timestamp)} • {event.type.replace('_', ' ')}
                    {event.data?.status && ` • ${event.data.status}`}
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
        
        {events.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No events yet. Events will appear here as the workflow progresses.
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}