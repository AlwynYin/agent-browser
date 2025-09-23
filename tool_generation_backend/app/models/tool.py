"""
Tool-related Pydantic models for tool execution and management.
"""

from typing import Any, Dict, List, Optional

from pydantic import Field

from .base import BaseModelConfig, DatabaseModel


class ToolExecutionRequest(BaseModelConfig):
    """Request model for tool execution."""

    tool_id: str = Field(description="ID of tool to execute")
    inputs: Dict[str, Any] = Field(
        description="Input parameters for tool execution"
    )
    timeout_seconds: Optional[int] = Field(
        default=60,
        description="Execution timeout in seconds"
    )
    dry_run: bool = Field(
        default=False,
        description="Whether to perform a dry run"
    )


class ToolExecutionResponse(BaseModelConfig):
    """Response model for tool execution."""

    execution_id: str = Field(description="Unique execution ID")
    tool_id: str = Field(description="Tool that was executed")
    tool_name: str = Field(description="Tool name")
    success: bool = Field(description="Whether execution was successful")
    outputs: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Tool execution outputs"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if execution failed"
    )
    execution_time_ms: float = Field(
        description="Execution time in milliseconds"
    )
    logs: List[str] = Field(
        default_factory=list,
        description="Execution logs"
    )


class ToolGenerationRequest(BaseModelConfig):
    """Request model for tool generation service integration."""

    tool_requirements: List[Dict[str, Any]] = Field(
        description="Tool requirements to generate"
    )
    options: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Generation options"
    )


class ToolGenerationResponse(BaseModelConfig):
    """Response model for tool generation."""

    job_id: str = Field(description="Generation job ID")
    status: str = Field(description="Generation status")
    created_at: str = Field(description="Creation timestamp")
    progress: Dict[str, Any] = Field(
        description="Generation progress"
    )


class ToolRegistrationRequest(BaseModelConfig):
    """Request model for tool registration with SimpleTooling."""

    file_paths: List[str] = Field(
        description="Paths to tool files to register"
    )
    simpletooling_url: Optional[str] = Field(
        default=None,
        description="SimpleTooling service URL"
    )
    force_reload: bool = Field(
        default=False,
        description="Whether to force reload existing tools"
    )


class ToolRegistrationResponse(BaseModelConfig):
    """Response model for tool registration."""

    registered_tools: List[Dict[str, Any]] = Field(
        description="Successfully registered tools"
    )
    failed_registrations: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Failed registration attempts with errors"
    )
    total_registered: int = Field(description="Total tools registered")
    simpletooling_url: str = Field(description="SimpleTooling service URL")


class ToolMetadata(DatabaseModel):
    """Tool metadata for tracking and management."""

    name: str = Field(description="Tool name")
    file_name: str = Field(description="Python file name")
    file_path: str = Field(description="Full file path")
    description: str = Field(description="Tool description")
    session_id: Optional[str] = Field(
        default=None,
        description="Associated session ID"
    )
    input_schema: Dict[str, Any] = Field(
        default_factory=dict,
        description="Input validation schema"
    )
    output_schema: Dict[str, Any] = Field(
        default_factory=dict,
        description="Output schema"
    )
    test_cases: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Test cases for the tool"
    )
    status: str = Field(
        default="pending",
        description="Tool status: pending, registered, deprecated, failed"
    )
    category: Optional[str] = Field(
        default=None,
        description="Tool category"
    )
    version: str = Field(
        default="1.0.0",
        description="Tool version"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="Required Python packages"
    )
    endpoint: Optional[str] = Field(
        default=None,
        description="SimpleTooling HTTP endpoint URL"
    )
    registered: bool = Field(
        default=False,
        description="Whether registered with SimpleTooling"
    )
    last_registration_attempt: Optional[str] = Field(
        default=None,
        description="Last registration attempt timestamp"
    )
    registration_error: Optional[str] = Field(
        default=None,
        description="Last registration error message"
    )
    deprecated_at: Optional[str] = Field(
        default=None,
        description="Deprecation timestamp"
    )
    deprecation_reason: Optional[str] = Field(
        default=None,
        description="Reason for deprecation"
    )


class ToolFile(BaseModelConfig):
    """Tool file information for storage management."""

    file_name: str = Field(description="Tool file name")
    file_path: str = Field(description="Full file path")
    content: str = Field(description="Tool file content")
    size_bytes: int = Field(description="File size in bytes")
    content_hash: str = Field(description="Content hash for change detection")


class ToolListRequest(BaseModelConfig):
    """Request model for listing tools."""

    category: Optional[str] = Field(
        default=None,
        description="Filter by category"
    )
    registered_only: bool = Field(
        default=False,
        description="Only show registered tools"
    )
    limit: int = Field(
        default=100,
        description="Maximum number of tools to return"
    )
    offset: int = Field(
        default=0,
        description="Number of tools to skip"
    )


class ToolListResponse(BaseModelConfig):
    """Response model for tool listing."""

    tools: List[ToolMetadata] = Field(
        description="List of tools"
    )
    total_count: int = Field(description="Total number of tools")
    categories: List[str] = Field(
        default_factory=list,
        description="Available categories"
    )
    registered_count: int = Field(
        description="Number of registered tools"
    )


class BulkToolUploadRequest(BaseModelConfig):
    """Request model for bulk tool file upload."""

    files: List[Dict[str, Any]] = Field(
        description="Tool files to upload"
    )
    options: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Upload options"
    )
    auto_register: bool = Field(
        default=True,
        description="Automatically register uploaded tools"
    )


class BulkToolUploadResponse(BaseModelConfig):
    """Response model for bulk tool upload."""

    uploaded_files: List[Dict[str, Any]] = Field(
        description="Successfully uploaded files"
    )
    registered_tools: List[ToolMetadata] = Field(
        default_factory=list,
        description="Successfully registered tools"
    )
    errors: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Upload/registration errors"
    )
    total_uploaded: int = Field(description="Total files uploaded")
    total_registered: int = Field(description="Total tools registered")