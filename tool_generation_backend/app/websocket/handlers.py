"""
WebSocket event handlers for session-specific events.
"""

from typing import Dict, Any, Optional
import logging
from datetime import datetime, timezone

from .manager import WebSocketManager

logger = logging.getLogger(__name__)


class SessionHandler:
    """Handler for session-specific WebSocket events."""

    def __init__(self, websocket_manager: WebSocketManager):
        """
        Initialize session handler.

        Args:
            websocket_manager: WebSocket manager instance
        """
        self.websocket_manager = websocket_manager

    async def notify_session_status_change(
        self,
        session_id: str,
        old_status: str,
        new_status: str,
        error_message: Optional[str] = None
    ):
        """
        Notify clients of session status change.

        Args:
            session_id: Session ID
            old_status: Previous status
            new_status: New status
            error_message: Error message if status is failed
        """
        message = {
            "type": "session-status-changed",
            "session_id": session_id,
            "old_status": old_status,
            "new_status": new_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if error_message:
            message["error_message"] = error_message

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_phase_progress(
        self,
        session_id: str,
        phase: str,
        progress: Dict[str, Any]
    ):
        """
        Notify clients of phase progress.

        Args:
            session_id: Session ID
            phase: Current phase (planning, searching, implementing)
            progress: Progress information
        """
        message = {
            "type": "phase-progress",
            "session_id": session_id,
            "phase": phase,
            "progress": progress,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_tool_generated(
        self,
        session_id: str,
        tool_name: str,
        tool_metadata: Dict[str, Any]
    ):
        """
        Notify clients when a tool is generated.

        Args:
            session_id: Session ID
            tool_name: Name of generated tool
            tool_metadata: Tool metadata
        """
        message = {
            "type": "tool-generated",
            "session_id": session_id,
            "tool_name": tool_name,
            "tool_metadata": tool_metadata,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_tool_registered(
        self,
        session_id: str,
        tool_name: str,
        endpoint: str,
        registration_status: str
    ):
        """
        Notify clients when a tool is registered with SimpleTooling.

        Args:
            session_id: Session ID
            tool_name: Name of registered tool
            endpoint: Tool endpoint URL
            registration_status: Registration status
        """
        message = {
            "type": "tool-registered",
            "session_id": session_id,
            "tool_name": tool_name,
            "endpoint": endpoint,
            "registration_status": registration_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_tool_executed(
        self,
        session_id: str,
        tool_name: str,
        execution_result: Dict[str, Any]
    ):
        """
        Notify clients when a tool is executed.

        Args:
            session_id: Session ID
            tool_name: Name of executed tool
            execution_result: Execution result
        """
        message = {
            "type": "tool-executed",
            "session_id": session_id,
            "tool_name": tool_name,
            "execution_result": execution_result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_error(
        self,
        session_id: str,
        error_type: str,
        error_message: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """
        Notify clients of an error.

        Args:
            session_id: Session ID
            error_type: Type of error
            error_message: Error message
            context: Additional error context
        """
        message = {
            "type": "error",
            "session_id": session_id,
            "error_type": error_type,
            "error_message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if context:
            message["context"] = context

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_workflow_completed(
        self,
        session_id: str,
        summary: Dict[str, Any]
    ):
        """
        Notify clients when workflow is completed.

        Args:
            session_id: Session ID
            summary: Workflow completion summary
        """
        message = {
            "type": "workflow-completed",
            "session_id": session_id,
            "summary": summary,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_search_progress(
        self,
        session_id: str,
        current_target: str,
        progress: Dict[str, Any]
    ):
        """
        Notify clients of search progress.

        Args:
            session_id: Session ID
            current_target: Current search target
            progress: Search progress information
        """
        message = {
            "type": "search-progress",
            "session_id": session_id,
            "current_target": current_target,
            "progress": progress,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def notify_implementation_progress(
        self,
        session_id: str,
        current_tool: str,
        progress: Dict[str, Any]
    ):
        """
        Notify clients of implementation progress.

        Args:
            session_id: Session ID
            current_tool: Current tool being implemented
            progress: Implementation progress information
        """
        message = {
            "type": "implementation-progress",
            "session_id": session_id,
            "current_tool": current_tool,
            "progress": progress,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def broadcast_service_status(
        self,
        service_name: str,
        status: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Broadcast service status to all clients.

        Args:
            service_name: Name of the service
            status: Service status
            details: Additional status details
        """
        message = {
            "type": "service-status",
            "service_name": service_name,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if details:
            message["details"] = details

        await self.websocket_manager.send_to_all(message)

    async def send_custom_event(
        self,
        session_id: str,
        event_type: str,
        data: Dict[str, Any]
    ):
        """
        Send custom event to session clients.

        Args:
            session_id: Session ID
            event_type: Custom event type
            data: Event data
        """
        message = {
            "type": "custom-event",
            "session_id": session_id,
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)

    async def send_debug_info(
        self,
        session_id: str,
        debug_type: str,
        debug_data: Dict[str, Any]
    ):
        """
        Send debug information to session clients.

        Args:
            session_id: Session ID
            debug_type: Type of debug information
            debug_data: Debug data
        """
        message = {
            "type": "debug-info",
            "session_id": session_id,
            "debug_type": debug_type,
            "debug_data": debug_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await self.websocket_manager.send_to_session(session_id, message)