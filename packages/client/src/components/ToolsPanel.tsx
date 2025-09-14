// Component for displaying and executing implemented tools
// Component for displaying and executing implemented tools
import { 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Grid,
  Chip
} from '@mui/material'
import { 
  Build as BuildIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material'
import { useAtomValue } from 'jotai'
import { SessionVM } from '@agent-browser/schema'
import { ToolCard } from './ToolCard'

interface ToolsPanelProps {
  sessionVM: SessionVM
}

export function ToolsPanel({ sessionVM }: ToolsPanelProps) {
  const tools = useAtomValue(sessionVM.toolsAtom)
  const implementationPlan = useAtomValue(sessionVM.implementationPlanAtom)
  
  if (tools.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <BuildIcon sx={{ mr: 1, color: 'success.main' }} />
          <Typography variant="h6">
            Available Tools
          </Typography>
          <Chip 
            label={`${tools.length} implemented`}
            size="small" 
            color="success" 
            variant="outlined"
            icon={<CheckIcon />}
            sx={{ ml: 2 }} 
          />
        </Box>

        {implementationPlan && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Complexity: {implementationPlan.estimatedComplexity}
            </Typography>
            {implementationPlan.dependencies.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  Dependencies:
                </Typography>
                {implementationPlan.dependencies.map((dep: string) => (
                  <Chip
                    key={dep}
                    label={dep}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
        <Box sx={{ width: "75%", mx: "auto" }}>
          <Grid container spacing={3}>
            {tools.map((tool: any) => (
              <Grid item xs={12} key={tool.id}>
                <ToolCard
                  tool={tool}
                  sessionId={sessionVM.sessionM.id}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </CardContent>
    </Card>
  )
}