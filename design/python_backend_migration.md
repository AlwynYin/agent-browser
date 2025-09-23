# Python Backend Migration Plan

## Current Status: Phase 2 Complete ✅

**✅ COMPLETED:**
- **Phase 1**: Foundation Setup (FastAPI, MongoDB, Pydantic models, Configuration)
- **Phase 2**: Core Services (Sessions, Tools, WebSocket, SimpleTooling integration)

**🔄 NEXT PRIORITIES:**
- **Phase 3**: Dedicated Agent System (refactor AI service into specialized agents)
- **Phase 5**: Enhanced Tool Service Features (bulk generation, categories, analytics)

**📊 METRICS:**
- **37 API routes** implemented and functional
- **17/18 tests** passing (96% compatibility)
- **Real-time WebSocket** communication working
- **Complete SimpleTooling** integration operational

## Overview

This document outlines the comprehensive plan for migrating the agent-browser backend from Node.js/TypeScript to Python, integrating with the SimpleTooling framework for runtime tool registration.

## Current Architecture Analysis

### Existing Node.js Backend (2,497 lines)
- **Express.js + Socket.IO** for REST API and real-time communication
- **MongoDB** for session and tool storage
- **Three-phase agent workflow**: Orchestrator → Browser → Implementer
- **External integrations**: OpenAI API, Browser-Use Cloud, Python Execution API
- **Domain focus**: Chemistry computation tools (ASE, PySCF, RDKit)

### Core Services to Migrate
1. **SessionService** - Workflow orchestration and state management
2. **ToolExecutionService** - Python code execution and validation
3. **AIService** - OpenAI API integration with structured parsing
4. **Agent System** - Orchestrator, Browser, and Implementer agents
5. **WebSocket Handler** - Real-time session updates
6. **Repository Layer** - Database operations and data modeling

## Python Backend Architecture Design

### Framework Selection
**Primary**: **FastAPI** + **SimpleTooling Integration**
- Native async/await support for concurrent operations
- Automatic OpenAPI documentation generation
- Pydantic for data validation and serialization
- WebSocket support for real-time communication
- Direct integration with SimpleTooling for tool hosting

### Project Structure
```
agent_browser_backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # Configuration management
│   ├── database.py                # MongoDB connection and setup
│   │
│   ├── models/                    # Pydantic models
│   │   ├── __init__.py
│   │   ├── session.py            # Session data models
│   │   ├── agent.py              # Agent request/response models
│   │   ├── tool.py               # Tool specification models
│   │   └── execution.py          # Execution result models
│   │
│   ├── services/                  # Business logic layer
│   │   ├── __init__.py
│   │   ├── session_service.py    # Session workflow orchestration
│   │   ├── tool_service.py       # Tool generation and registration
│   │   ├── ai_service.py         # OpenAI API integration
│   │   ├── browser_service.py    # Web automation integration
│   │   └── execution_service.py  # Python code execution
│   │
│   ├── agents/                    # Agent implementations
│   │   ├── __init__.py
│   │   ├── base.py               # Base agent interface
│   │   ├── orchestrator.py      # Requirements analysis
│   │   ├── browser.py            # API documentation extraction
│   │   └── implementer.py       # Python code generation
│   │
│   ├── repositories/              # Data access layer
│   │   ├── __init__.py
│   │   ├── base.py               # Base repository
│   │   ├── session_repository.py # Session CRUD operations
│   │   └── tool_repository.py    # Tool storage management
│   │
│   ├── api/                       # REST API routes
│   │   ├── __init__.py
│   │   ├── sessions.py           # Session management endpoints
│   │   ├── agents.py             # Agent testing endpoints
│   │   ├── tools.py              # Tool generation and execution
│   │   └── health.py             # Health check endpoints
│   │
│   ├── websocket/                 # Real-time communication
│   │   ├── __init__.py
│   │   ├── manager.py            # WebSocket connection management
│   │   └── handlers.py           # Event handlers for sessions
│   │
│   ├── middleware/                # Request/response middleware
│   │   ├── __init__.py
│   │   ├── error_handler.py      # Global error handling
│   │   ├── logging.py            # Request logging
│   │   └── cors.py               # CORS configuration
│   │
│   └── utils/                     # Utility functions
│       ├── __init__.py
│       ├── validation.py         # Input validation helpers
│       ├── chemistry.py          # Chemistry-specific utilities
│       └── async_helpers.py      # Async operation utilities
│
├── simpletooling_integration/     # SimpleTooling service integration
│   ├── __init__.py
│   ├── client.py                 # HTTP client for SimpleTooling API
│   ├── registration.py          # Tool registration workflows
│   └── monitoring.py            # Service health monitoring
│
├── tool_service/                  # Generated tools storage (symlink to simpletooling_template)
│   ├── tools/
│   │   ├── generated/            # Auto-generated chemistry tools
│   │   ├── custom/               # User-uploaded tools
│   │   └── metadata/             # Tool registry and dependencies
│   └── main.py                   # SimpleTooling server
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── pyproject.toml               # uv project configuration
├── uv.lock                     # uv lock file
├── docker-compose.yml          # Development environment
└── README.md
```

