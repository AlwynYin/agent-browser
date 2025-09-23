"""
Session-related Pydantic models.
Translated from TypeScript schema interfaces.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import Field

from .base import DatabaseModel, BaseModelConfig


class SessionStatus(str, Enum):
    """Session workflow status enumeration."""
    PENDING = "pending"
    PLANNING = "planning"
    SEARCHING = "searching"
    IMPLEMENTING = "implementing"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class ToolRequirement(BaseModelConfig):
    """Tool requirement specification from orchestrator agent."""

    name: str = Field(description="Tool name")
    description: str = Field(description="Tool description")
    input_format: Dict[str, Any] = Field(
        description="JSON schema for tool inputs"
    )
    output_format: Dict[str, Any] = Field(
        description="JSON schema for tool outputs"
    )
    required_apis: List[str] = Field(
        default_factory=list,
        description="API functions needed for this tool"
    )
    priority: int = Field(
        default=1,
        description="Tool implementation priority"
    )


class ImplementationPlan(DatabaseModel):
    """Implementation plan from orchestrator agent."""

    session_id: str = Field(description="Associated session ID")
    tool_requirements: List[ToolRequirement] = Field(
        default_factory=list,
        description="List of tools to implement"
    )
    estimated_complexity: str = Field(
        default="medium",
        description="Estimated implementation complexity: low, medium, high"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="Required packages/libraries"
    )


class SearchTarget(BaseModelConfig):
    """Search target for browser agent."""

    package: str = Field(description="Package name to search")
    urls: List[str] = Field(
        default_factory=list,
        description="URLs to search for documentation"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Keywords to search for"
    )
    priority: int = Field(
        default=1,
        description="Search priority"
    )


class SearchPlan(DatabaseModel):
    """Search plan for browser agent."""

    session_id: str = Field(description="Associated session ID")
    search_targets: List[SearchTarget] = Field(
        default_factory=list,
        description="List of packages/APIs to search"
    )
    max_concurrent_searches: int = Field(
        default=8,
        description="Maximum concurrent search tasks"
    )


class ApiSpec(DatabaseModel):
    """API specification extracted by browser agent."""

    session_id: str = Field(description="Associated session ID")
    package: str = Field(description="Package name")
    module: str = Field(description="Module name")
    function_name: str = Field(description="Function name")
    description: str = Field(description="Function description")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Function parameters schema"
    )
    returns: Dict[str, Any] = Field(
        default_factory=dict,
        description="Function return value schema"
    )
    examples: List[str] = Field(
        default_factory=list,
        description="Usage examples"
    )
    source_url: str = Field(description="Source documentation URL")


class ToolSpec(DatabaseModel):
    """Generated tool specification from implementer agent."""

    session_id: str = Field(description="Associated session ID")
    name: str = Field(description="Tool name")
    file_name: str = Field(description="Python file name")
    description: str = Field(description="Tool description")
    code: str = Field(description="Generated Python code")
    input_schema: Dict[str, Any] = Field(
        default_factory=dict,
        description="Input validation schema"
    )
    output_schema: Dict[str, Any] = Field(
        default_factory=dict,
        description="Output schema"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="Required Python packages"
    )
    test_cases: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Generated test cases"
    )
    status: str = Field(
        default="pending",
        description="Tool status: pending, implemented, tested, failed"
    )
    endpoint: Optional[str] = Field(
        default=None,
        description="SimpleTooling HTTP endpoint URL"
    )
    registered: bool = Field(
        default=False,
        description="Whether registered with SimpleTooling"
    )


class ExecutionResult(DatabaseModel):
    """Tool execution result."""

    session_id: str = Field(description="Associated session ID")
    tool_id: str = Field(description="Tool ID that was executed")
    tool_name: str = Field(description="Tool name")
    inputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool execution inputs"
    )
    outputs: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Tool execution outputs"
    )
    success: bool = Field(description="Whether execution was successful")
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if execution failed"
    )
    execution_time_ms: Optional[float] = Field(
        default=None,
        description="Execution time in milliseconds"
    )


class Session(DatabaseModel):
    """Main session model representing a user's computation workflow."""

    user_id: str = Field(description="User identifier")
    requirement: str = Field(description="User's input requirement")
    status: SessionStatus = Field(
        default=SessionStatus.PENDING,
        description="Current workflow status"
    )
    implementation_plan: Optional[ImplementationPlan] = Field(
        default=None,
        description="Implementation plan from orchestrator"
    )
    search_plan: Optional[SearchPlan] = Field(
        default=None,
        description="Search plan for browser agent"
    )
    api_specs: List[ApiSpec] = Field(
        default_factory=list,
        description="API specifications found by browser agent"
    )
    tools: List[ToolSpec] = Field(
        default_factory=list,
        description="Generated tools from implementer agent"
    )
    results: List[ExecutionResult] = Field(
        default_factory=list,
        description="Tool execution results"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if session failed"
    )


# Request/Response models for API endpoints
class SessionCreate(BaseModelConfig):
    """Request model for creating a new session."""

    user_id: str = Field(description="User identifier")
    requirement: str = Field(description="User's input requirement")


class SessionUpdate(BaseModelConfig):
    """Request model for updating a session."""

    status: Optional[SessionStatus] = Field(
        default=None,
        description="New session status"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if applicable"
    )


class SessionResponse(BaseModelConfig):
    """Response model for session operations."""

    session_id: str = Field(description="Session ID")
    status: SessionStatus = Field(description="Current session status")
    created_at: datetime = Field(description="Session creation timestamp")
    updated_at: Optional[datetime] = Field(
        default=None,
        description="Last update timestamp"
    )