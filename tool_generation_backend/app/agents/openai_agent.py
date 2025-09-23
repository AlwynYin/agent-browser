"""
OpenAI Agent SDK integration for chemistry tool generation.

This module implements a singleton AgentManager that uses OpenAI's Assistant API
with custom tools for browsing documentation and implementing chemistry tools.
"""

import json
import logging
import threading
import asyncio
from typing import Dict, Optional, Any, List
from openai import OpenAI
from pathlib import Path

from app.utils.codex_utils import (
    execute_codex_implement,
    execute_codex_browse
)

logger = logging.getLogger(__name__)


class AgentManager:
    """
    Singleton manager for OpenAI Agent SDK integration.

    Manages a single OpenAI Assistant instance with chemistry-focused tools
    and maintains thread-based session isolation.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not getattr(self, '_initialized', False):
            self.client = None  # Initialize lazily
            self.assistant = None
            self.active_threads: Dict[str, str] = {}  # session_id -> thread_id
            self._client_initialized = False
            self._initialized = True

    def _ensure_client(self):
        """Ensure OpenAI client is initialized (lazy initialization)."""
        if not self._client_initialized:
            from app.config import get_settings
            settings = get_settings()
            self.client = OpenAI(api_key=settings.openai_api_key)
            self._initialize_assistant()
            self._client_initialized = True

    def _initialize_assistant(self):
        """Initialize the OpenAI Assistant with chemistry tools."""
        try:
            self.assistant = self.client.beta.assistants.create(
                name="Chemistry Tool Generator",
                instructions=self._get_system_instructions(),
                model="gpt-4-turbo",
                tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "browse_documentation",
                            "description": "Browse and search documentation in chemistry libraries",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "library": {
                                        "type": "string",
                                        "description": "Chemistry library to browse (rdkit, ase, pymatgen, pyscf)"
                                    },
                                    "query": {
                                        "type": "string",
                                        "description": "Specific functionality to search for"
                                    }
                                },
                                "required": ["library", "query"]
                            }
                        }
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "implement_tool",
                            "description": "Generate a Python tool using Codex",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "tool_name": {
                                        "type": "string",
                                        "description": "Name of the tool to implement"
                                    },
                                    "requirements": {
                                        "type": "array",
                                        "description": "List of requirement specifications for each function",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "name": {"type": "string"},
                                                "description": {"type": "string"},
                                                "params": {"type": "array", "items": {"type": "object"}},
                                                "returns": {"type": "object"}
                                            }
                                        }
                                    }
                                },
                                "required": ["tool_name", "requirements"]
                            }
                        }
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "test_tool",
                            "description": "Test a generated tool (future implementation)",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "tool_path": {
                                        "type": "string",
                                        "description": "Path to the tool file"
                                    }
                                },
                                "required": ["tool_path"]
                            }
                        }
                    }
                ]
            )
            logger.info(f"Created OpenAI Assistant: {self.assistant.id}")
        except Exception as e:
            logger.error(f"Failed to create OpenAI Assistant: {e}")
            raise

    def _get_system_instructions(self) -> str:
        """Get the system instructions for the assistant."""
        return """
You are a specialized chemistry tool generator assistant. Your role is to:

1. Analyze user requirements for chemistry computation tools
2. Browse documentation for chemistry libraries (RDKit, ASE, PyMatGen, PySCF)
3. Generate production-ready Python tools that integrate with SimpleTooling

Key Guidelines:
- Always start by browsing documentation to understand available APIs
- Generate tools that use the @toolset.add() decorator pattern
- Focus on chemistry-specific computations (molecular properties, crystal structures, etc.)
- Include proper error handling and type hints
- Ensure tools are self-contained and well-documented

When implementing tools:
1. Use browse_documentation to find relevant APIs
2. Use implement_tool to generate the Python code
3. Tools should be saved to the configured tools directory
4. Include metadata for tool registration

