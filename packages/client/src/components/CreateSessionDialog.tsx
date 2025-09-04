// Dialog for creating new computation sessions
import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  Typography,
  Chip
} from '@mui/material'
import { useAtom } from 'jotai'
import { isCreatingSessionAtom, createSessionErrorAtom } from '../atoms/sessionAtoms'
import { api } from '../utils/api'

interface CreateSessionDialogProps {
  open: boolean
  onClose: () => void
  onSessionCreated: (sessionId: string) => void
}

export function CreateSessionDialog({ open, onClose, onSessionCreated }: CreateSessionDialogProps) {
  const [requirement, setRequirement] = useState('')
  const [isCreating, setIsCreating] = useAtom(isCreatingSessionAtom)
  const [error, setError] = useAtom(createSessionErrorAtom)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!requirement.trim()) {
      setError('Please enter a requirement')
      return
    }
    
    setIsCreating(true)
    setError(null)
    
    try {
      const response = await api.createSession({
        requirement: requirement.trim(),
        userId: 'user-1' // For now, using a hardcoded user ID
      })
      
      onSessionCreated(response.sessionId)
      setRequirement('')
      
    } catch (err: any) {
      setError(err.message || 'Failed to create session')
    } finally {
      setIsCreating(false)
    }
  }
  
  const handleClose = () => {
    if (!isCreating) {
      setRequirement('')
      setError(null)
      onClose()
    }
  }
  
  const exampleRequirements = [
    "Calculate molecular descriptors for benzene",
    "Optimize water molecule geometry using DFT",
    "Generate conformers for a drug molecule",
    "Perform MD simulation setup for a protein",
    "Calculate HOMO-LUMO gap for a series of molecules"
  ]
  
  const handleExampleClick = (example: string) => {
    setRequirement(example)
  }
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Create New Computation Session
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Describe what you want to compute. The system will automatically find the right tools and implement the solution.
            </Typography>
          </Box>
          
          <TextField
            autoFocus
            label="What would you like to compute?"
            multiline
            rows={4}
            fullWidth
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="E.g., Calculate molecular descriptors for a SMILES string using RDKit"
            disabled={isCreating}
            sx={{ mb: 3 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Example requirements:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {exampleRequirements.map((example, index) => (
                <Chip
                  key={index}
                  label={example}
                  variant="outlined"
                  size="small"
                  clickable
                  onClick={() => handleExampleClick(example)}
                  disabled={isCreating}
                />
              ))}
            </Box>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleClose} 
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="contained"
            disabled={isCreating || !requirement.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Session'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}