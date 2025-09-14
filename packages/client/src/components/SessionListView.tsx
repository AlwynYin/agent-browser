import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Skeleton,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material'
import {
  MenuBook as MenuBookIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { SessionM, SessionStatus } from '@agent-browser/schema'
import { api } from '../utils/api'
import { formatDistanceToNow } from 'date-fns'

interface SessionListViewProps {
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
}

interface SessionCardProps {
  session: SessionM
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onRefresh: () => void
}

function SessionCard({ session, onSelect, onDelete, onRefresh }: SessionCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    setMenuAnchor(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteSession(session.id)
      onDelete(session.id)
      onRefresh()
    } catch (error) {
      console.error('Failed to delete session:', error)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      handleMenuClose()
    }
  }

  const getStatusIcon = (status: SessionStatus) => {
    switch (status) {
      case SessionStatus.COMPLETED:
        return <CheckIcon color="success" />
      case SessionStatus.FAILED:
        return <ErrorIcon color="error" />
      case SessionStatus.PROCESSING:
        return <PlayIcon color="primary" />
      case SessionStatus.PENDING:
        return <ScheduleIcon color="action" />
      default:
        return <BuildIcon color="action" />
    }
  }

  const getStatusColor = (status: SessionStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' => {
    switch (status) {
      case SessionStatus.COMPLETED:
        return 'success'
      case SessionStatus.FAILED:
        return 'error'
      case SessionStatus.PROCESSING:
        return 'primary'
      default:
        return 'default'
    }
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  return (
    <>
      <Card 
        sx={{ 
          height: '100%', 
          cursor: 'pointer', 
          transition: 'all 0.2s',
          '&:hover': { 
            transform: 'translateY(-2px)', 
            boxShadow: 3 
          }
        }}
        onClick={() => onSelect(session.id)}
      >
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              {getStatusIcon(session.status)}
              <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}>
                <Typography variant="h6" component="h3" sx={{ 
                  fontSize: '1rem', 
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  Session {session.id.substring(0, 8)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                </Typography>
              </Box>
            </Box>
            
            <IconButton 
              size="small" 
              onClick={handleMenuOpen}
              sx={{ flexShrink: 0 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          {/* Status and Tools Count */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip 
              label={session.status} 
              size="small" 
              color={getStatusColor(session.status)}
              variant="outlined"
            />
            {session.tools && session.tools.length > 0 && (
              <Chip 
                label={`${session.tools.length} tools`} 
                size="small" 
                icon={<BuildIcon />}
                variant="outlined"
                color="primary"
              />
            )}
          </Box>

          {/* Requirement */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {truncateText(session.requirement)}
          </Typography>

          {/* Metadata */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Updated {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {session.id.substring(0, 8)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => onSelect(session.id)}>
          <PlayIcon sx={{ mr: 1 }} />
          Open Session
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteDialogOpen(true)
            handleMenuClose()
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Session</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this session? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Session: {truncateText(session.requirement, 60)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={deleting}
            startIcon={deleting ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function SessionListSkeleton() {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" width="60%" height={20} sx={{ ml: 1 }} />
              </Box>
              <Skeleton variant="text" width="40%" height={16} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={16} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={60} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

export function SessionListView({ onSelectSession, onCreateSession }: SessionListViewProps) {
  const [sessions, setSessions] = useState<SessionM[]>([])
  const [filteredSessions, setFilteredSessions] = useState<SessionM[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // For now, use a default user ID - in a real app this would come from auth
  const userId = 'user-1'

  const fetchSessions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getUserSessions(userId, 50);
      console.log("userid:", userId)
      console.log("response", response)
      setSessions(response.sessions)
      setFilteredSessions(response.sessions)
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      setError('Failed to load sessions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredSessions(sessions)
    } else {
      const filtered = sessions.filter(session =>
        session.requirement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredSessions(filtered)
    }
  }, [searchQuery, sessions])

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setFilteredSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleRefresh = () => {
    fetchSessions()
  }

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <MenuBookIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Your Sessions
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Loading your computational chemistry sessions...
              </Typography>
            </Box>
          </Box>
        </Box>
        <SessionListSkeleton />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={handleRefresh}
        >
          Try Again
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MenuBookIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Your Sessions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {sessions.length === 0 
                ? 'No sessions yet. Create your first computational chemistry session!'
                : `${sessions.length} session${sessions.length === 1 ? '' : 's'} • ${filteredSessions.length} shown`
              }
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Tooltip title="Refresh sessions">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button 
            variant="contained" 
            onClick={onCreateSession}
            startIcon={<PlayIcon />}
          >
            New Session
          </Button>
        </Box>
      </Box>

      {/* Search */}
      {sessions.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Search sessions by requirement or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 500 }}
          />
        </Box>
      )}

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          {sessions.length === 0 ? (
            // No sessions at all
            <>
              <MenuBookIcon sx={{ fontSize: 80, color: 'text.secondary', opacity: 0.5, mb: 3 }} />
              <Typography variant="h5" gutterBottom color="text.secondary">
                Ready to start computing?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Create your first session to generate Python tools for chemistry calculations
              </Typography>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<PlayIcon />}
                onClick={onCreateSession}
              >
                Create First Session
              </Button>
            </>
          ) : (
            // No search results
            <>
              <SearchIcon sx={{ fontSize: 80, color: 'text.secondary', opacity: 0.5, mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                No sessions found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search terms or create a new session
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredSessions.map((session) => (
            <Grid item xs={12} sm={6} md={4} key={session.id}>
              <SessionCard
                session={session}
                onSelect={onSelectSession}
                onDelete={handleDeleteSession}
                onRefresh={handleRefresh}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}