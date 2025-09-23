# Tool Service Integration Design

## Overview

This document outlines the design for a Tool Service that integrates with the SimpleTooling framework for runtime tool registration and serving. The service generates Python tools from natural language descriptions and automatically registers them with a running SimpleTooling server.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Tool Generator │───▶│  Tool Service   │───▶│  SimpleTooling  │
│     Service     │    │   Integration   │    │     Server      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Generated      │    │  Tool Files     │    │  HTTP Endpoints │
│  Python Code    │    │  (.py files)    │    │  (/tool/*)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Service Components

### 1. Tool Generation Service
- Generates Python functions from natural language descriptions
- Creates SimpleTooling-compatible files with proper decorators
- Handles type inference and validation
- Manages dependencies and imports

### 2. Tool Registration Service
- Integrates with SimpleTooling's runtime registration endpoints
- Manages tool lifecycle (create, update, reload)
- Handles bulk operations
- Maintains metadata and registry

### 3. File Management Service
- Organizes generated tools in directory structure
- Handles file naming and conflict resolution
- Manages metadata files
- Supports bulk file operations

## API Endpoints

### Tool Generation

#### `POST /api/v1/tools/generate`
Generate and register individual tools.

**Request Body:**
```typescript
interface ToolGenerationRequest {
    requirements: ToolRequirement[]
    options?: GenerationOptions
}

interface ToolRequirement {
    description: string           // Natural language tool description
    input: string                // Input parameter description
    output: string               // Expected output description
    name?: string                // Optional tool name override
}

interface GenerationOptions {
    autoRegister?: boolean       // Auto-register with SimpleTooling (default: true)
    targetDirectory?: string     // Target directory (default: "tools/generated")
    simpletoolingUrl?: string    // SimpleTooling server URL (default: http://localhost:8000)
}
```

**Response:**
```typescript
interface ToolGenerationResponse {
    tools: GeneratedTool[]
    summary: GenerationSummary
    registrationResults?: RegistrationResult[]
}

interface GeneratedTool {
    toolId: string
    name: string
    fileName: string
    filePath: string
    description: string
    endpoint?: string            // SimpleTooling endpoint URL
    createdAt: string
}
```

#### `POST /api/v1/tools/generate-bulk`
Generate multiple tools from a bulk specification.

**Request Body:**
```typescript
interface BulkGenerationRequest {
    toolSpecs: BulkToolSpec[]
    options?: GenerationOptions
}

interface BulkToolSpec {
    category: string             // e.g., "data-analysis", "chemistry", "file-processing"
    requirements: ToolRequirement[]
    sharedDependencies?: string[] // Common dependencies for the category
}
```

**Response:**
```typescript
interface BulkGenerationResponse {
    categories: CategoryResult[]
    totalGenerated: number
    totalRegistered: number
    summary: GenerationSummary
}

interface CategoryResult {
    category: string
    tools: GeneratedTool[]
    success: number
    failed: number
}
```

### Tool Management

#### `POST /api/v1/tools/register`
Register existing tool files with SimpleTooling.

**Request Body:**
```typescript
interface RegistrationRequest {
    filePaths: string[]
    simpletoolingUrl?: string
}
```

#### `POST /api/v1/tools/reload`
Reload specific tools in SimpleTooling.

**Request Body:**
```typescript
interface ReloadRequest {
    toolNames: string[]
    simpletoolingUrl?: string
}
```

#### `GET /api/v1/tools`
List all generated tools.

**Response:**
```typescript
interface ToolListResponse {
    tools: GeneratedTool[]
    categories: string[]
    totalCount: number
}
```

#### `DELETE /api/v1/tools/{toolId}`
Remove a generated tool.

### File Operations

#### `POST /api/v1/files/upload-bulk`
Upload multiple Python tool files for registration.

**Request Body:** `multipart/form-data`
- `files[]`: Python files
- `options`: JSON with registration options

**Response:**
```typescript
interface BulkUploadResponse {
    uploadedFiles: UploadedFile[]
    registeredTools: GeneratedTool[]
    errors: UploadError[]
}

interface UploadedFile {
    originalName: string
    savedPath: string
    size: number
}

interface UploadError {
    fileName: string
    error: string
}
```

#### `GET /api/v1/files/scan`
Scan tools directory for unregistered files.

**Response:**
```typescript
interface ScanResponse {
    unregisteredFiles: string[]
    registeredFiles: string[]
    totalFiles: number
}
```

### Status and Health

#### `GET /api/v1/status`
Service status and SimpleTooling connectivity.

**Response:**
```typescript
interface StatusResponse {
    service: 'healthy' | 'unhealthy'
    simpletooling: {
        connected: boolean
        url: string
        lastCheck: string
    }
    toolsDirectory: {
        path: string
        totalTools: number
        lastScan: string
    }
}
```

## Tool File Structure

### Generated Tool Format
```python
"""
Generated Tool: Calculate Molecular Weight
Created: 2024-01-15T10:31:30Z
Tool ID: tool_abc123
Category: chemistry
Dependencies: rdkit, numpy
"""

from tools.toolset import toolset
from typing import Dict, Any

@toolset.add()
def calculate_molecular_weight(smiles: str) -> Dict[str, float]:
    """
    Calculate molecular weight of a chemical compound from SMILES string.

    :param smiles: SMILES string representation of the molecule
    :return: Dictionary containing molecular weight
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors

    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError(f"Invalid SMILES string: {smiles}")

        molecular_weight = Descriptors.MolWt(mol)
        return {'molecular_weight': molecular_weight}
    except Exception as e:
        raise ValueError(f"Error calculating molecular weight: {str(e)}")

# Tool metadata for service tracking
__TOOL_METADATA__ = {
    "tool_id": "tool_abc123",
    "category": "chemistry",
    "generated_at": "2024-01-15T10:31:30Z",
    "dependencies": ["rdkit", "numpy"]
}
```

### Directory Structure
```
simpletooling_template/
├── tools/
│   ├── __init__.py
│   ├── toolset.py
│   ├── generated/                    # Auto-generated tools
│   │   ├── chemistry/
│   │   │   ├── calculate_molecular_weight.py
│   │   │   └── protein_analysis.py
│   │   ├── data_analysis/
│   │   │   ├── csv_processor.py
│   │   │   └── statistical_analysis.py
│   │   └── file_processing/
│   │       ├── pdf_converter.py
│   │       └── image_processor.py
│   ├── custom/                       # User-uploaded tools
│   │   └── user_tool.py
│   └── metadata/
│       ├── registry.json             # Tool registry
│       ├── dependencies.json         # Global dependencies
│       └── categories.json           # Category mappings
└── main.py
```

### Metadata Files

#### Registry (`metadata/registry.json`)
```json
{
  "tool_abc123": {
    "name": "calculate_molecular_weight",
    "fileName": "calculate_molecular_weight.py",
    "filePath": "tools/generated/chemistry/calculate_molecular_weight.py",
    "category": "chemistry",
    "description": "Calculate molecular weight from SMILES string",
    "endpoint": "http://localhost:8000/tool/calculate_molecular_weight",
    "dependencies": ["rdkit", "numpy"],
    "createdAt": "2024-01-15T10:31:30Z",
    "registeredAt": "2024-01-15T10:31:45Z"
  }
}
```

#### Categories (`metadata/categories.json`)
```json
{
  "chemistry": {
    "description": "Chemical analysis and molecular tools",
    "tools": ["tool_abc123", "tool_def456"],
    "commonDependencies": ["rdkit", "numpy", "pandas"]
  },
  "data_analysis": {
    "description": "Data processing and statistical analysis tools",
    "tools": ["tool_ghi789"],
    "commonDependencies": ["pandas", "numpy", "matplotlib"]
  }
}
```

## Integration Workflow

### 1. Tool Generation Flow
```
User Request → Tool Service → AI Generation → File Creation → SimpleTooling Registration → HTTP Endpoint
```

1. **Request Processing**: Parse tool requirements and options
2. **AI Generation**: Generate Python code using LLM
3. **File Creation**: Write SimpleTooling-compatible file
4. **Validation**: Check syntax and type hints
5. **Registration**: Call SimpleTooling `/load_tool_file` endpoint
6. **Response**: Return tool info with endpoint URL

### 2. Bulk Generation Flow
```
Bulk Spec → Category Processing → Parallel Generation → Batch Registration → Summary Report
```

1. **Category Organization**: Group tools by category
2. **Parallel Processing**: Generate tools concurrently
3. **Dependency Management**: Handle shared dependencies
4. **Batch Registration**: Register all tools with SimpleTooling
5. **Summary Generation**: Provide detailed results

### 3. File Upload Flow
```
File Upload → Validation → Storage → Registration → Endpoint Creation
```

1. **File Validation**: Check Python syntax and SimpleTooling compatibility
2. **Storage**: Save to appropriate category directory
3. **Metadata Extraction**: Parse tool information
4. **Registration**: Register with SimpleTooling
5. **Registry Update**: Update metadata files

## Error Handling

### Generation Errors
```typescript
interface GenerationError {
    type: 'SYNTAX_ERROR' | 'TYPE_INFERENCE_FAILED' | 'DEPENDENCY_MISSING' | 'AI_SERVICE_ERROR'
    message: string
    toolRequirement?: ToolRequirement
    suggestion?: string
}
```

### Registration Errors
```typescript
interface RegistrationError {
    type: 'SIMPLETOOLING_UNAVAILABLE' | 'FILE_NOT_FOUND' | 'REGISTRATION_FAILED'
    message: string
    filePath?: string
    endpoint?: string
}
```

## Configuration

### Service Configuration
```typescript
interface ToolServiceConfig {
    simpletooling: {
        baseUrl: string              // Default: http://localhost:8000
        timeout: number              // Request timeout in ms
        retryAttempts: number        // Registration retry attempts
    }
    generation: {
        aiService: {
            provider: 'openai' | 'anthropic'
            apiKey: string
            model: string
        }
        outputDirectory: string      // Default: tools/generated
        maxConcurrentGeneration: number
    }
    fileManagement: {
        autoCleanup: boolean         // Remove failed generations
        backupEnabled: boolean       // Backup before overwrites
        maxFileSize: number          // Max upload size in bytes
    }
}
```

## Benefits of Integration

1. **Immediate Availability**: Generated tools instantly become HTTP endpoints
2. **Unified Interface**: All tools accessible through SimpleTooling's API
3. **Automatic Documentation**: OpenAPI schemas generated automatically
4. **Type Safety**: Pydantic validation for all tool inputs/outputs
5. **Scalable**: Concurrent generation and registration
6. **Flexible**: Support for custom uploads and bulk operations
7. **Maintainable**: Clear organization and metadata tracking

## Future Enhancements

1. **Websocket Support**: Real-time generation progress updates
2. **Tool Versioning**: Track and manage tool versions
3. **Usage Analytics**: Monitor tool usage and performance
4. **Auto-optimization**: Improve tool performance based on usage
5. **Template System**: Pre-defined tool templates for common patterns
6. **Integration Testing**: Automated testing of generated tools