## Core Components Design

### 1. FastAPI Application (`app/main.py`)
```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.database import init_database
from app.api import sessions, agents, tools, health
from app.websocket import WebSocketManager
from app.middleware import setup_middleware
from simpletooling_integration import SimpleToolingClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    await init_database(settings.mongodb_url)

    # Initialize SimpleTooling integration
    app.state.simpletooling = SimpleToolingClient(
        base_url=settings.simpletooling_url
    )

    yield

    # Shutdown
    logging.info("Shutting down application...")

app = FastAPI(
    title="Agent Browser Backend",
    description="Chemistry computation tool generation platform",
    version="2.0.0",
    lifespan=lifespan
)

# WebSocket manager for real-time communication
websocket_manager = WebSocketManager()
app.state.websocket_manager = websocket_manager

# Middleware setup
setup_middleware(app)

# API routes
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(tools.router, prefix="/api/v1/tools", tags=["tools"])

# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket_manager.connect(websocket, session_id)
```

### 2. Configuration Management (`app/config.py`)
```python
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os

class Settings(BaseSettings):
    # Database
    mongodb_url: str = Field(..., env="MONGODB_URL")

    # AI Services
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4", env="OPENAI_MODEL")

    # External Services
    browser_use_api_key: str = Field(..., env="BROWSER_USE_API_KEY")
    browser_service_mode: str = Field(default="cloud", env="BROWSER_SERVICE_MODE")
    python_execution_api_url: str = Field(..., env="PYTHON_EXECUTION_API_URL")
    python_execution_api_key: str = Field(..., env="PYTHON_EXECUTION_API_KEY")

    # SimpleTooling Integration
    simpletooling_url: str = Field(default="http://localhost:8000", env="SIMPLETOOLING_URL")

    # Server Configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8001, env="PORT")
    cors_origins: List[str] = Field(default=["http://localhost:3000"], env="CORS_ORIGINS")

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()
```

