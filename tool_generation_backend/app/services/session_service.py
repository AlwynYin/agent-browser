"""
Session service for workflow orchestration and management.
"""

import asyncio
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timezone
import logging

from app.models.session import (
    SessionCreate, SessionUpdate, SessionStatus, Session,
    ImplementationPlan, SearchPlan, ApiSpec, ToolSpec, ExecutionResult
)
from app.repositories.session_repository import SessionRepository
from app.repositories.tool_repository import ToolRepository, ExecutionResultRepository
from simpletooling_integration import SimpleToolingClient
from app.agents import AgentManager

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing session workflows and orchestration."""

    def __init__(
        self,
        session_repo: SessionRepository,
        tool_repo: ToolRepository,
        execution_repo: ExecutionResultRepository,
        simpletooling_client: SimpleToolingClient,
        websocket_manager: Optional[Any] = None
    ):
        """
        Initialize session service.

        Args:
            session_repo: Session repository
            tool_repo: Tool repository
            execution_repo: Execution result repository
            simpletooling_client: SimpleTooling client
            websocket_manager: WebSocket manager for real-time updates
        """
        self.session_repo = session_repo
        self.tool_repo = tool_repo
        self.execution_repo = execution_repo
        self.simpletooling_client = simpletooling_client

        # Registration service removed - using direct codex generation

        # Initialize OpenAI Agent Manager
        self.agent_manager = AgentManager()

        # WebSocket manager for real-time updates (optional)
        self.websocket_manager = websocket_manager

        # Track active workflows
        self.active_workflows: Dict[str, asyncio.Task] = {}

    async def create_session(self, session_data: SessionCreate) -> str:
        """
        Create new session and start processing workflow.

        Args:
            session_data: Session creation data

        Returns:
            str: Created session ID
        """
        try:
            # Create session in database
            session_id = await self.session_repo.create_session(session_data)

            logger.info(f"Created session {session_id} for user {session_data.user_id}")

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
        Get session by job ID (searches in requirement field).

        Args:
            job_id: Job ID to search for

        Returns:
            Optional[Session]: Session or None if not found
        """
        try:
            # Use regex to search for job ID in requirement field
            import re
            sessions = await self.session_repo.find_many({
                "requirement": {"$regex": f"Job ID: {re.escape(job_id)}", "$options": "i"}
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
        Execute the three-phase agent workflow.

        Args:
            session_id: Session ID
        """
        try:
            logger.info(f"Starting workflow for session {session_id}")

            # Get session data
            session = await self.session_repo.get_by_id(session_id)
            if not session:
                raise ValueError(f"Session not found: {session_id}")

            # Check if this is a job-based tool generation request
            if "Job ID:" in session.requirement and "Tool Requirements:" in session.requirement:
                await self._process_job_requirements(session_id, session.requirement)
                # Job processing handles its own completion status
            else:
                # Single-phase processing using OpenAI Agent
                await self._process_with_openai_agent(session_id, session.requirement)
                # Mark session as completed for non-job workflows
                await self._update_session_status(session_id, SessionStatus.COMPLETED)

            logger.info(f"Workflow completed for session {session_id}")

        except asyncio.CancelledError:
            logger.info(f"Workflow cancelled for session {session_id}")
            await self._update_session_status(session_id, SessionStatus.FAILED, "Workflow cancelled")

        except Exception as e:
            logger.error(f"Workflow failed for session {session_id}: {e}")
            await self._update_session_status(session_id, SessionStatus.FAILED, str(e))

        finally:
            # Clean up workflow tracking
            if session_id in self.active_workflows:
                del self.active_workflows[session_id]

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

    async def _process_job_requirements(self, session_id: str, requirement: str):
        """Process job-based tool generation requirements."""
        logger.info(f"Processing job requirements for session {session_id}")
        await self._update_session_status(session_id, SessionStatus.IMPLEMENTING)

        try:
            # Parse job data from requirement string
            import re
            import ast

            # Extract job ID
            job_id_match = re.search(r"Job ID: (job_[a-f0-9]+)", requirement)
            if not job_id_match:
                raise ValueError("Could not extract job ID from requirement")
            job_id = job_id_match.group(1)

            # Extract tool requirements
            tool_req_match = re.search(r"Tool Requirements: (\[.*?\]) - Structured Requirements:", requirement, re.DOTALL)
            if not tool_req_match:
                raise ValueError("Could not extract tool requirements from requirement")

            # Extract structured requirements
            struct_req_match = re.search(r"Structured Requirements: (\[.*?\])$", requirement, re.DOTALL)
            if not struct_req_match:
                raise ValueError("Could not extract structured requirements from requirement")

            try:
                structured_requirements = ast.literal_eval(struct_req_match.group(1))
            except:
                raise ValueError("Could not parse structured requirements")

            # Generate tools using existing method
            await self.generate_tools_from_requirements(
                session_id=session_id,
                job_id=job_id,
                tool_requirements=[],  # We don't need the original format here
                structured_requirements=structured_requirements
            )

        except Exception as e:
            logger.error(f"Error processing job requirements for session {session_id}: {e}")
            raise

    async def generate_tools_from_requirements(
        self,
        session_id: str,
        job_id: str,
        tool_requirements: list,
        structured_requirements: list
    ):
        """
        Generate multiple tools from natural language requirements.

        Args:
            session_id: Session ID
            job_id: Job ID for tracking
            tool_requirements: Original natural language requirements
            structured_requirements: Converted structured requirements for codex
        """
        try:
            logger.info(f"Starting batch tool generation for job {job_id}, session {session_id}")
            await self._update_session_status(session_id, SessionStatus.IMPLEMENTING)

            # For now, generate a single combined tool file
            # In a full implementation, you'd generate individual tools
            combined_tool_name = f"generated_tools_{job_id.split('_')[1]}"

            from app.utils.codex_utils import execute_codex_implement
            result = await execute_codex_implement(combined_tool_name, structured_requirements)

            if result["success"]:
                logger.info(f"Successfully generated combined tool for job {job_id}")

                # Create tool spec and add to session
                from app.models.session import ToolSpec

                # Read the generated code file
                try:
                    with open(result["output_file"], 'r') as f:
                        generated_code = f.read()
                except Exception as e:
                    logger.warning(f"Could not read generated file: {e}")
                    generated_code = "# Generated code file not found"

                tool_spec = ToolSpec(
                    session_id=session_id,
                    name=combined_tool_name,
                    file_name=f"{combined_tool_name}.py",
                    description=f"Generated tools for job {job_id}",
                    code=generated_code,
                    input_schema={},
                    output_schema={}
                )

                await self.session_repo.add_tool(session_id, tool_spec)
                await self._update_session_status(session_id, SessionStatus.COMPLETED)

                # Notify success
                await self._notify_session_update(session_id, {
                    "type": "tools-generated",
                    "job_id": job_id,
                    "tool_count": len(tool_requirements),
                    "file_path": result["output_file"],
                    "session_id": session_id
                })

            else:
                logger.error(f"Failed to generate tools for job {job_id}: {result['error']}")
                await self._update_session_status(session_id, SessionStatus.FAILED, result["error"])

        except Exception as e:
            logger.error(f"Error in batch tool generation for job {job_id}: {e}")
            await self._update_session_status(session_id, SessionStatus.FAILED, str(e))

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

    async def execute_tool(self, session_id: str, tool_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool and store the result.

        Args:
            session_id: Session ID
            tool_name: Name of tool to execute
            inputs: Tool inputs

        Returns:
            Dict[str, Any]: Execution result
        """
        try:
            # Execute tool via SimpleTooling
            execution_result = await self.simpletooling_client.execute_tool(tool_name, inputs)

            # Create execution result record
            result = ExecutionResult(
                session_id=session_id,
                tool_id=tool_name,  # Using tool name as ID for now
                tool_name=tool_name,
                inputs=inputs,
                outputs=execution_result.get("outputs"),
                success=execution_result["status"] == "success",
                error_message=execution_result.get("error"),
                execution_time_ms=execution_result.get("execution_time_ms")
            )

            # Store execution result
            await self.execution_repo.store_execution_result(result)

            # Add to session results
            await self.session_repo.add_execution_result(session_id, result)

            # Notify via WebSocket
            await self._notify_session_update(session_id, {
                "type": "tool-executed",
                "tool_name": tool_name,
                "success": result.success,
                "execution_time_ms": result.execution_time_ms,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            return execution_result

        except Exception as e:
            logger.error(f"Tool execution failed for {tool_name}: {e}")
            return {
                "status": "error",
                "tool_name": tool_name,
                "error": str(e)
            }

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