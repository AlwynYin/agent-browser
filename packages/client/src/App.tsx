// Main App component
import { useState } from 'react'
import { 
  Container, 
  AppBar, 
  Toolbar, 
  Typography, 
  Box,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material'
import { Add as AddIcon, MenuBook as MenuBookIcon } from '@mui/icons-material'
import { useAtom } from 'jotai'
import { currentSessionIdAtom } from './atoms/sessionAtoms'
import { SessionView } from './components/SessionView'
import { CreateSessionDialog } from './components/CreateSessionDialog'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const [currentSessionId, setCurrentSessionId] = useAtom(currentSessionIdAtom)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Initialize WebSocket connection
  useWebSocket()
  
  const handleNewSession = () => {
    setCreateDialogOpen(true)
  }
  
  const handleSessionCreated = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setCreateDialogOpen(false)
  }
  
  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false)
  }
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <MenuBookIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Agent Browser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chemistry Computation Tools
          </Typography>
        </Toolbar>
      </AppBar>
      
      {/* Main Content */}
      <Container maxWidth="xl" sx={{ flex: 1, py: 3 }}>
        {currentSessionId ? (
          <SessionView sessionId={currentSessionId} />
        ) : (
          <WelcomeView onCreateSession={handleNewSession} />
        )}
      </Container>
      
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create new session"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={handleNewSession}
      >
        <AddIcon />
      </Fab>
      
      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        onSessionCreated={handleSessionCreated}
      />
      
      {/* Session List Drawer - placeholder for future implementation */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Sessions
          </Typography>
          <List>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemText 
                  primary="Session placeholder"
                  secondary="Coming soon..."
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </Box>
  )
}

// Welcome view shown when no session is selected  
function WelcomeView({ onCreateSession: _onCreateSession }: { onCreateSession: () => void }) {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        gap: 3
      }}
    >
      <MenuBookIcon sx={{ fontSize: 80, color: 'primary.main', opacity: 0.6 }} />
      
      <Box>
        <Typography variant="h3" gutterBottom color="primary">
          Welcome to Agent Browser
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mb: 4 }}>
          An agentic system that creates Python tools for chemistry computation. 
          Get started by describing what you need to compute.
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Examples you can try:
        </Typography>
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" color="text.secondary">
            • "Calculate molecular descriptors for a SMILES string"
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • "Optimize a molecular structure using ASE"
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • "Perform DFT calculations with PySCF"
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}