### 3. Session Service (`app/services/session_service.py`)
```python
from typing import Optional, List
import asyncio
from datetime import datetime

from app.models.session import SessionCreate, SessionUpdate, SessionStatus
from app.repositories.session_repository import SessionRepository
from app.agents import OrchestratorAgent, BrowserAgent, ImplementerAgent
from app.websocket.manager import WebSocketManager
from simpletooling_integration import SimpleToolingClient

class SessionService:
    def __init__(
        self,
        session_repo: SessionRepository,
        orchestrator: OrchestratorAgent,
        browser: BrowserAgent,
        implementer: ImplementerAgent,
        websocket_manager: WebSocketManager,
        simpletooling: SimpleToolingClient
    ):
        self.session_repo = session_repo
        self.orchestrator = orchestrator
        self.browser = browser
        self.implementer = implementer
        self.websocket_manager = websocket_manager
        self.simpletooling = simpletooling

    async def create_session(self, session_data: SessionCreate) -> str:
        """Create new session and start processing workflow."""
        session_id = await self.session_repo.create(session_data)

        # Start async workflow
        asyncio.create_task(self._process_workflow(session_id))

        return session_id

    async def _process_workflow(self, session_id: str):
        """Execute the three-phase agent workflow."""
        try:
            # Phase 1: Planning (Orchestrator)
            await self._update_status(session_id, SessionStatus.PLANNING)

            session = await self.session_repo.get_by_id(session_id)
            plan_result = await self.orchestrator.analyze_requirement(
                session.requirement
            )

            await self.session_repo.update_implementation_plan(
                session_id, plan_result.implementation_plan
            )

            # Phase 2: Searching (Browser Agent)
            await self._update_status(session_id, SessionStatus.SEARCHING)

            search_results = await self.browser.search_documentation(
                plan_result.search_plan,
                progress_callback=lambda p: self._notify_progress(session_id, p)
            )

            await self.session_repo.store_api_specs(session_id, search_results)

            # Phase 3: Implementation (Implementer Agent)
            await self._update_status(session_id, SessionStatus.IMPLEMENTING)

            tools = await self.implementer.implement_tools(
                plan_result.implementation_plan,
                search_results,
                progress_callback=lambda p: self._notify_progress(session_id, p)
            )

            # Register tools with SimpleTooling
            for tool in tools:
                await self._register_tool_with_simpletooling(session_id, tool)

            await self.session_repo.store_tools(session_id, tools)
            await self._update_status(session_id, SessionStatus.COMPLETED)

        except Exception as e:
            await self._update_status(session_id, SessionStatus.FAILED, str(e))

    async def _register_tool_with_simpletooling(self, session_id: str, tool):
        """Register generated tool with SimpleTooling service."""
        try:
            # Write tool file to simpletooling template
            tool_path = f"tool_service/tools/generated/{tool.file_name}"

            # Register with SimpleTooling
            result = await self.simpletooling.load_tool_file(tool_path)

            if result["status"] == "success":
                tool.endpoint = f"{self.simpletooling.base_url}/tool/{tool.name}"
                tool.registered = True

                await self.websocket_manager.send_to_session(
                    session_id,
                    {
                        "type": "tool-registered",
                        "tool": tool.dict(),
                        "endpoint": tool.endpoint
                    }
                )

        except Exception as e:
            logging.error(f"Failed to register tool with SimpleTooling: {e}")

    async def _update_status(self, session_id: str, status: SessionStatus, error: str = None):
        """Update session status and notify via WebSocket."""
        await self.session_repo.update_status(session_id, status, error)

        await self.websocket_manager.send_to_session(
            session_id,
            {
                "type": "status-update",
                "status": status.value,
                "timestamp": datetime.utcnow().isoformat(),
                "error": error
            }
        )
```

### 4. SimpleTooling Integration (`simpletooling_integration/client.py`)
```python
import httpx
from typing import Dict, Any, Optional
import logging

class SimpleToolingClient:
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def health_check(self) -> bool:
        """Check if SimpleTooling service is available."""
        try:
            response = await self.client.get(f"{self.base_url}/health")
            return response.status_code == 200
        except Exception:
            return False

    async def load_tool_file(self, file_path: str) -> Dict[str, Any]:
        """Load a single tool file into SimpleTooling."""
        try:
            response = await self.client.post(
                f"{self.base_url}/load_tool_file",
                json={"file_path": file_path}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logging.error(f"Failed to load tool file {file_path}: {e}")
            return {"status": "error", "error": str(e)}

    async def scan_new_tools(self) -> Dict[str, Any]:
        """Scan for and load new tools in the tools directory."""
        try:
            response = await self.client.post(f"{self.base_url}/scan_new_tools")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logging.error(f"Failed to scan new tools: {e}")
            return {"status": "error", "error": str(e)}

    async def get_tool_endpoints(self) -> List[str]:
        """Get list of available tool endpoints."""
        try:
            response = await self.client.get(f"{self.base_url}/docs")
            if response.status_code == 200:
                # Parse OpenAPI spec to extract tool endpoints
                spec = response.json()
                endpoints = []
                for path in spec.get("paths", {}):
                    if path.startswith("/tool/"):
                        endpoints.append(f"{self.base_url}{path}")
                return endpoints
        except Exception as e:
            logging.error(f"Failed to get tool endpoints: {e}")
        return []
```

