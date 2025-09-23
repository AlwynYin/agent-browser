# Tool Generation Service API Specification

## Overview
This document defines the API specification for the Tool Generation Service that integrates with the SimpleTooling framework.

Users generate code by passing tool requirements in natural language. A `job` is created, which generate tools asynchronously. User can choose two ways to monitor the job: poll for job status in a loop or ~~receive job status updates using websocket~~ (WIP)

Each tool will be a python file that integrates with SimpleTooling's `@toolset.add()` decorator pattern and is automatically registered as an HTTP endpoint. Tools are stored in a shared filesystem and immediately available through the SimpleTooling server.

**Note**: This specification is supplemented by the comprehensive [Tool Service Integration Design](./tool_service_design.md) which provides detailed architecture and implementation guidance.

## Service Endpoints


### Check Health

#### `GET /api/v1/health`
Health check endpoint.

**Response:**
```typescript
interface HealthResponse {
    status: 'healthy' | 'unhealthy'
    timestamp: string
    version: string
    dependencies: {
        ai_service: 'available' | 'unavailable'
        database: 'available' | 'unavailable'
    }
}
```

### Job Management

#### `POST /api/v1/jobs`
Create a new tool generation job.

**Request Body:**
```typescript
interface ToolGenerationRequest {
    toolRequirements: ToolRequirement[]
    metadata?: RequestMetadata
}
```

**Response:**
```typescript
interface JobResponse {
    jobId: string
    status: JobStatus
    createdAt: string
    updatedAt: string
    progress: JobProgress
}
```

#### `GET /api/v1/jobs/{jobId}`
Get job status and metadata.

**Response:** `JobResponse`


## Data Models

### Input Objects

#### `ToolRequirement`
```typescript
interface ToolRequirement {
    description: string           // Natural language description of the tool
    input: string                 // Natural language description of the input
    output: string                // Natural language description of the output
}
```

#### `RequestMetadata`
```typescript
interface RequestMetadata {
    sessionId?: string            // Optional session tracking
    clientId?: string             // Client identifier
}
```

### Output Objects

#### `JobResponse`
```typescript
interface JobResponse {
    jobId: string
    status: JobStatus
    createdAt: string             // ISO timestamp
    updatedAt: string             // ISO timestamp  
    progress: JobProgress
    toolFiles?: ToolFile[]        // Generated tool files (only when completed)
    failures?: ToolGenerationFailure[]  // Failed tool generations (only when completed)
    summary?: GenerationSummary   // Job summary (only when completed)
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

interface JobProgress {
    total: number                 // Total tools to generate
    completed: number             // Successfully generated
    failed: number                // Failed generations
    inProgress: number            // Currently being generated
    currentTool?: string          // Name of tool currently being generated
}

interface ToolFile {
    toolId: string                // Unique tool identifier
    fileName: string              // e.g., "calculate_molecular_weight.py"
    filePath: string              // Full path: "tools/generated/calculate_molecular_weight.py"
    description: string           // Tool description from requirement
    code: string                  // Generated Python code content
    endpoint?: string             // SimpleTooling HTTP endpoint URL
    registered: boolean           // Whether registered with SimpleTooling
    createdAt: string             // ISO timestamp
}
```


#### `ToolGenerationFailure`
```typescript
interface ToolGenerationFailure {
    toolRequirement: ToolRequirement
    error: string
}
```

#### `GenerationSummary`
```typescript
interface GenerationSummary {
    totalRequested: number
    successful: number
    failed: number
}
```

### Error Objects

