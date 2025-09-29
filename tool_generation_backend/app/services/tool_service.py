"""
Tool service for tool management, generation, and registration.
"""

from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import logging
from datetime import datetime, timezone

from app.models.tool import (
    ToolMetadata, ToolGenerationRequest, ToolGenerationResponse,
    ToolRegistrationRequest, ToolRegistrationResponse,
    ToolExecutionRequest, ToolExecutionResponse
)
from app.models.session import ToolSpec, ExecutionResult
from app.repositories.tool_repository import ToolRepository, ExecutionResultRepository
# AIService removed - using OpenAI Agent SDK

logger = logging.getLogger(__name__)


class ToolService:
    """Service for comprehensive tool management."""

    def __init__(
        self,
        tool_repo: ToolRepository,
        execution_repo: ExecutionResultRepository,
    ):
        """
        Initialize tool service.

        Args:
            tool_repo: Tool repository
            execution_repo: Execution result repository
            simpletooling_client: SimpleTooling client
        """
        self.tool_repo = tool_repo
        self.execution_repo = execution_repo

    async def generate_tool(self, generation_request: ToolGenerationRequest) -> ToolGenerationResponse:
        """
        Generate tools from requirements.

        Args:
            generation_request: Tool generation request

        Returns:
            ToolGenerationResponse: Generation result
        """
        try:
            job_id = f"gen_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            logger.info(f"Starting tool generation job: {job_id}")

            # Process tool requirements
            tools_generated = []
            total_requirements = len(generation_request.tool_requirements)

            for i, requirement in enumerate(generation_request.tool_requirements):
                # Generate tool using AI service
                tool_data = await self._generate_single_tool(requirement)

                if tool_data:
                    tools_generated.append(tool_data)

                # Update progress
                progress = {
                    "current": i + 1,
                    "total": total_requirements,
                    "completed": len(tools_generated),
                    "current_tool": requirement.get("name", f"tool_{i}")
                }

                logger.info(f"Tool generation progress: {progress['current']}/{progress['total']}")

            return ToolGenerationResponse(
                job_id=job_id,
                status="completed" if tools_generated else "failed",
                created_at=datetime.now(timezone.utc).isoformat(),
                progress={
                    "total_requirements": total_requirements,
                    "tools_generated": len(tools_generated),
                    "success_rate": len(tools_generated) / total_requirements if total_requirements > 0 else 0,
                    "completed": True
                }
            )

        except Exception as e:
            logger.error(f"Tool generation failed: {e}")
            return ToolGenerationResponse(
                job_id=job_id,
                status="failed",
                created_at=datetime.now(timezone.utc).isoformat(),
                progress={"error": str(e)}
            )

    # TODO: work in progress
    async def register_tools(self, registration_request: ToolRegistrationRequest) -> ToolRegistrationResponse:
        """
        Register tools with SimpleTooling service.

        Args:
            registration_request: Tool registration request

        Returns:
            ToolRegistrationResponse: Registration result
        """
        try:
            registered_tools = []
            failed_registrations = []

            for file_path in registration_request.file_paths:
                try:
                    # Note: Tool validation removed with RegistrationService
                    # Tools are validated during Codex generation process

                    # Load tool into SimpleTooling
                    load_result = await self.simpletooling_client.load_tool_file(file_path)

                    if load_result["status"] == "success":
                        # Store tool metadata
                        tool_name = Path(file_path).stem

                        tool_metadata = {
                            "name": tool_name,
                            "file_name": Path(file_path).name,
                            "file_path": file_path,
                            "description": f"Tool from {file_path}",
                            "registered": True,
                            "status": "registered",
                            "category": "uploaded"
                        }

                        metadata_id = await self.tool_repo.create(tool_metadata)

                        registered_tools.append({
                            "metadata_id": metadata_id,
                            "file_path": file_path,
                            "endpoint": endpoint,
                            "name": tool_name
                        })

                    else:
                        failed_registrations.append({
                            "file_path": file_path,
                            "error": load_result.get("error", "Registration failed")
                        })

                except Exception as e:
                    failed_registrations.append({
                        "file_path": file_path,
                        "error": str(e)
                    })

            return ToolRegistrationResponse(
                registered_tools=registered_tools,
                failed_registrations=failed_registrations,
                total_registered=len(registered_tools),
            )

        except Exception as e:
            logger.error(f"Tool registration failed: {e}")
            return ToolRegistrationResponse(
                registered_tools=[],
                failed_registrations=[{"error": str(e)}],
                total_registered=0,
            )

    # TODO: work in progress
    async def execute_tool(self, execution_request: ToolExecutionRequest) -> ToolExecutionResponse:
        """
        Execute a tool and return results.

        Args:
            execution_request: Tool execution request

        Returns:
            ToolExecutionResponse: Execution result
        """
        try:
            start_time = datetime.now(timezone.utc)

            # Get tool metadata
            tool_metadata = await self.tool_repo.get_by_id(execution_request.tool_id)
            if not tool_metadata:
                return ToolExecutionResponse(
                    execution_id=f"exec_{start_time.strftime('%Y%m%d_%H%M%S')}",
                    tool_id=execution_request.tool_id,
                    tool_name="unknown",
                    success=False,
                    error_message="Tool not found",
                    execution_time_ms=0,
                    logs=["Error: Tool not found"]
                )

            if execution_request.dry_run:
                # Perform dry run validation
                return ToolExecutionResponse(
                    execution_id=f"dry_{start_time.strftime('%Y%m%d_%H%M%S')}",
                    tool_id=execution_request.tool_id,
                    tool_name=tool_metadata.name,
                    success=True,
                    outputs={"message": "Dry run successful - tool would execute with these inputs"},
                    execution_time_ms=0,
                    logs=["Dry run completed successfully"]
                )

            # Execute tool via SimpleTooling
            execution_result = await self.simpletooling_client.execute_tool(
                tool_metadata.name,
                execution_request.inputs
            )

            end_time = datetime.now(timezone.utc)
            execution_time_ms = (end_time - start_time).total_seconds() * 1000

            execution_id = f"exec_{start_time.strftime('%Y%m%d_%H%M%S_%f')}"

            # Store execution result
            result_record = ExecutionResult(
                session_id="direct_execution",  # For direct executions
                tool_id=execution_request.tool_id,
                tool_name=tool_metadata.name,
                inputs=execution_request.inputs,
                outputs=execution_result.get("outputs"),
                success=execution_result["status"] == "success",
                error_message=execution_result.get("error"),
                execution_time_ms=execution_time_ms
            )

            await self.execution_repo.store_execution_result(result_record)

            return ToolExecutionResponse(
                execution_id=execution_id,
                tool_id=execution_request.tool_id,
                tool_name=tool_metadata.name,
                success=execution_result["status"] == "success",
                outputs=execution_result.get("outputs"),
                error_message=execution_result.get("error"),
                execution_time_ms=execution_time_ms,
                logs=execution_result.get("logs", [])
            )

        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return ToolExecutionResponse(
                execution_id=f"error_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                tool_id=execution_request.tool_id,
                tool_name="unknown",
                success=False,
                error_message=str(e),
                execution_time_ms=0,
                logs=[f"Error: {str(e)}"]
            )

    async def get_tool_metadata(self, tool_id: str) -> Optional[ToolMetadata]:
        """
        Get tool metadata by ID.

        Args:
            tool_id: Tool metadata ID

        Returns:
            Optional[ToolMetadata]: Tool metadata or None
        """
        return await self.tool_repo.get_by_id(tool_id)

    async def list_tools(
        self,
        category: Optional[str] = None,
        registered_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List available tools with filtering.

        Args:
            category: Filter by category
            registered_only: Only show registered tools
            limit: Maximum number of tools
            offset: Number of tools to skip

        Returns:
            Dict[str, Any]: Tool listing result
        """
        try:
            # Build query filters
            query_filters = {}

            if category:
                query_filters["category"] = category

            if registered_only:
                query_filters["registered"] = True

            # Get tools
            tools = await self.tool_repo.find_many(query_filters, limit=limit)

            # Skip offset tools
            if offset > 0:
                tools = tools[offset:]

            # Get total count
            total_count = await self.tool_repo.count(query_filters)

            # Get available categories
            all_tools = await self.tool_repo.find_many({})
            categories = list(set(tool.category for tool in all_tools if tool.category))

            # Count registered tools
            registered_count = await self.tool_repo.count({"registered": True})

            return {
                "tools": tools,
                "total_count": total_count,
                "categories": categories,
                "registered_count": registered_count,
                "offset": offset,
                "limit": limit
            }

        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            return {
                "tools": [],
                "total_count": 0,
                "categories": [],
                "registered_count": 0,
                "error": str(e)
            }

    async def search_tools(self, search_term: str, limit: int = 20) -> List[ToolMetadata]:
        """
        Search tools by name or description.

        Args:
            search_term: Search term
            limit: Maximum results

        Returns:
            List[ToolMetadata]: Matching tools
        """
        return await self.tool_repo.search_tools(search_term, limit)

    async def get_tool_usage_stats(self, tool_id: str) -> Dict[str, Any]:
        """
        Get usage statistics for a tool.

        Args:
            tool_id: Tool ID

        Returns:
            Dict[str, Any]: Usage statistics
        """
        return await self.tool_repo.get_tool_usage_stats(tool_id)

    async def delete_tool(self, tool_id: str) -> bool:
        """
        Delete a tool and unregister from SimpleTooling.

        Args:
            tool_id: Tool ID

        Returns:
            bool: True if deleted successfully
        """
        try:
            # Get tool metadata
            tool_metadata = await self.tool_repo.get_by_id(tool_id)
            if not tool_metadata:
                return False

            # Unregister from SimpleTooling if registered
            if tool_metadata.registered:
                # Note: Unregistration now handled directly via SimpleTooling client
                await self.simpletooling_client.unload_tool(tool_metadata.name)

            # Delete from database
            return await self.tool_repo.delete(tool_id)

        except Exception as e:
            logger.error(f"Failed to delete tool {tool_id}: {e}")
            return False

    async def _generate_single_tool(self, requirement: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate a single tool from a requirement specification."""
        try:
            # Tool generation now handled by OpenAI Agent SDK via SessionService
            logger.info("Tool generation delegated to OpenAI Agent SDK")
            return {
                "name": requirement.get("name", "generated_tool"),
                "description": requirement.get("description", "Generated tool"),
                "status": "delegated_to_agent_sdk"
            }

        except Exception as e:
            logger.error(f"Failed to generate tool from requirement: {e}")
            return None