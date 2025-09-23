"""
Job management API endpoints for tool generation requests.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from app.services.session_service import SessionService
from app.models.session import SessionCreate, SessionUpdate
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ToolRequirement(BaseModel):
    """Tool requirement as specified in design spec."""
    description: str = Field(..., description="Natural language description of the tool")
    input: str = Field(..., description="Natural language description of the input")
    output: str = Field(..., description="Natural language description of the output")


class RequestMetadata(BaseModel):
    """Optional request metadata."""
    sessionId: Optional[str] = Field(None, description="Optional session tracking")
    clientId: Optional[str] = Field(None, description="Client identifier")


class ToolGenerationRequest(BaseModel):
    """Request model matching design spec."""
    toolRequirements: List[ToolRequirement]
    metadata: Optional[RequestMetadata] = None


class JobProgress(BaseModel):
    """Job progress information."""
    total: int = Field(..., description="Total tools to generate")
    completed: int = Field(..., description="Successfully generated")
    failed: int = Field(..., description="Failed generations")
    inProgress: int = Field(..., description="Currently being generated")
    currentTool: Optional[str] = Field(None, description="Name of tool currently being generated")


class ToolFile(BaseModel):
    """Generated tool file information."""
    toolId: str = Field(..., description="Unique tool identifier")
    fileName: str = Field(..., description="e.g., 'calculate_molecular_weight.py'")
    filePath: str = Field(..., description="Full path to the file")
    description: str = Field(..., description="Tool description from requirement")
    code: str = Field(..., description="Generated Python code content")
    endpoint: Optional[str] = Field(None, description="SimpleTooling HTTP endpoint URL")
    registered: bool = Field(..., description="Whether registered with SimpleTooling")
    createdAt: str = Field(..., description="ISO timestamp")


class ToolGenerationFailure(BaseModel):
    """Failed tool generation information."""
    toolRequirement: ToolRequirement
    error: str


class GenerationSummary(BaseModel):
    """Job completion summary."""
    totalRequested: int
    successful: int
    failed: int


class JobResponse(BaseModel):
    """Response model matching design spec."""
    jobId: str
    status: str  # 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    createdAt: str  # ISO timestamp
    updatedAt: str  # ISO timestamp
    progress: JobProgress
    toolFiles: Optional[List[ToolFile]] = Field(None, description="Generated tool files (only when completed)")
    failures: Optional[List[ToolGenerationFailure]] = Field(None, description="Failed tool generations")
    summary: Optional[GenerationSummary] = Field(None, description="Job summary (only when completed)")


# Dependency injection
async def get_session_service() -> SessionService:
    """Get session service instance."""
    from app.api.sessions import get_session_service
    return await get_session_service()


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def submit_tool_generation_job(
    request: ToolGenerationRequest,
    session_service: SessionService = Depends(get_session_service)
) -> JobResponse:
    """
    Create a new tool generation job.

    Args:
        request: Tool generation request data
        session_service: Session service instance

    Returns:
        JobResponse: Job submission result
    """
    try:
        from datetime import datetime, timezone
        import uuid

        # Generate job ID
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        client_id = request.metadata.clientId if request.metadata else "unknown"
        session_id_meta = request.metadata.sessionId if request.metadata else None

        logger.info(f"Received tool generation job {job_id} from client {client_id}: {len(request.toolRequirements)} tools")

        # Convert natural language requirements to structured format for codex
        structured_requirements = []
        for i, req in enumerate(request.toolRequirements):
            tool_name = f"tool_{i+1}"
            structured_req = {
                "name": tool_name,
                "description": req.description,
                "params": [
                    {"name": "input_data", "type": "str", "description": req.input}
                ],
                "returns": {
                    "type": "Dict[str, Any]",
                    "description": req.output
                }
            }
            structured_requirements.append(structured_req)

        # Create session with job metadata embedded in requirement
        requirement_with_job = f"Job ID: {job_id} - Generate {len(request.toolRequirements)} tools - Tool Requirements: {request.toolRequirements} - Structured Requirements: {structured_requirements}"

        session_data = SessionCreate(
            user_id=client_id,
            requirement=requirement_with_job
        )

        session_id = await session_service.create_session(session_data)
        logger.info(f"Created session {session_id} for job {job_id}")

        # The workflow will handle tool generation asynchronously
        # No need to await here - let the background task handle it

        # Create response
        now = datetime.now(timezone.utc)
        progress = JobProgress(
            total=len(request.toolRequirements),
            completed=0,
            failed=0,
            inProgress=len(request.toolRequirements),
            currentTool="initializing"
        )

        return JobResponse(
            jobId=job_id,
            status="pending",
            createdAt=now.isoformat(),
            updatedAt=now.isoformat(),
            progress=progress
        )

    except Exception as e:
        logger.error(f"Failed to submit tool generation job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit job: {str(e)}"
        )


@router.get("/{jobId}", response_model=JobResponse)
async def get_job_status(
    jobId: str,
    session_service: SessionService = Depends(get_session_service)
) -> JobResponse:
    """
    Get the status of a tool generation job.

    Args:
        job_id: Job ID (same as session ID)
        session_service: Session service instance

    Returns:
        Dict with job status information
    """
    try:
        # Get session by job ID (search in requirement field)
        session = await session_service.get_session_by_job_id(jobId)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job not found: {jobId}"
            )

        logger.info(f"Retrieved session {session.id} for job {jobId}")

        # Get detailed workflow status
        workflow_status = session_service.get_workflow_status(session.id)

        # Create proper JobResponse
        from datetime import datetime, timezone

        # Handle status as either enum or string
        status_str = session.status.value if hasattr(session.status, 'value') else str(session.status)

        # Extract total tool count from requirement string
        import re
        total_tools = 1  # default
        if "Generate" in session.requirement and "tools" in session.requirement:
            match = re.search(r"Generate (\d+) tools", session.requirement)
            if match:
                total_tools = int(match.group(1))

        progress = JobProgress(
            total=total_tools,
            completed=len([t for t in session.tools if t.registered]) if session.tools else 0,
            failed=0,
            inProgress=0 if status_str in ["completed", "failed"] else (total_tools - len(session.tools)) if session.tools else total_tools,
            currentTool=None if status_str in ["completed", "failed"] else "processing"
        )

        return JobResponse(
            jobId=jobId,
            status=status_str,
            createdAt=session.created_at.isoformat() if session.created_at else datetime.now(timezone.utc).isoformat(),
            updatedAt=session.updated_at.isoformat() if session.updated_at else datetime.now(timezone.utc).isoformat(),
            progress=progress,
            toolFiles=[
                ToolFile(
                    toolId=tool.session_id,
                    fileName=tool.file_name,
                    filePath=f"{get_settings().tools_path}/{tool.name}.py",
                    description=tool.description,
                    code=tool.code,  # Use the code stored in the ToolSpec model
                    endpoint=f"http://localhost:8000/tool/{tool.name}" if tool.registered else None,
                    registered=tool.registered,
                    createdAt=session.created_at.isoformat() if session.created_at else datetime.now(timezone.utc).isoformat()
                )
                for tool in session.tools
            ] if status_str == "completed" else None,
            failures=None,
            summary=GenerationSummary(
                totalRequested=len(session.tools) if session.tools else 1,
                successful=len([t for t in session.tools if t.registered]) if session.tools else 0,
                failed=0
            ) if status_str == "completed" else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status for {jobId}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


