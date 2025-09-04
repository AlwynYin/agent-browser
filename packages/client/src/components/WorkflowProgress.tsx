// Component showing the current workflow step and progress
// Component showing the current workflow step and progress
import { 
  Card, 
  CardContent, 
  Typography, 
  LinearProgress,
  Box,
  Stepper,
  Step,
  StepLabel,
  Chip
} from '@mui/material'
import { 
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material'
import { useAtomValue } from 'jotai'
import { SessionVM, SessionStatus } from '@agent-browser/schema'

interface WorkflowProgressProps {
  sessionVM: SessionVM
}

export function WorkflowProgress({ sessionVM }: WorkflowProgressProps) {
  const status = useAtomValue(sessionVM.statusAtom)
  const progress = useAtomValue(sessionVM.progressAtom)
  const currentStep = useAtomValue(sessionVM.currentStepAtom)
  
  const steps = [
    { label: 'Planning', status: SessionStatus.PLANNING, icon: <AutoAwesomeIcon /> },
    { label: 'Searching', status: SessionStatus.SEARCHING, icon: <AutoAwesomeIcon /> },
    { label: 'Implementing', status: SessionStatus.IMPLEMENTING, icon: <AutoAwesomeIcon /> },
    { label: 'Ready', status: SessionStatus.COMPLETED, icon: <CheckIcon /> }
  ]
  
  const getStepState = (stepStatus: SessionStatus) => {
    const statusOrder = [
      SessionStatus.PENDING,
      SessionStatus.PLANNING,
      SessionStatus.SEARCHING, 
      SessionStatus.IMPLEMENTING,
      SessionStatus.EXECUTING,
      SessionStatus.COMPLETED
    ]
    
    const currentIndex = statusOrder.indexOf(status)
    const stepIndex = statusOrder.indexOf(stepStatus)
    
    if (status === SessionStatus.FAILED) {
      return currentIndex >= stepIndex ? 'error' : 'pending'
    }
    
    if (currentIndex > stepIndex) {
      return 'completed'
    } else if (currentIndex === stepIndex) {
      return 'active'
    } else {
      return 'pending'
    }
  }
  
  const getStatusIcon = () => {
    if (status === SessionStatus.FAILED) {
      return <ErrorIcon color="error" />
    }
    if (status === SessionStatus.COMPLETED) {
      return <CheckIcon color="success" />
    }
    return <PlayIcon color="primary" />
  }
  
  const getStatusColor = () => {
    if (status === SessionStatus.FAILED) return 'error'
    if (status === SessionStatus.COMPLETED) return 'success'
    return 'primary'
  }
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" sx={{ ml: 1, mr: 2 }}>
            Workflow Progress
          </Typography>
          <Chip 
            label={status}
            size="small" 
            color={getStatusColor()}
            variant="outlined"
          />
        </Box>
        
        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: status === SessionStatus.FAILED ? 'error.main' : 'primary.main'
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {currentStep}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress}%
            </Typography>
          </Box>
        </Box>
        
        {/* Step Indicator */}
        <Stepper activeStep={getCurrentStepIndex(status)} alternativeLabel>
          {steps.map((step, _index) => {
            const stepState = getStepState(step.status)
            return (
              <Step key={step.label} completed={stepState === 'completed'}>
                <StepLabel 
                  error={stepState === 'error'}
                  icon={stepState === 'active' ? step.icon : undefined}
                >
                  {step.label}
                </StepLabel>
              </Step>
            )
          })}
        </Stepper>
      </CardContent>
    </Card>
  )
}

function getCurrentStepIndex(status: SessionStatus): number {
  switch (status) {
    case SessionStatus.PENDING:
      return -1
    case SessionStatus.PLANNING:
      return 0
    case SessionStatus.SEARCHING:
      return 1
    case SessionStatus.IMPLEMENTING:
      return 2
    case SessionStatus.EXECUTING:
    case SessionStatus.COMPLETED:
      return 3
    case SessionStatus.FAILED:
      return -1
    default:
      return -1
  }
}