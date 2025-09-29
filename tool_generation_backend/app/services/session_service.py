"""
Session service for workflow orchestration and management.
"""

import asyncio
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timezone
import logging

from app.models.session import (
    SessionUpdate, SessionStatus, Session, ToolSpec
)
from app.models.job import UserToolRequirement
from app.repositories.session_repository import SessionRepository
from app.agents import AgentManager

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing session workflows and orchestration."""

    def __init__(
        self,
        session_repo: SessionRepository,
        websocket_manager: Optional[Any] = None
    ):
        """
        Initialize session service.

        Args:
            session_repo: Session repository
            websocket_manager: WebSocket manager for real-time updates
        """
        self.session_repo = session_repo

        # Initialize OpenAI Agent Manager
        self.agent_manager = AgentManager()

        # WebSocket manager for real-time updates (optional)
        self.websocket_manager = websocket_manager

        # Track active workflows
        self.active_workflows: Dict[str, asyncio.Task] = {}

    async def create_session(self, job_id: str, user_id: str, tool_requirements: list[UserToolRequirement], operation_type: str = "generate", base_job_id: Optional[str] = None) -> str:
        """
        Create new session and start processing workflow.

        Args:
            job_id: Associated job ID
            user_id: User identifier
            tool_requirements: List of tool requirements
            operation_type: "generate" or "update"
            base_job_id: Base job ID for update operations

        Returns:
            str: Created session ID
        """
        try:
            # Create session data
            session_data = {
                "job_id": job_id,
                "user_id": user_id,
                "operation_type": operation_type,
                "tool_requirements": [req.model_dump() for req in tool_requirements] if operation_type == "generate" else [],
                "update_requirements": [req.model_dump() for req in tool_requirements] if operation_type == "update" else [],
                "base_job_id": base_job_id,
                "status": SessionStatus.PENDING
            }

            # Create session in database
            session_id = await self.session_repo.create_session(session_data)

            logger.info(f"Created session {session_id} for job {job_id} user {user_id}")

            # Start async workflow processing
            workflow_task = asyncio.create_task(
                self._process_workflow(session_id)
            )
            self.active_workflows[session_id] = workflow_task

            return session_id

        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise

    async def get_session(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID.

        Args:
            session_id: Session ID

        Returns:
            Optional[Session]: Session or None if not found
        """
        return await self.session_repo.get_by_id(session_id)

    async def get_session_by_job_id(self, job_id: str) -> Optional[Session]:
        """
        Get session by job ID.

        Args:
            job_id: Job ID to search for

        Returns:
            Optional[Session]: Session or None if not found
        """
        try:
            sessions = await self.session_repo.find_many({
                "job_id": job_id
            }, limit=1)
            return sessions[0] if sessions else None
        except Exception as e:
            logger.error(f"Error finding session by job ID {job_id}: {e}")
            return None

    async def update_session(self, session_id: str, update_data: SessionUpdate) -> bool:
        """
        Update session data.

        Args:
            session_id: Session ID
            update_data: Update data

        Returns:
            bool: True if updated successfully
        """
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        return await self.session_repo.update(session_id, update_dict)

    async def get_user_sessions(self, user_id: str, limit: int = 50) -> list[Session]:
        """
        Get sessions for a user.

        Args:
            user_id: User ID
            limit: Maximum number of sessions

        Returns:
            list[Session]: User's sessions
        """
        return await self.session_repo.get_sessions_by_user(user_id, limit)

    async def get_active_sessions(self, limit: Optional[int] = None) -> list[Session]:
        """
        Get active sessions.

        Args:
            limit: Maximum number of sessions

        Returns:
            list[Session]: Active sessions
        """
        return await self.session_repo.get_active_sessions(limit)

    async def cancel_session(self, session_id: str, reason: str = "User cancelled") -> bool:
        """
        Cancel an active session.

        Args:
            session_id: Session ID
            reason: Cancellation reason

        Returns:
            bool: True if cancelled successfully
        """
        try:
            # Cancel workflow task if running
            if session_id in self.active_workflows:
                workflow_task = self.active_workflows[session_id]
                workflow_task.cancel()
                del self.active_workflows[session_id]

            # Update session status
            success = await self.session_repo.update_status(
                session_id, SessionStatus.FAILED, f"Cancelled: {reason}"
            )

            if success:
                await self._notify_session_update(session_id, {
                    "type": "session-cancelled",
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            return success

        except Exception as e:
            logger.error(f"Failed to cancel session {session_id}: {e}")
            return False

    async def _process_workflow(self, session_id: str):
        """
        Execute agent workflow for all tool generation requests.

        Args:
            session_id: Session ID
        """
        try:
            logger.info(f"Starting agent workflow for session {session_id}")

            # Get session data
            session = await self.session_repo.get_by_id(session_id)
            if not session:
                raise ValueError(f"Session not found: {session_id}")

            # Build prompt from tool requirements and process through OpenAI Agent
            prompt = self._build_agent_prompt(session)
            await self._process_with_openai_agent(session_id, prompt)

            # Mark session as completed
            await self._update_session_status(session_id, SessionStatus.COMPLETED)
            logger.info(f"Agent workflow completed for session {session_id}")

        except asyncio.CancelledError:
            logger.info(f"Workflow cancelled for session {session_id}")
            await self._update_session_status(session_id, SessionStatus.FAILED, "Workflow cancelled")

        except Exception as e:
            error_msg = f"Workflow failed: {str(e)}"
            logger.error(f"Workflow failed for session {session_id}: {e}")
            await self._update_session_status(session_id, SessionStatus.FAILED, error_msg)

            # Notify via WebSocket that workflow failed
            await self._notify_session_update(session_id, {
                "type": "workflow-failed",
                "session_id": session_id,
                "error": error_msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        finally:
            # Clean up workflow tracking
            if session_id in self.active_workflows:
                del self.active_workflows[session_id]

    def _build_agent_prompt(self, session: Session) -> str:
        """
        Build agent prompt from session tool requirements.

        Args:
            session: Session with tool requirements

        Returns:
            str: Formatted prompt for the agent
        """
        if session.operation_type == "generate":
            requirements = session.tool_requirements
            prompt = f"Generate {len(requirements)} chemistry computation tools based on these requirements:\n\nTool Requirements:\n"
            for i, req in enumerate(requirements, 1):
                # Convert dict to UserToolRequirement if needed
                if isinstance(req, dict):
                    req_obj = UserToolRequirement(**req)
                else:
                    req_obj = req
                prompt += f"""
{i}. Description: {req_obj.description}
   Input: {req_obj.input}
   Output: {req_obj.output}
"""
        else:  # update
            requirements = session.update_requirements
            prompt = f"Update existing tools based on these requirements:\n\n"
            prompt += f"Base Job ID: {session.base_job_id}\n"
            prompt += "Update Requirements:\n"
            for i, req in enumerate(requirements, 1):
                # Convert dict to UserToolRequirement if needed
                if isinstance(req, dict):
                    req_obj = UserToolRequirement(**req)
                else:
                    req_obj = req
                prompt += f"""
{i}. Description: {req_obj.description}
   Input: {req_obj.input}
   Output: {req_obj.output}
"""
        return prompt

    async def _process_with_openai_agent(self, session_id: str, requirement: str):
        """Process requirement using OpenAI Agent SDK."""
        logger.info(f"Processing requirement with OpenAI Agent for session {session_id}")
        await self._update_session_status(session_id, SessionStatus.IMPLEMENTING)

        try:
            # Use OpenAI Agent to process the requirement
            async def progress_callback(progress):
                await self._notify_agent_progress(session_id, progress)

            result = await self.agent_manager.process_requirement(
                session_id=session_id,
                requirement=requirement,
                progress_callback=progress_callback
            )

            if result["success"]:
                logger.info(f"Successfully processed requirement for session {session_id}")

                # Extract and store any generated tools
                await self._process_agent_tool_results(session_id, result)

                await self._notify_session_update(session_id, {
                    "type": "processing-completed",
                    "session_id": session_id,
                    "messages": result.get("messages", []),
                    "run_id": result.get("run_id")
                })
            else:
                logger.error(f"Failed to process requirement for session {session_id}: {result['error']}")
                raise RuntimeError(f"Agent processing failed: {result['error']}")

        except Exception as e:
            logger.error(f"Error in OpenAI agent processing for session {session_id}: {e}")
            raise

    async def _process_agent_tool_results(self, session_id: str, agent_result: Dict[str, Any]):
        """Process tool generation results from the agent and store them in the session."""
        try:
            # Get the agent's conversation to extract tool execution results
            thread_id = self.agent_manager.active_threads.get(session_id)
            if not thread_id:
                logger.warning(f"No thread found for session {session_id}, cannot extract tool results")
                return

            # The agent manager should provide tool results in the result
            tool_results = agent_result.get("tool_results", [])
            tools_created = []

            for tool_result in tool_results:
                if tool_result.get("success") and tool_result.get("individual_tool"):
                    # Create tool spec from the result

                    tool_name = tool_result.get("tool_name")
                    output_file = tool_result.get("output_file")

                    if tool_name and output_file:
                        try:
                            # Read generated code
                            with open(output_file, 'r') as f:
                                tool_code = f.read()

                            tool_spec = ToolSpec(
                                session_id=session_id,
                                name=tool_name,
                                file_name=f"{tool_name}.py",
                                description=f"Generated chemistry tool: {tool_name}",
                                code=tool_code,
                                input_schema={},
                                output_schema={}
                            )

                            # Add tool to session's generated_tools list
                            await self.session_repo.add_generated_tool(session_id, tool_spec)
                            tools_created.append(tool_name)

                        except Exception as e:
                            logger.error(f"Failed to process tool result for {tool_name}: {e}")

            if tools_created:
                logger.info(f"Added {len(tools_created)} tools to session {session_id}: {tools_created}")
                await self._notify_session_update(session_id, {
                    "type": "tools-generated",
                    "session_id": session_id,
                    "tool_names": tools_created,
                    "tool_count": len(tools_created)
                })

        except Exception as e:
            logger.error(f"Error processing agent tool results for session {session_id}: {e}")


    async def _update_session_status(self, session_id: str, status: SessionStatus, error_message: Optional[str] = None):
        """Update session status and notify via WebSocket."""
        await self.session_repo.update_status(session_id, status, error_message)

        await self._notify_session_update(session_id, {
            "type": "status-update",
            "status": status.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": error_message
        })

    async def _notify_session_update(self, session_id: str, message: Dict[str, Any]):
        """Send WebSocket notification for session update."""
        if self.websocket_manager:
            try:
                await self.websocket_manager.send_to_session(session_id, message)
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification: {e}")

    async def _notify_agent_progress(self, session_id: str, progress: Dict[str, Any]):
        """Notify OpenAI agent progress via WebSocket."""
        await self._notify_session_update(session_id, {
            "type": "agent-progress",
            "agent": "openai_agent",
            "session_id": session_id,
            **progress
        })

    async def cleanup_completed_workflows(self):
        """Clean up completed workflow tasks."""
        completed_sessions = []

        for session_id, task in self.active_workflows.items():
            if task.done():
                completed_sessions.append(session_id)

        for session_id in completed_sessions:
            del self.active_workflows[session_id]

        if completed_sessions:
            logger.info(f"Cleaned up {len(completed_sessions)} completed workflows")

    def get_workflow_status(self, session_id: str) -> Optional[str]:
        """
        Get workflow status for a session.

        Args:
            session_id: Session ID

        Returns:
            Optional[str]: Workflow status or None if not found
        """
        if session_id not in self.active_workflows:
            return None

        task = self.active_workflows[session_id]

        if task.done():
            if task.cancelled():
                return "cancelled"
            elif task.exception():
                return "failed"
            else:
                return "completed"
        else:
            return "running"