#### `ErrorResponse`
```typescript
interface ErrorResponse {
    error: string
    code: ErrorCode
    details?: any
    timestamp: string
    jobId?: string
    requestId?: string            // For support/debugging
}

type ErrorCode = 
    | 'INVALID_REQUEST'           // Malformed request
    | 'INVALID_TOOL_REQUIREMENT'  // Tool requirement validation failed
    | 'INSUFFICIENT_API_SPECS'    // Not enough API documentation
    | 'GENERATION_TIMEOUT'        // Tool generation timed out
    | 'AI_SERVICE_ERROR'          // OpenAI/AI service error
    | 'AI_SERVICE_RATE_LIMITED'   // Rate limited by AI service
    | 'JOB_NOT_FOUND'            // Job ID doesn't exist
    | 'JOB_CANCELLED'            // Job was cancelled
    | 'JOB_ALREADY_COMPLETED'    // Job already finished
    | 'RATE_LIMIT_EXCEEDED'      // Too many requests
    | 'SERVICE_UNAVAILABLE'      // Service temporarily unavailable
    | 'INTERNAL_ERROR'           // Unexpected server error
```

## Usage Examples

### Tool Generation

```bash
# Create job
curl -X POST http://localhost:8002/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "toolRequirements": [
      {
        "description": "I need a tool that calculates the molecular weight of a chemical compound. Please use RDKit if available.",
        "input": "SMILES string of the molecule",
        "output": "molecular weight"
      }
    ],
    "metadata": {
      "sessionId": "session_123",
      "clientId": "web-app"
    }
  }'

# Response
{
  "jobId": "job_abc123",
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "progress": {
    "total": 1,
    "completed": 0,
    "failed": 0,
    "inProgress": 0,
    "currentTool": null
  }
}
```

### Check Job Status

```bash
curl http://localhost:8002/api/v1/jobs/job_abc123

# Response
{
  "jobId": "job_abc123", 
  "status": "running",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:45Z",
  "progress": {
    "total": 1,
    "completed": 0,
    "failed": 0,
    "inProgress": 1,
    "currentTool": "calculate_molecular_weight"
  }
}
```

### Retrieve Generated Tools

```bash
curl http://localhost:8002/api/v1/jobs/job_abc123

# Response (when completed)
{
  "jobId": "job_abc123",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:31:30Z",
  "progress": {
    "total": 1,
    "completed": 1,
    "failed": 0,
    "inProgress": 0,
    "currentTool": null
  },
  "toolFiles": [
    {
      "toolId": "tool_xyz789",
      "fileName": "calculate_molecular_weight.py",
      "filePath": "tools/generated/calculate_molecular_weight.py",
      "description": "Calculate molecular weight from SMILES string using RDKit",
      "code": "from tools.toolset import toolset\nfrom typing import Dict\n\n@toolset.add()\ndef calculate_molecular_weight(smiles: str) -> Dict[str, float]:\n    \"\"\"Calculate molecular weight of a chemical compound from SMILES string.\"\"\"\n    from rdkit import Chem\n    from rdkit.Chem import Descriptors\n    \n    try:\n        mol = Chem.MolFromSmiles(smiles)\n        if mol is None:\n            raise ValueError(f\"Invalid SMILES string: {smiles}\")\n        \n        molecular_weight = Descriptors.MolWt(mol)\n        return {'molecular_weight': molecular_weight}\n    except Exception as e:\n        raise ValueError(f\"Error calculating molecular weight: {str(e)}\")",
      "endpoint": "http://localhost:8000/tool/calculate_molecular_weight",
      "registered": true,
      "createdAt": "2024-01-15T10:31:30Z"
    }
  ],
  "failures": [],
  "summary": {
    "totalRequested": 1,
    "successful": 1,
    "failed": 0
  }
}
```

### Python Client Example

