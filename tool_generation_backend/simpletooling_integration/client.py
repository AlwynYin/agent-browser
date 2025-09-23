"""
HTTP client for SimpleTooling service communication.
"""

import httpx
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
import asyncio
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class SimpleToolingClient:
    """HTTP client for communicating with SimpleTooling service."""

    def __init__(self, base_url: str, timeout: int = 30):
        """
        Initialize SimpleTooling client.

        Args:
            base_url: SimpleTooling service base URL
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get HTTP client, creating if needed."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True
            )
        return self._client

    async def close(self):
        """Close HTTP client connection."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def health_check(self) -> Dict[str, Any]:
        """
        Check SimpleTooling service health.

        Returns:
            Dict[str, Any]: Health status information
        """
        try:
            response = await self.client.get(f"{self.base_url}/health")

            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "url": self.base_url,
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                return {
                    "status": "unhealthy",
                    "url": self.base_url,
                    "status_code": response.status_code,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

        except Exception as e:
            logger.error(f"SimpleTooling health check failed: {e}")
            return {
                "status": "error",
                "url": self.base_url,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def load_tool_file(self, file_path: str) -> Dict[str, Any]:
        """
        Load a single tool file into SimpleTooling.

        Args:
            file_path: Path to tool file to load

        Returns:
            Dict[str, Any]: Loading result
        """
        try:
            # Check if file exists
            path = Path(file_path)
            if not path.exists():
                return {
                    "status": "error",
                    "error": f"Tool file not found: {file_path}"
                }

            # Send load request to SimpleTooling
            response = await self.client.post(
                f"{self.base_url}/load_tool_file",
                json={"file_path": str(path.absolute())}
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(f"Successfully loaded tool file: {file_path}")
                return {
                    "status": "success",
                    "file_path": file_path,
                    "result": result,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                error_msg = f"Failed to load tool file: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"

                logger.error(error_msg)
                return {
                    "status": "error",
                    "error": error_msg,
                    "file_path": file_path
                }

        except httpx.TimeoutException:
            error_msg = f"Timeout loading tool file: {file_path}"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg}

        except Exception as e:
            error_msg = f"Failed to load tool file {file_path}: {e}"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg}

    async def scan_new_tools(self) -> Dict[str, Any]:
        """
        Scan for and load new tools in the tools directory.

        Returns:
            Dict[str, Any]: Scanning result
        """
        try:
            response = await self.client.post(f"{self.base_url}/scan_new_tools")

            if response.status_code == 200:
                result = response.json()
                logger.info("Successfully scanned for new tools")
                return {
                    "status": "success",
                    "result": result,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                error_msg = f"Failed to scan new tools: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"

                logger.error(error_msg)
                return {"status": "error", "error": error_msg}

        except Exception as e:
            error_msg = f"Failed to scan new tools: {e}"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg}

    async def get_tool_endpoints(self) -> List[str]:
        """
        Get list of available tool endpoints.

        Returns:
            List[str]: Available tool endpoint URLs
        """
        try:
            # Get OpenAPI specification
            response = await self.client.get(f"{self.base_url}/openapi.json")

            if response.status_code != 200:
                logger.error(f"Failed to get OpenAPI spec: HTTP {response.status_code}")
                return []

            spec = response.json()
            endpoints = []

            # Extract tool endpoints from OpenAPI spec
            for path in spec.get("paths", {}):
                if path.startswith("/tool/"):
                    endpoints.append(f"{self.base_url}{path}")

            logger.info(f"Found {len(endpoints)} tool endpoints")
            return endpoints

        except Exception as e:
            logger.error(f"Failed to get tool endpoints: {e}")
            return []

    async def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get schema for a specific tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Optional[Dict[str, Any]]: Tool schema or None if not found
        """
        try:
            response = await self.client.get(f"{self.base_url}/schema/{tool_name}")

            if response.status_code == 200:
                schema = response.json()
                logger.info(f"Retrieved schema for tool: {tool_name}")
                return schema
            elif response.status_code == 404:
                logger.warning(f"Tool not found: {tool_name}")
                return None
            else:
                logger.error(f"Failed to get tool schema for {tool_name}: HTTP {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Failed to get tool schema for {tool_name}: {e}")
            return None

    async def execute_tool(self, tool_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool with given inputs.

        Args:
            tool_name: Name of the tool to execute
            inputs: Input parameters for the tool

        Returns:
            Dict[str, Any]: Execution result
        """
        try:
            start_time = datetime.now(timezone.utc)

            response = await self.client.post(
                f"{self.base_url}/tool/{tool_name}",
                json=inputs
            )

            end_time = datetime.now(timezone.utc)
            execution_time_ms = (end_time - start_time).total_seconds() * 1000

            if response.status_code == 200:
                result = response.json()
                logger.info(f"Successfully executed tool: {tool_name}")
                return {
                    "status": "success",
                    "tool_name": tool_name,
                    "inputs": inputs,
                    "outputs": result,
                    "execution_time_ms": execution_time_ms,
                    "timestamp": end_time.isoformat()
                }
            else:
                error_msg = f"Tool execution failed: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"

                logger.error(f"Tool execution failed for {tool_name}: {error_msg}")
                return {
                    "status": "error",
                    "tool_name": tool_name,
                    "inputs": inputs,
                    "error": error_msg,
                    "execution_time_ms": execution_time_ms,
                    "timestamp": end_time.isoformat()
                }

        except Exception as e:
            error_msg = f"Failed to execute tool {tool_name}: {e}"
            logger.error(error_msg)
            return {
                "status": "error",
                "tool_name": tool_name,
                "inputs": inputs,
                "error": error_msg
            }

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        Get list of available tools.

        Returns:
            List[Dict[str, Any]]: Available tools with metadata
        """
        try:
            # Get OpenAPI specification
            response = await self.client.get(f"{self.base_url}/openapi.json")

            if response.status_code != 200:
                logger.error(f"Failed to get OpenAPI spec: HTTP {response.status_code}")
                return []

            spec = response.json()
            tools = []

            # Extract tool information from OpenAPI spec
            for path, path_spec in spec.get("paths", {}).items():
                if path.startswith("/tool/"):
                    tool_name = path.replace("/tool/", "")

                    # Get POST method details (tool execution endpoint)
                    post_spec = path_spec.get("post", {})

                    tool_info = {
                        "name": tool_name,
                        "endpoint": f"{self.base_url}{path}",
                        "description": post_spec.get("summary", ""),
                        "parameters": post_spec.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {}),
                        "responses": post_spec.get("responses", {})
                    }

                    tools.append(tool_info)

            logger.info(f"Found {len(tools)} available tools")
            return tools

        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            return []

    async def reload_all_tools(self) -> Dict[str, Any]:
        """
        Reload all tools in SimpleTooling service.

        Returns:
            Dict[str, Any]: Reload result
        """
        try:
            response = await self.client.post(f"{self.base_url}/reload_tools")

            if response.status_code == 200:
                result = response.json()
                logger.info("Successfully reloaded all tools")
                return {
                    "status": "success",
                    "result": result,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                error_msg = f"Failed to reload tools: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text}"

                logger.error(error_msg)
                return {"status": "error", "error": error_msg}

        except Exception as e:
            error_msg = f"Failed to reload tools: {e}"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg}

    async def get_service_info(self) -> Dict[str, Any]:
        """
        Get SimpleTooling service information.

        Returns:
            Dict[str, Any]: Service information
        """
        try:
            response = await self.client.get(f"{self.base_url}/")

            if response.status_code == 200:
                info = response.json()
                logger.info("Retrieved SimpleTooling service info")
                return info
            else:
                logger.error(f"Failed to get service info: HTTP {response.status_code}")
                return {}

        except Exception as e:
            logger.error(f"Failed to get service info: {e}")
            return {}