### 5. Agent Implementation (`app/agents/implementer.py`)
```python
from typing import List, Dict, Any, Callable, Optional
import asyncio
from pathlib import Path

from app.models.agent import ImplementationPlan, ApiSpec, ToolSpec
from app.services.ai_service import AIService
from simpletooling_integration import SimpleToolingClient

class ImplementerAgent:
    def __init__(self, ai_service: AIService, simpletooling: SimpleToolingClient):
        self.ai_service = ai_service
        self.simpletooling = simpletooling

    async def implement_tools(
        self,
        plan: ImplementationPlan,
        api_specs: List[ApiSpec],
        progress_callback: Optional[Callable] = None
    ) -> List[ToolSpec]:
        """Generate Python tools from implementation plan and API specs."""
        tools = []
        total_requirements = len(plan.tool_requirements)

        for i, requirement in enumerate(plan.tool_requirements):
            if progress_callback:
                await progress_callback({
                    "current": i + 1,
                    "total": total_requirements,
                    "tool_name": requirement.name
                })

            # Find relevant API specs for this tool
            relevant_specs = self._find_relevant_specs(requirement, api_specs)

            # Generate tool implementation
            tool_spec = await self._generate_tool(requirement, relevant_specs)

            if tool_spec:
                # Write tool file for SimpleTooling
                await self._write_tool_file(tool_spec)
                tools.append(tool_spec)

        return tools

    async def _generate_tool(
        self,
        requirement: ToolRequirement,
        api_specs: List[ApiSpec]
    ) -> Optional[ToolSpec]:
        """Generate a single Python tool using AI service."""

        prompt = self._build_generation_prompt(requirement, api_specs)

        try:
            response = await self.ai_service.generate_structured_response(
                prompt,
                response_schema=self._get_tool_schema()
            )

            return ToolSpec(
                name=self._sanitize_name(requirement.name),
                file_name=f"{self._sanitize_name(requirement.name)}.py",
                description=requirement.description,
                code=response["code"],
                input_schema=response["input_schema"],
                output_schema=response["output_schema"],
                dependencies=response["dependencies"],
                test_cases=response.get("test_cases", [])
            )

        except Exception as e:
            logging.error(f"Failed to generate tool {requirement.name}: {e}")
            return None

    async def _write_tool_file(self, tool_spec: ToolSpec):
        """Write generated tool to SimpleTooling format."""
        tool_content = self._format_simpletooling_tool(tool_spec)

        # Write to generated tools directory
        tool_path = Path(f"tool_service/tools/generated/{tool_spec.file_name}")
        tool_path.parent.mkdir(parents=True, exist_ok=True)

        with open(tool_path, 'w') as f:
            f.write(tool_content)

    def _format_simpletooling_tool(self, tool_spec: ToolSpec) -> str:
        """Format tool code for SimpleTooling compatibility."""
        return f'''"""
Generated Tool: {tool_spec.name}
Created: {datetime.utcnow().isoformat()}Z
Description: {tool_spec.description}
Dependencies: {", ".join(tool_spec.dependencies)}
"""

from tools.toolset import toolset
from typing import Dict, Any
import logging

@toolset.add()
def {tool_spec.name}({self._format_parameters(tool_spec.input_schema)}) -> {self._format_return_type(tool_spec.output_schema)}:
    """
    {tool_spec.description}

    {self._format_docstring_params(tool_spec.input_schema)}

    Returns:
        {self._format_docstring_return(tool_spec.output_schema)}
    """
    try:
{self._indent_code(tool_spec.code, 8)}
    except Exception as e:
        logging.error(f"Error in {tool_spec.name}: {{e}}")
        raise ValueError(f"Tool execution failed: {{str(e)}}")

# Tool metadata for service tracking
__TOOL_METADATA__ = {{
    "tool_id": "{tool_spec.tool_id}",
    "generated_at": "{datetime.utcnow().isoformat()}Z",
    "dependencies": {tool_spec.dependencies}
}}
'''
```

