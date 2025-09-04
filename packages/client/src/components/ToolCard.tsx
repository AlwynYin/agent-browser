// Individual tool interface for execution and results display
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Terminal as TerminalIcon,
  Input as InputIcon
} from '@mui/icons-material'
import { ToolSpec, ExecutionResult } from '@agent-browser/schema'
import { api } from '../utils/api'
import { PythonExecutor } from './PythonExecutor'

interface ToolCardProps {
  tool: ToolSpec
  sessionId: string
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tool-tabpanel-${index}`}
      aria-labelledby={`tool-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  )
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

export function ToolCard({ tool, sessionId }: ToolCardProps) {
  const [input, setInput] = useState(getDefaultInput(tool))
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  
  const handleExecute = async () => {
    setInputError(null)
    
    // Validate JSON input
    let parsedInput: any
    try {
      parsedInput = JSON.parse(input)
    } catch (e) {
      setInputError('Invalid JSON format')
      return
    }
    
    setExecuting(true)
    try {
      const executionResult = await api.executeTool(sessionId, tool.id, { input: parsedInput })
      setResult(executionResult)
    } catch (error: any) {
      setResult({
        id: 'error',
        sessionId,
        toolId: tool.id,
        input: parsedInput,
        output: null,
        success: false,
        error: error.message,
        executionTime: 0,
        createdAt: new Date()
      })
    } finally {
      setExecuting(false)
    }
  }
  
  const formatOutput = (output: any): string => {
    if (typeof output === 'string') return output
    return JSON.stringify(output, null, 2)
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleExecutionResult = (executionResult: ExecutionResult) => {
    setResult(executionResult)
  }
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h3">
            {tool.name}
          </Typography>
          <Chip 
            label={tool.status} 
            size="small" 
            color={tool.status === 'implemented' ? 'success' : 'default'}
            sx={{ ml: 'auto' }}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {tool.description}
        </Typography>
        
        {/* Dependencies */}
        {tool.dependencies.length > 0 && (
          <Box sx={{ mt: 1, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Dependencies:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {tool.dependencies.map((dep: string) => (
                <Chip key={dep} label={dep} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
          <Tab 
            icon={<InputIcon />} 
            label="Input/Execute" 
            id="tool-tab-0"
            aria-controls="tool-tabpanel-0"
          />
          <Tab 
            icon={<TerminalIcon />} 
            label="Python Executor" 
            id="tool-tab-1"
            aria-controls="tool-tabpanel-1"
          />
          <Tab 
            icon={<CodeIcon />} 
            label="View Code" 
            id="tool-tab-2"
            aria-controls="tool-tabpanel-2"
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Simple Input/Execute Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Input Field */}
            <TextField
              label="Input (JSON)"
              multiline
              minRows={3}
              maxRows={6}
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              error={!!inputError}
              helperText={inputError}
              disabled={executing}
              placeholder="Enter input data as JSON..."
            />
            
            {/* Execute Button */}
            <Button
              variant="contained"
              startIcon={executing ? <CircularProgress size={16} /> : <PlayIcon />}
              onClick={handleExecute}
              disabled={executing || !input.trim()}
              fullWidth
            >
              {executing ? 'Executing...' : 'Execute'}
            </Button>
            
            {/* Execution Result */}
            {result && (
              <Box>
                <Alert 
                  severity={result.success ? 'success' : 'error'}
                  icon={result.success ? <CheckIcon /> : <ErrorIcon />}
                >
                  <Typography variant="subtitle2">
                    {result.success ? 'Execution completed' : 'Execution failed'}
                  </Typography>
                  <Typography variant="body2">
                    Time: {result.executionTime}ms
                  </Typography>
                </Alert>
                
                {result.success && result.output && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Output:
                    </Typography>
                    <Box 
                      sx={{ 
                        backgroundColor: 'grey.50',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        maxHeight: 200,
                        overflow: 'auto'
                      }}
                    >
                      {formatOutput(result.output)}
                    </Box>
                  </Box>
                )}
                
                {!result.success && result.error && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      Error:
                    </Typography>
                    <Typography variant="body2" color="error">
                      {result.error}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Python Executor Tab */}
        <TabPanel value={tabValue} index={1}>
          <PythonExecutor 
            tool={tool}
            sessionId={sessionId}
            onExecutionResult={handleExecutionResult}
          />
        </TabPanel>

        {/* Code View Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box
            sx={{
              backgroundColor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxHeight: 400,
              overflow: 'auto'
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {tool.pythonCode}
            </pre>
          </Box>
        </TabPanel>
      </Box>
    </Card>
  )
}

// Generate default input based on tool's input schema
function getDefaultInput(tool: ToolSpec): string {
  if (!tool.inputSchema) {
    return '{}'
  }
  
  // Simple default input generation based on schema
  const schema = tool.inputSchema
  if (schema.type === 'object' && schema.properties) {
    const defaultObj: any = {}
    Object.keys(schema.properties).forEach(key => {
      const prop = schema.properties[key]
      switch (prop.type) {
        case 'string':
          defaultObj[key] = prop.example || 'example'
          break
        case 'number':
          defaultObj[key] = prop.example || 0
          break
        case 'boolean':
          defaultObj[key] = prop.example || false
          break
        case 'array':
          defaultObj[key] = prop.example || []
          break
        default:
          defaultObj[key] = prop.example || null
      }
    })
    return JSON.stringify(defaultObj, null, 2)
  }
  
  return '{}'
}