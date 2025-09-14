// Main session interface - shows workflow progress and tools
import { 
  Box, 
  Typography, 
  Card, 
  CardContent,
  Alert,
  Skeleton,
  IconButton
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useAtomValue, atom } from 'jotai'
import { SessionStatus } from '@agent-browser/schema'
import { useSessionVM } from '../hooks/useSessionVM'
import { WorkflowProgress } from './WorkflowProgress'
import { RequirementDisplay } from './RequirementDisplay'
import { ToolsPanel } from './ToolsPanel'
import { EventLog} from "./EventLog.tsx";

interface SessionViewProps {
  sessionId: string
  onBack?: () => void
}

export function SessionView({ sessionId, onBack }: SessionViewProps) {
  const sessionVM = useSessionVM(sessionId)
  
  // Always call hooks - use default atoms if sessionVM is null
  const status = useAtomValue(sessionVM?.statusAtom ?? atom(SessionStatus.PENDING))
  const requirement = useAtomValue(sessionVM?.requirementAtom ?? atom(''))
  const tools = useAtomValue(sessionVM?.toolsAtom ?? atom([]))
  
  if (!sessionVM) {
    return <SessionLoadingSkeleton />
  }
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Session Header */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {onBack && (
              <IconButton 
                onClick={onBack} 
                sx={{ mr: 2 }}
                aria-label="Back to sessions list"
              >
                <ArrowBackIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 0 }}>
                Computation Session
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Session ID: {sessionId}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      {/* Requirement Display */}
      <RequirementDisplay requirement={requirement} />
      
      {/* Workflow Progress */}
      <WorkflowProgress sessionVM={sessionVM} />
      
      {/* Error State */}
      {status === SessionStatus.FAILED && (
        <Alert severity="error">
          The workflow has failed. Please check the event log for details or try creating a new session.
        </Alert>
      )}

        {/* Event Log */}
        <EventLog sessionId={sessionId} />
      {/* Tools Panel - only show when tools are available */}
      {tools.length > 0 && (
        <ToolsPanel sessionVM={sessionVM} />
      )}
      
    </Box>
  )
}

// Loading skeleton while session data is being fetched
function SessionLoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="text" width="60%" height={20} />
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Skeleton variant="text" width="30%" height={24} />
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="60%" height={20} />
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="rectangular" width="100%" height={8} sx={{ my: 2 }} />
          <Skeleton variant="text" width="50%" height={20} />
        </CardContent>
      </Card>
    </Box>
  )
}