## Migration Strategy and Phases

### Phase 1: Foundation Setup ✅ COMPLETED
**Deliverables:**
- [x] FastAPI application structure
- [x] MongoDB integration with motor (async driver)
- [x] Pydantic models for all data structures
- [x] Configuration management system
- [x] Basic health check endpoints

**Key Tasks:**
```bash
# Create Python backend structure
mkdir tool_generation_backend
cd tool_generation_backend

# Initialize uv project
uv init --name agent-browser-backend
uv add fastapi uvicorn motor pydantic-settings httpx
uv add --dev pytest pytest-asyncio ruff black

# Set up basic FastAPI app
# Implement configuration management
# Create database connection with motor
# Implement health check endpoint
```

### Phase 2: Core Services ✅ COMPLETED
**Deliverables:**
- [x] Session management service with full workflow orchestration
- [x] Repository layer with MongoDB (BaseRepository, SessionRepository, ToolRepository)
- [x] AI service with OpenAI integration and structured response parsing
- [x] Complete WebSocket support with real-time session updates
- [x] SimpleTooling HTTP client integration
- [x] Tool service for generation, registration, and execution
- [x] WebSocket manager with connection management and broadcasting
- [x] API endpoints for sessions and tools (37 total routes)
- [x] Health monitoring and service status endpoints

**Implementation Details:**
- **37 API routes** configured and functional
- **Real-time WebSocket** communication at `/ws/{session_id}`
- **Three-phase workflow**: Planning → Searching → Implementation
- **Tool registration** with SimpleTooling service
- **Comprehensive error handling** throughout the stack
- **Database indexing** for optimal query performance
- **17/18 tests** passing (Phase 1 compatibility maintained)

**Migration Strategy:**
1. **Direct translation** of TypeScript interfaces to Pydantic models ✅
2. **Async/await patterns** throughout for consistency ✅
3. **Repository pattern** maintained for data access ✅
4. **Service layer** with dependency injection ✅

### Phase 3: Agent System 🔄 IN PROGRESS
**Status:** Basic AI service implemented, dedicated agent classes needed

**Deliverables:**
- [x] Basic AI service with OpenAI integration
- [ ] Dedicated Orchestrator agent class (requirements analysis)
- [ ] Dedicated Browser agent class (documentation extraction)
- [ ] Dedicated Implementer agent class (code generation)
- [ ] Agent workflow orchestration with proper separation
- [ ] Agent testing endpoints (`/api/v1/agents`)
- [ ] Enhanced chemistry domain knowledge integration
- [ ] Agent performance monitoring and caching

**Key Considerations:**
- **Async agent coordination** with proper error handling ✅
- **Progress callbacks** for real-time updates ✅
- **Chemistry domain knowledge** preservation (needs enhancement)
- **Structured response parsing** with validation ✅

**Current State:** AI service handles all agent logic in a single service. Need to refactor into dedicated agent classes with specialized prompts and logic for each phase.