You work with OpenAI conversation threads for context preservation.
"""

    async def get_or_create_thread(self, session_id: str) -> str:
        """
        Get existing thread or create new one for session.

        Args:
            session_id: Session identifier

        Returns:
            Thread ID
        """
        self._ensure_client()  # Lazy initialization

        if session_id in self.active_threads:
            return self.active_threads[session_id]

        # Create new thread
        thread = self.client.beta.threads.create()
        self.active_threads[session_id] = thread.id

        logger.info(f"Created thread {thread.id} for session {session_id}")
        return thread.id

    async def process_requirement(
        self,
        session_id: str,
        requirement: str,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Process a tool requirement using the assistant.

        Args:
            session_id: Session identifier
            requirement: Tool requirement description
            progress_callback: Optional callback for progress updates

        Returns:
            Processing result
        """
        try:
            # Get thread for this session
            thread_id = await self.get_or_create_thread(session_id)

            # Create message in thread
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=f"Create a chemistry tool based on this requirement: {requirement}"
            )

            # Start run
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=self.assistant.id
            )

            # Poll for completion and handle tool calls
            result = await self._handle_run_completion(thread_id, run.id, session_id, progress_callback)

            logger.info(f"Completed processing for session {session_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to process requirement for session {session_id}: {e}")
            return {
                "success": False,
                "session_id": session_id,
                "error": str(e)
            }

    async def _handle_run_completion(
        self,
        thread_id: str,
        run_id: str,
        session_id: str,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """Handle run completion and tool calls."""
        try:
            while True:
                # Check run status
                run = self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run_id
                )

                if progress_callback:
                    await progress_callback({
                        "status": run.status,
                        "session_id": session_id
                    })

                if run.status == "completed":
                    # Get messages
                    messages = self.client.beta.threads.messages.list(
                        thread_id=thread_id,
                        order="asc"
                    )

                    return {
                        "success": True,
                        "session_id": session_id,
                        "messages": [msg.content[0].text.value for msg in messages.data if msg.role == "assistant"],
                        "run_id": run_id
                    }

                elif run.status == "requires_action":
                    # Handle tool calls
                    tool_calls = run.required_action.submit_tool_outputs.tool_calls
                    tool_outputs = []

                    for tool_call in tool_calls:
                        output = await self._execute_tool_call(tool_call, session_id)
                        tool_outputs.append({
                            "tool_call_id": tool_call.id,
                            "output": json.dumps(output)
                        })

                    # Submit tool outputs
                    self.client.beta.threads.runs.submit_tool_outputs(
                        thread_id=thread_id,
                        run_id=run_id,
                        tool_outputs=tool_outputs
                    )

                elif run.status in ["failed", "cancelled", "expired"]:
                    return {
                        "success": False,
                        "session_id": session_id,
                        "error": f"Run {run.status}: {run.last_error.message if run.last_error else 'Unknown error'}"
                    }

                # Wait before checking again
                await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"Error handling run completion: {e}")
            return {
                "success": False,
                "session_id": session_id,
                "error": str(e)
            }

    async def _execute_tool_call(self, tool_call, session_id: str) -> Dict[str, Any]:
        """Execute a tool call."""
        try:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            logger.info(f"Executing tool call: {function_name} for session {session_id}")

            if function_name == "browse_documentation":
                return await self._handle_browse_documentation(arguments)
            elif function_name == "implement_tool":
                return await self._handle_implement_tool(arguments)
            elif function_name == "test_tool":
                return await self._handle_test_tool(arguments)
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool function: {function_name}"
                }

        except Exception as e:
            logger.error(f"Error executing tool call: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _handle_browse_documentation(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handle browse_documentation tool call."""
        library = arguments.get("library")
        query = arguments.get("query")

        # Use codex to browse documentation
        result = await execute_codex_browse(library, query)
        return result

    async def _handle_implement_tool(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handle implement_tool tool call."""
        tool_name = arguments.get("tool_name")
        requirements = arguments.get("requirements", [])

        # Use codex to implement the tool
        result = await execute_codex_implement(tool_name, requirements)
        return result

    async def _handle_test_tool(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handle test_tool tool call (future implementation)."""
        return {
            "success": True,
            "message": "Tool testing not yet implemented"
        }

    async def cleanup_session(self, session_id: str):
        """Clean up resources for a session."""
        try:
            # Clean up OpenAI thread
            if session_id in self.active_threads:
                # Note: OpenAI doesn't provide thread deletion API
                del self.active_threads[session_id]

            logger.info(f"Cleaned up session {session_id}")

        except Exception as e:
            logger.error(f"Error cleaning up session {session_id}: {e}")

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get status information for a session."""
        return {
            "session_id": session_id,
            "has_thread": session_id in self.active_threads,
            "thread_id": self.active_threads.get(session_id),
            "assistant_id": self.assistant.id if self.assistant else None
        }


# Global instance
agent_manager = AgentManager()