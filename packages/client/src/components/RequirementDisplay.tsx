// Component to display the user's computation requirement
// Component to display the user's computation requirement
import { 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Chip
} from '@mui/material'
import { Assignment as AssignmentIcon } from '@mui/icons-material'

interface RequirementDisplayProps {
  requirement: string
}

export function RequirementDisplay({ requirement }: RequirementDisplayProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Requirement
          </Typography>
          <Chip 
            label="User Input" 
            size="small" 
            variant="outlined" 
            sx={{ ml: 2 }} 
          />
        </Box>
        
        <Typography 
          variant="body1" 
          sx={{ 
            backgroundColor: 'grey.50',
            p: 2,
            borderRadius: 1,
            borderLeft: 3,
            borderLeftColor: 'primary.main'
          }}
        >
          "{requirement}"
        </Typography>
      </CardContent>
    </Card>
  )
}