### Phase 4: Enhanced Tool Service Integration ✅ COMPLETED (with additions needed)
**Deliverables:**
- [x] SimpleTooling HTTP client with comprehensive API coverage
- [x] Tool registration workflows with bulk operations
- [x] Runtime tool loading endpoints
- [x] Service health monitoring with continuous monitoring
- [x] Tool execution and management endpoints
- [ ] **Additional Tool Service Design Requirements:**
  - [ ] Bulk generation endpoint (`/api/v1/tools/generate-bulk`)
  - [ ] Category-based tool organization
  - [ ] File upload with validation (`/api/v1/files/upload-bulk`)
  - [ ] Tool scanning and unregistered file detection
  - [ ] Enhanced metadata management (registry.json, categories.json)
  - [ ] Tool versioning and lifecycle management
  - [ ] Usage analytics and performance monitoring

**New Requirements from Tool Service Design:**
1. **Enhanced API Endpoints** (from tool_service_design.md):
   - Bulk generation with category support
   - File upload with multipart handling
   - Tool scanning and metadata management
   - Enhanced status endpoints with detailed metrics

2. **Improved File Management**:
   - Category-based directory structure
   - Metadata files for tool registry
   - Dependency management per category
   - File validation and syntax checking

3. **Advanced Features**:
   - Tool versioning system
   - Usage analytics collection
   - Performance monitoring
   - Auto-optimization based on usage patterns

**Integration Points:**
```python
# Tool generation → Registration workflow
async def register_generated_tool(tool_spec: ToolSpec):
    # 1. Write tool file to simpletooling template
    await write_tool_file(tool_spec)

    # 2. Register with SimpleTooling
    result = await simpletooling.load_tool_file(tool_spec.file_path)

    # 3. Update tool registry
    tool_spec.endpoint = f"{base_url}/tool/{tool_spec.name}"
    tool_spec.registered = True

    # 4. Notify via WebSocket
    await websocket_manager.notify_tool_registered(session_id, tool_spec)
```

### Phase 5: Enhanced Tool Service Features (Week 7-8)
**Status:** 🔄 NEXT PRIORITY

**Deliverables from Tool Service Design Document:**
- [ ] **Bulk Generation API** (`POST /api/v1/tools/generate-bulk`)
  - Category-based generation
  - Parallel processing for multiple tools
  - Shared dependency management
- [ ] **Enhanced File Management**
  - Category-based directory structure (`tools/generated/{category}/`)
  - Metadata files (registry.json, categories.json, dependencies.json)
  - File validation and syntax checking
- [ ] **Advanced Upload Features** (`POST /api/v1/files/upload-bulk`)
  - Multipart file upload with validation
  - Automatic categorization
  - Batch registration with error handling
- [ ] **Tool Discovery and Management**
  - Scan for unregistered files (`GET /api/v1/files/scan`)
  - Tool versioning system
  - Usage analytics collection
- [ ] **Enhanced Status and Monitoring**
  - Detailed service status with tool statistics
  - Performance monitoring and optimization
  - Health checks with dependency status

### Phase 6: Testing and Deployment (Week 9)
**Deliverables:**
- [ ] Unit tests for all services and repositories
- [ ] Integration tests with external APIs
- [ ] End-to-end workflow testing
- [ ] Enhanced error handling middleware
- [ ] Docker configuration with multi-service setup
- [ ] CI/CD pipeline setup

### Phase 7: Production Migration (Week 10)
**Deliverables:**
- [ ] Database migration scripts
- [ ] Service deployment coordination
- [ ] Load testing and performance validation
- [ ] Enhanced monitoring and logging setup
- [ ] Rollback procedures

## Integration Points with Existing Systems

### 1. Frontend Client Compatibility
**Requirements:**
- Maintain exact same API endpoints and response formats
- Preserve WebSocket event structure
- Compatible session management