```python
import requests
import time
from typing import List, Dict, Any

class ToolGenerationClient:
    def __init__(self, base_url: str = "http://localhost:8002"):
        self.base_url = base_url
    
    def create_job(self, tool_requirements: List[Dict], 
                   metadata: Dict = None) -> str:
        """Create a new tool generation job and return job ID."""
        payload = {
            "toolRequirements": tool_requirements
        }
        if metadata:
            payload["metadata"] = metadata
            
        response = requests.post(f"{self.base_url}/api/v1/jobs", json=payload)
        response.raise_for_status()
        return response.json()["jobId"]
    
    def wait_for_completion(self, job_id: str, poll_interval: int = 2) -> Dict:
        """Poll job status until completion."""
        while True:
            status = self.get_job_status(job_id)
            progress = status['progress']
            print(f"Progress: {progress['completed']}/{progress['total']} tools")
            
            if status["status"] in ["completed", "failed", "cancelled"]:
                return status
                
            time.sleep(poll_interval)
    
    def get_job_status(self, job_id: str) -> Dict:
        """Get current job status."""
        response = requests.get(f"{self.base_url}/api/v1/jobs/{job_id}")
        response.raise_for_status()
        return response.json()

# Usage example
client = ToolGenerationClient()

# Submit job
job_id = client.create_job(
    tool_requirements=[...],
    metadata={"clientId": "python-script"}
)

# Wait for completion
final_status = client.wait_for_completion(job_id)

if final_status["status"] == "completed":
    # Access generated tool files from the JobResponse
    tool_files = final_status.get("toolFiles", [])
    failures = final_status.get("failures", [])
    summary = final_status.get("summary", {})

    print(f"Generated {len(tool_files)} tool files successfully")
    for tool_file in tool_files:
        print(f"- {tool_file['fileName']} at {tool_file['filePath']}")
        print(f"  Code length: {len(tool_file['code'])} characters")
        print(f"  Registered: {tool_file['registered']}")
        # Access the generated Python code directly
        # python_code = tool_file['code']

    if failures:
        print(f"Failed to generate {len(failures)} tools")

    print(f"Summary: {summary.get('successful', 0)}/{summary.get('totalRequested', 0)} successful")
else:
    print(f"Job failed with status: {final_status['status']}")
```

## Tool File Storage Design

### Directory Structure (SimpleTooling Integration)
Tools are placed in organized directories under `tools/` with automatic SimpleTooling registration. Generated tools go in `tools/generated/` while custom uploaded tools go in `tools/custom/`.

```
simpletooling_template/
├── tools/
│   ├── __init__.py
│   ├── toolset.py                    # Shared toolset instance
│   ├── calculator.py                 # Pre-existing tools
│   ├── generated/                    # Auto-generated tools
│   ├── calculate_molecular_weight.py
│   └── metadata/
│       ├── registry.json             # Tool registry with endpoints
│       ├── dependencies.json         # Global dependencies
└── main.py
```

### File Naming Convention
```
{snake_case_tool_name}.py
```
Examples:
- `calculate_molecular_weight.py`
- `visualize_protein_structure.py`  
- `convert_file_format.py`

### Python File Structure (SimpleTooling Integration)
```python
"""
Generated Tool: Calculate Molecular Weight
Created: 2024-01-15T10:31:30Z
Tool ID: tool_xyz789
Description: Calculate molecular weight from SMILES string using RDKit
Dependencies: rdkit
"""

from tools.toolset import toolset
from typing import Dict

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
    "tool_id": "tool_xyz789",
    "job_id": "job_abc123",
    "generated_at": "2024-01-15T10:31:30Z",
    "dependencies": ["rdkit"]
}
```

### Metadata Management

#### Tool Registry (`metadata/registry.json`)
```json
{
  "tool_xyz789": {
    "name": "calculate_molecular_weight",
    "fileName": "calculate_molecular_weight.py",
    "filePath": "tools/generated/chemistry/calculate_molecular_weight.py",
    "category": "chemistry",
    "description": "Calculate molecular weight from SMILES string using RDKit",
    "endpoint": "http://localhost:8000/tool/calculate_molecular_weight",
    "dependencies": ["rdkit"],
    "createdAt": "2024-01-15T10:31:30Z",
    "registeredAt": "2024-01-15T10:31:45Z",
    "jobId": "job_abc123"
  }
}
```

#### Global Dependencies (`metadata/dependencies.json`)
```json
[
  "rdkit",
  "numpy",
  "pandas",
  "matplotlib"
]
```

