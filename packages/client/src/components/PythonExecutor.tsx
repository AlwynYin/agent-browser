// Python code executor component adapted from Forest's CodeInterpreterNode
import { useState, useRef, useEffect } from 'react'
import {
  Box,
  Button,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { ToolSpec, ExecutionResult } from '@agent-browser/schema'
import { api } from '../utils/api'
import { SyntaxHighlightedCodeEditor } from './SyntaxHighlightedCodeEditor'

interface PythonExecutorProps {
  tool?: ToolSpec
  sessionId: string
  initialCode?: string
  onExecutionResult?: (result: ExecutionResult) => void
}

export function PythonExecutor({ 
  tool, 
  sessionId, 
  initialCode = '', 
  onExecutionResult 
}: PythonExecutorProps) {
  const [code, setCode] = useState(initialCode || tool?.pythonCode || '')
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [parameterDialogOpen, setParameterDialogOpen] = useState(false)
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({})
  const [parameterSchema, setParameterSchema] = useState<Record<string, any>>({})
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize code from tool if provided
  useEffect(() => {
    if (tool?.pythonCode && !initialCode) {
      setCode(tool.pythonCode)
    }
  }, [tool?.pythonCode, initialCode])

  const executeCode = async () => {
    if (!code.trim()) {
      setResult({
        id: 'error',
        sessionId,
        toolId: tool?.id || 'direct',
        input: {},
        output: null,
        success: false,
        error: 'No code to execute',
        executionTime: 0,
        createdAt: new Date()
      })
      return
    }

    // Check if we need parameters
    if (tool?.inputSchema && needsParameters(tool.inputSchema)) {
      setParameterSchema(tool.inputSchema.properties || {})
      // Initialize parameter values based on schema defaults
      const initialValues: Record<string, any> = {}
      Object.keys(tool.inputSchema.properties || {}).forEach(key => {
        const param = tool.inputSchema.properties[key]
        initialValues[key] = param.default !== undefined ? param.default : getDefaultValueForType(param.type)
      })
      setParameterValues(initialValues)
      setParameterDialogOpen(true)
      return
    }

    // Execute code without parameters
    await executeCodeWithParameters({})
  }

  const executeCodeWithParameters = async (parameters: Record<string, any>) => {
    setLoading(true)
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      let executionResult: ExecutionResult

      if (tool && code === tool.pythonCode) {
        // Execute via tool execution API if code hasn't been modified
        executionResult = await api.executeTool(sessionId, tool.id, { input: parameters })
      } else {
        // Code has been modified or no tool - would need direct execution endpoint
        // For now, create a mock result showing the modified code would run
        executionResult = {
          id: 'custom-' + Date.now(),
          sessionId,
          toolId: tool?.id || 'custom',
          input: parameters,
          output: 'Custom code execution not yet implemented. Your modified code:\n\n' + code,
          success: true,
          error: null,
          executionTime: 0,
          createdAt: new Date()
        }
      }

      setResult(executionResult)
      onExecutionResult?.(executionResult)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setResult({
          id: 'cancelled',
          sessionId,
          toolId: tool?.id || 'direct',
          input: parameters,
          output: null,
          success: false,
          error: 'Execution cancelled',
          executionTime: 0,
          createdAt: new Date()
        })
      } else {
        setResult({
          id: 'error',
          sessionId,
          toolId: tool?.id || 'direct',
          input: parameters,
          output: null,
          success: false,
          error: error.message,
          executionTime: 0,
          createdAt: new Date()
        })
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const stopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleParameterDialogSubmit = async () => {
    setParameterDialogOpen(false)
    await executeCodeWithParameters(parameterValues)
  }

  const needsParameters = (schema: any): boolean => {
    return schema?.properties && Object.keys(schema.properties).length > 0
  }

  const getDefaultValueForType = (type: string): any => {
    switch (type) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'array': return []
      case 'object': return {}
      default: return null
    }
  }

  const formatOutput = (output: any): string => {
    if (typeof output === 'string') return output
    return JSON.stringify(output, null, 2)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">
          {tool ? `${tool.name} - Python Executor` : 'Python Code Executor'}
        </Typography>
        {tool?.dependencies && tool.dependencies.length > 0 && (
          <Box sx={{ ml: 2, display: 'flex', gap: 0.5 }}>
            {tool.dependencies.map(dep => (
              <Chip key={dep} label={dep} size="small" variant="outlined" />
            ))}
          </Box>
        )}
      </Box>

      {/* Code Editor */}
      <Box sx={{ flex: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2">
            Python Code:
          </Typography>
          {tool && code !== tool.pythonCode && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip 
                label="Modified" 
                size="small" 
                color="warning" 
                variant="outlined"
              />
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setCode(tool.pythonCode)}
                variant="outlined"
              >
                Reset
              </Button>
            </Box>
          )}
        </Box>
        <SyntaxHighlightedCodeEditor
          value={code}
          onChange={setCode}
          language="python"
          readOnly={false}
          placeholder="Enter your Python code here..."
          height="100%"
          minHeight={300}
        />
      </Box>

      {/* Controls */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
          onClick={executeCode}
          disabled={loading || !code.trim()}
          fullWidth
        >
          {loading ? 'Running...' : 'Run Code'}
        </Button>
        {loading && (
          <Button
            variant="outlined"
            startIcon={<StopIcon />}
            onClick={stopExecution}
            color="error"
          >
            Stop
          </Button>
        )}
      </Box>

      {/* Execution Result */}
      {result && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">
              Execution Result {result.success ? '✓' : '✗'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              <Alert 
                severity={result.success ? 'success' : 'error'}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">
                  {result.success 
                    ? `Execution completed in ${result.executionTime}ms`
                    : `Execution failed: ${result.error}`
                  }
                </Typography>
              </Alert>

              {result.success && result.output && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Output:
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      maxHeight: 200,
                      overflow: 'auto',
                      backgroundColor: 'grey.50',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {formatOutput(result.output)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Parameter Input Dialog */}
      <Dialog 
        open={parameterDialogOpen} 
        onClose={() => setParameterDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} />
            Enter Parameters
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide values for the following parameters:
          </Typography>
          {Object.keys(parameterSchema).map((paramKey) => {
            const param = parameterSchema[paramKey]
            return (
              <Box key={paramKey} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label={paramKey}
                  value={parameterValues[paramKey] || ''}
                  onChange={(e) => setParameterValues(prev => ({
                    ...prev,
                    [paramKey]: e.target.value
                  }))}
                  placeholder={param.description || `Enter ${paramKey}`}
                  helperText={
                    <>
                      Type: {param.type || 'string'}
                      {param.description && <><br/>{param.description}</>}
                      {param.default !== undefined && <>
                        <br/>Default: {JSON.stringify(param.default)}</>}
                      {param.required && <><br/>Required: Yes</>}
                    </>
                  }
                  required={param.required}
                  multiline={param.type === 'object' || param.type === 'array'}
                  rows={param.type === 'object' || param.type === 'array' ? 3 : 1}
                />
              </Box>
            )
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParameterDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleParameterDialogSubmit} 
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
          >
            {loading ? 'Running...' : 'Run Code'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}