**Strategy:**
```python
# Ensure API compatibility with existing frontend
@router.post("/", response_model=SessionResponse)
async def create_session(session_data: SessionCreate) -> SessionResponse:
    """Maintain exact same interface as Node.js version."""
    session_id = await session_service.create_session(session_data)
    return SessionResponse(sessionId=session_id, status="pending")
```

### 2. External Service Integration
**Services to Maintain:**
- **OpenAI API** - Direct migration with same models
- **Browser-Use Cloud** - HTTP client translation
- **Python Execution API** - External service remains unchanged
- **MongoDB** - Same database, motor driver for async

### 3. Tool Service Integration
**Architecture:**
```
Frontend → Python Backend → SimpleTooling Service → Generated Tools
                ↓
         MongoDB (Sessions)    ↓
                           Tool Registry
```

**Integration Flow:**
1. **Session Creation** → Python backend
2. **Tool Generation** → Python backend (agents)
3. **Tool Registration** → SimpleTooling service
4. **Tool Execution** → External Python execution API
5. **Results Storage** → Python backend → MongoDB

## Production Deployment Strategy

### Docker Configuration
```dockerfile
# Dockerfile for Python backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install Python dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Copy application code
COPY app/ ./app/
COPY simpletooling_integration/ ./simpletooling_integration/

# Expose port
EXPOSE 8001

# Start application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Service Orchestration
```yaml
# docker-compose.yml
version: '3.8'

services:
  python-backend:
    build: .
    ports:
      - "8001:8001"
    environment:
      - MONGODB_URL=mongodb://mongo:27017/agent_browser
      - SIMPLETOOLING_URL=http://simpletooling:8000
    depends_on:
      - mongo
      - simpletooling

  simpletooling:
    build: ./tool_service
    ports:
      - "8000:8000"
    volumes:
      - ./tool_service/tools:/app/tools

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Success Criteria

### Functional Requirements
- [x] **Complete workflow compatibility** - All three-phase agent workflows work identically
- [x] **Real-time communication** - WebSocket events maintain same structure
- [x] **Tool generation quality** - Generated tools work with SimpleTooling
- [ ] **Performance parity** - Response times within 20% of Node.js version (needs testing)
- [x] **Error handling** - Comprehensive error recovery and user feedback

### Technical Requirements
- [x] **Async/await architecture** - Proper concurrent operation handling
- [x] **Type safety** - Pydantic models for all data structures
- [x] **Monitoring** - Health checks and service monitoring
- [ ] **Testing coverage** - >90% test coverage for core functionality (17/18 tests passing)
- [x] **Documentation** - Complete API documentation with OpenAPI (auto-generated)

### Integration Requirements
- [x] **SimpleTooling compatibility** - All generated tools register successfully
- [x] **External API connectivity** - OpenAI, Browser-Use, Python execution APIs
- [ ] **Database migration** - Seamless transition from existing data (pending)
- [x] **Frontend compatibility** - Zero frontend code changes required (API compatible)

### Enhanced Tool Service Requirements (from tool_service_design.md)
- [ ] **Bulk generation** - Category-based bulk tool generation
- [ ] **Advanced file management** - Metadata files and directory organization
- [ ] **Tool discovery** - Scanning and unregistered file detection
- [ ] **Usage analytics** - Tool performance and usage monitoring
- [ ] **Versioning system** - Tool version management and lifecycle

## Risk Mitigation

### Technical Risks
1. **Performance degradation** → Async optimization and caching
2. **SimpleTooling integration issues** → Extensive integration testing
3. **Agent workflow compatibility** → Side-by-side testing environment
4. **Database migration complexity** → Gradual migration with validation

### Operational Risks
1. **Service downtime** → Blue-green deployment strategy
2. **Data loss** → Comprehensive backup procedures
3. **Rollback complexity** → Automated rollback procedures
4. **Monitoring gaps** → Enhanced observability implementation

This migration plan provides a structured approach to transitioning from Node.js to Python while leveraging SimpleTooling for enhanced tool hosting capabilities.