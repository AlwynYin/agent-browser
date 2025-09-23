# Tool Generation Service Backend

FastAPI backend service for generating Python chemistry tools from natural language requirements using OpenAI and Codex.

## Features

- **Job-based tool generation** with natural language requirements
- **OpenAI Agent SDK** integration for intelligent tool creation
- **Codex CLI** integration for Python code generation

## Quick Start

### Prerequisites

- Python 3.13
- uv (Python package manager)
- MongoDB
- OpenAI API key
- Codex CLI (`npm install -g @matterlab/codex`)

### Installation

1. **Setup environment**:
   ```bash
   cd tool_generation_backend
   uv sync
   cp .env.example .env
   # Edit .env with your OPENAI_API_KEY and MONGODB_URL
   ```

2. **Start the server**:
   ```bash
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

3. **Access the API**:
    - API: http://localhost:8000
    - Documentation: http://localhost:8000/docs
    - Health check: http://localhost:8000/api/v1/health

## API Usage

### Generate Tools

**Submit job:**
```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "toolRequirements": [
      {
        "description": "Calculate molecular weight from SMILES using RDKit",
        "input": "SMILES string",
        "output": "molecular weight in g/mol"
      }
    ],
    "metadata": {
      "clientId": "my-app"
    }
  }'
```

**Check status:**
```bash
curl http://localhost:8000/api/v1/jobs/{job_id}
```

**Response includes:**
- Job status (`pending`, `implementing`, `completed`)
- Progress tracking (`0/1`, `1/1`)
- Generated Python code (when completed)
- Tool file metadata and endpoints

## Configuration

### Required Variables
- `OPENAI_API_KEY` - OpenAI API key
- `MONGODB_URL` - MongoDB connection URL

### Optional Variables
- `TOOL_SERVICE_DIR=tool_service` - Tool generation directory
- `TOOLS_DIR=tools` - Generated tools subdirectory
- `SIMPLETOOLING_URL=http://localhost:8000` - SimpleTooling service URL

## Generated Tools

Tools are created in `../tool_service/tools/` as:
- Self-contained Python files with `@toolset.add()` decorators
- Comprehensive error handling and type hints
- Integration with chemistry libraries (RDKit, ASE, PyMatGen)
- Automatic registration with SimpleTooling service

## Testing

```bash
# Run the pipeline test
python tests/test_v1_pipeline.py
```

## Architecture

```
Client → POST /jobs → OpenAI Agent → Codex → Generated Tools → SimpleTooling
   ↓         ↓           ↓           ↓          ↓               ↓
Request   MongoDB    Tool Design   Python   File System   HTTP APIs
```

The service transforms natural language requirements into production-ready Python chemistry tools through an agentic multi-step process.
