"""
Tool repository for tool storage and metadata management.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import logging

from .base import BaseRepository
from app.models.tool import ToolMetadata, ToolFile
from app.models.session import ToolSpec, ExecutionResult

logger = logging.getLogger(__name__)


class ToolRepository(BaseRepository[ToolMetadata]):
    """Repository for tool metadata and file management."""

    def __init__(self):
        super().__init__(ToolMetadata, "tools")

    async def store_tool_metadata(self, tool_spec: ToolSpec, file_path: str, session_id: str) -> str:
        """
        Store tool metadata from a generated tool specification.

        Args:
            tool_spec: Tool specification from implementer agent
            file_path: Path where tool file is stored
            session_id: Associated session ID

        Returns:
            str: Created tool metadata ID
        """
        metadata = {
            "name": tool_spec.name,
            "file_name": tool_spec.file_name,
            "description": tool_spec.description,
            "file_path": file_path,
            "session_id": session_id,
            "input_schema": tool_spec.input_schema,
            "output_schema": tool_spec.output_schema,
            "dependencies": tool_spec.dependencies,
            "test_cases": tool_spec.test_cases,
            "status": tool_spec.status,
            "endpoint": tool_spec.endpoint,
            "registered": tool_spec.registered,
            "version": "1.0.0",
            "category": "generated"
        }

        return await self.create(metadata)

    async def update_registration_status(self, tool_id: str, endpoint: str, registered: bool = True) -> bool:
        """
        Update tool registration status and endpoint.

        Args:
            tool_id: Tool metadata ID
            endpoint: SimpleTooling endpoint URL
            registered: Registration status

        Returns:
            bool: True if updated successfully
        """
        update_data = {
            "registered": registered,
            "endpoint": endpoint,
            "status": "registered" if registered else "pending"
        }

        return await self.update(tool_id, update_data)

    async def get_tools_by_session(self, session_id: str) -> List[ToolMetadata]:
        """
        Get all tools for a specific session.

        Args:
            session_id: Session ID

        Returns:
            List[ToolMetadata]: Tools created in the session
        """
        return await self.find_by_field("session_id", session_id)

    async def get_registered_tools(self, limit: Optional[int] = None) -> List[ToolMetadata]:
        """
        Get all registered tools.

        Args:
            limit: Maximum number of tools to return

        Returns:
            List[ToolMetadata]: Registered tools
        """
        return await self.find_by_field("registered", True, limit)

    async def get_tools_by_category(self, category: str, limit: Optional[int] = None) -> List[ToolMetadata]:
        """
        Get tools by category.

        Args:
            category: Tool category (e.g., 'generated', 'custom', 'chemistry')
            limit: Maximum number of tools to return

        Returns:
            List[ToolMetadata]: Tools in the specified category
        """
        return await self.find_by_field("category", category, limit)

    async def search_tools(self, search_term: str, limit: int = 20) -> List[ToolMetadata]:
        """
        Search tools by name or description.

        Args:
            search_term: Term to search for in name and description
            limit: Maximum number of tools to return

        Returns:
            List[ToolMetadata]: Matching tools
        """
        try:
            # Create text search query
            query = {
                "$or": [
                    {"name": {"$regex": search_term, "$options": "i"}},
                    {"description": {"$regex": search_term, "$options": "i"}}
                ]
            }

            return await self.find_many(query, limit=limit, sort_by="created_at")

        except Exception as e:
            logger.error(f"Failed to search tools with term '{search_term}': {e}")
            return []

    async def get_tool_usage_stats(self, tool_id: str) -> Dict[str, Any]:
        """
        Get usage statistics for a tool.

        Args:
            tool_id: Tool metadata ID

        Returns:
            Dict[str, Any]: Usage statistics
        """
        try:
            # Get tool metadata
            tool = await self.get_by_id(tool_id)
            if not tool:
                return {}

            # Count executions from execution results collection
            execution_collection = self.collection.database["execution_results"]
            total_executions = await execution_collection.count_documents({"tool_id": tool_id})

            # Count successful executions
            successful_executions = await execution_collection.count_documents({
                "tool_id": tool_id,
                "success": True
            })

            # Get recent executions
            recent_executions = await execution_collection.find(
                {"tool_id": tool_id}
            ).sort("created_at", -1).limit(10).to_list(length=10)

            return {
                "tool_id": tool_id,
                "tool_name": tool.name,
                "total_executions": total_executions,
                "successful_executions": successful_executions,
                "success_rate": successful_executions / total_executions if total_executions > 0 else 0,
                "recent_executions": [
                    {
                        "execution_id": str(exec_result["_id"]),
                        "success": exec_result.get("success", False),
                        "created_at": exec_result.get("created_at"),
                        "execution_time_ms": exec_result.get("execution_time_ms")
                    }
                    for exec_result in recent_executions
                ]
            }

        except Exception as e:
            logger.error(f"Failed to get usage stats for tool {tool_id}: {e}")
            return {}

    async def mark_tool_deprecated(self, tool_id: str, reason: str) -> bool:
        """
        Mark a tool as deprecated.

        Args:
            tool_id: Tool metadata ID
            reason: Reason for deprecation

        Returns:
            bool: True if updated successfully
        """
        update_data = {
            "status": "deprecated",
            "deprecated_at": datetime.now(timezone.utc),
            "deprecation_reason": reason
        }

        return await self.update(tool_id, update_data)

    async def ensure_indexes(self):
        """Create indexes for optimal query performance."""
        try:
            # Index for session queries
            await self.collection.create_index("session_id")

            # Index for name and category queries
            await self.collection.create_index("name")
            await self.collection.create_index("category")

            # Index for registration status
            await self.collection.create_index("registered")

            # Index for status
            await self.collection.create_index("status")

            # Text index for search functionality
            await self.collection.create_index([
                ("name", "text"),
                ("description", "text")
            ])

            # Compound index for category + status queries
            await self.collection.create_index([("category", 1), ("status", 1)])

            logger.info("Tool repository indexes created successfully")

        except Exception as e:
            logger.error(f"Failed to create tool repository indexes: {e}")


class ExecutionResultRepository(BaseRepository[ExecutionResult]):
    """Repository for tool execution results."""

    def __init__(self):
        super().__init__(ExecutionResult, "execution_results")

    async def store_execution_result(self, result: ExecutionResult) -> str:
        """
        Store tool execution result.

        Args:
            result: Execution result data

        Returns:
            str: Created execution result ID
        """
        result_dict = result.model_dump()
        return await self.create(result_dict)

    async def get_results_by_session(self, session_id: str, limit: Optional[int] = None) -> List[ExecutionResult]:
        """
        Get execution results for a session.

        Args:
            session_id: Session ID
            limit: Maximum number of results to return

        Returns:
            List[ExecutionResult]: Execution results
        """
        return await self.find_by_field("session_id", session_id, limit)

    async def get_results_by_tool(self, tool_id: str, limit: Optional[int] = None) -> List[ExecutionResult]:
        """
        Get execution results for a specific tool.

        Args:
            tool_id: Tool ID
            limit: Maximum number of results to return

        Returns:
            List[ExecutionResult]: Execution results
        """
        return await self.find_by_field("tool_id", tool_id, limit)

    async def get_failed_executions(self, limit: Optional[int] = None) -> List[ExecutionResult]:
        """
        Get failed execution results for debugging.

        Args:
            limit: Maximum number of results to return

        Returns:
            List[ExecutionResult]: Failed execution results
        """
        return await self.find_by_field("success", False, limit)

    async def ensure_indexes(self):
        """Create indexes for optimal query performance."""
        try:
            # Index for session queries
            await self.collection.create_index("session_id")

            # Index for tool queries
            await self.collection.create_index("tool_id")

            # Index for success status
            await self.collection.create_index("success")

            # Compound index for tool + success queries
            await self.collection.create_index([("tool_id", 1), ("success", 1)])

            # Index for created_at for sorting
            await self.collection.create_index("created_at")

            logger.info("Execution result repository indexes created successfully")

        except Exception as e:
            logger.error(f"Failed to create execution result repository indexes: {e}")