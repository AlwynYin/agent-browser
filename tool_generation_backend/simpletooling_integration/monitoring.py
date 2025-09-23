"""
Health monitoring for SimpleTooling service.
"""

import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import logging

from .client import SimpleToolingClient

logger = logging.getLogger(__name__)


class HealthMonitor:
    """Monitor SimpleTooling service health and availability."""

    def __init__(self, simpletooling_client: SimpleToolingClient, check_interval: int = 60):
        """
        Initialize health monitor.

        Args:
            simpletooling_client: SimpleTooling HTTP client
            check_interval: Health check interval in seconds
        """
        self.client = simpletooling_client
        self.check_interval = check_interval
        self.is_monitoring = False
        self.health_history: List[Dict[str, Any]] = []
        self.max_history = 100  # Keep last 100 health checks
        self._monitor_task: Optional[asyncio.Task] = None

    async def start_monitoring(self):
        """Start continuous health monitoring."""
        if self.is_monitoring:
            logger.warning("Health monitoring is already running")
            return

        self.is_monitoring = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info(f"Started SimpleTooling health monitoring (interval: {self.check_interval}s)")

    async def stop_monitoring(self):
        """Stop health monitoring."""
        if not self.is_monitoring:
            return

        self.is_monitoring = False

        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None

        logger.info("Stopped SimpleTooling health monitoring")

    async def _monitor_loop(self):
        """Main monitoring loop."""
        try:
            while self.is_monitoring:
                await self.check_health()
                await asyncio.sleep(self.check_interval)
        except asyncio.CancelledError:
            logger.info("Health monitoring cancelled")
        except Exception as e:
            logger.error(f"Health monitoring error: {e}")
            self.is_monitoring = False

    async def check_health(self) -> Dict[str, Any]:
        """
        Perform health check and store result.

        Returns:
            Dict[str, Any]: Health check result
        """
        health_result = await self.client.health_check()

        # Add timestamp if not present
        if "timestamp" not in health_result:
            health_result["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Store in history
        self.health_history.append(health_result)

        # Limit history size
        if len(self.health_history) > self.max_history:
            self.health_history = self.health_history[-self.max_history:]

        # Log health status changes
        if len(self.health_history) > 1:
            prev_status = self.health_history[-2]["status"]
            curr_status = health_result["status"]

            if prev_status != curr_status:
                if curr_status == "healthy":
                    logger.info("SimpleTooling service is now healthy")
                else:
                    logger.warning(f"SimpleTooling service status changed: {prev_status} -> {curr_status}")

        return health_result

    def get_current_status(self) -> Dict[str, Any]:
        """
        Get current health status.

        Returns:
            Dict[str, Any]: Current health status
        """
        if not self.health_history:
            return {
                "status": "unknown",
                "message": "No health checks performed yet"
            }

        return self.health_history[-1]

    def get_health_summary(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get health summary for the specified time period.

        Args:
            hours: Number of hours to analyze

        Returns:
            Dict[str, Any]: Health summary
        """
        if not self.health_history:
            return {
                "status": "no_data",
                "message": "No health check data available"
            }

        # Filter recent health checks
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_checks = []

        for check in self.health_history:
            try:
                check_time = datetime.fromisoformat(check["timestamp"].replace('Z', '+00:00'))
                if check_time >= cutoff_time:
                    recent_checks.append(check)
            except (KeyError, ValueError):
                continue

        if not recent_checks:
            return {
                "status": "no_recent_data",
                "message": f"No health check data in the last {hours} hours"
            }

        # Calculate statistics
        total_checks = len(recent_checks)
        healthy_checks = sum(1 for check in recent_checks if check["status"] == "healthy")
        unhealthy_checks = sum(1 for check in recent_checks if check["status"] == "unhealthy")
        error_checks = sum(1 for check in recent_checks if check["status"] == "error")

        uptime_percentage = (healthy_checks / total_checks) * 100 if total_checks > 0 else 0

        # Calculate average response time for healthy checks
        response_times = [
            check.get("response_time_ms", 0)
            for check in recent_checks
            if check["status"] == "healthy" and "response_time_ms" in check
        ]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0

        # Get recent status changes
        status_changes = []
        for i in range(1, len(recent_checks)):
            prev_status = recent_checks[i-1]["status"]
            curr_status = recent_checks[i]["status"]

            if prev_status != curr_status:
                status_changes.append({
                    "timestamp": recent_checks[i]["timestamp"],
                    "from_status": prev_status,
                    "to_status": curr_status
                })

        return {
            "period_hours": hours,
            "total_checks": total_checks,
            "healthy_checks": healthy_checks,
            "unhealthy_checks": unhealthy_checks,
            "error_checks": error_checks,
            "uptime_percentage": round(uptime_percentage, 2),
            "average_response_time_ms": round(avg_response_time, 2),
            "current_status": recent_checks[-1]["status"],
            "status_changes": status_changes[-10:],  # Last 10 status changes
            "last_check": recent_checks[-1]["timestamp"]
        }

    def is_healthy(self) -> bool:
        """
        Check if service is currently healthy.

        Returns:
            bool: True if service is healthy
        """
        current_status = self.get_current_status()
        return current_status.get("status") == "healthy"

    async def wait_for_healthy(self, timeout_seconds: int = 300) -> bool:
        """
        Wait for service to become healthy.

        Args:
            timeout_seconds: Maximum time to wait

        Returns:
            bool: True if service became healthy within timeout
        """
        start_time = datetime.now(timezone.utc)
        timeout_time = start_time + timedelta(seconds=timeout_seconds)

        logger.info(f"Waiting for SimpleTooling service to become healthy (timeout: {timeout_seconds}s)")

        while datetime.now(timezone.utc) < timeout_time:
            health_result = await self.check_health()

            if health_result["status"] == "healthy":
                elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                logger.info(f"SimpleTooling service is healthy (waited {elapsed:.1f}s)")
                return True

            # Wait before next check
            await asyncio.sleep(min(10, self.check_interval))

        logger.warning(f"SimpleTooling service did not become healthy within {timeout_seconds}s")
        return False

    def get_health_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get health check history.

        Args:
            limit: Maximum number of recent checks to return

        Returns:
            List[Dict[str, Any]]: Health check history
        """
        if limit is None:
            return self.health_history.copy()

        return self.health_history[-limit:] if limit > 0 else []

    def clear_history(self):
        """Clear health check history."""
        self.health_history.clear()
        logger.info("Cleared health check history")

    async def get_service_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive service metrics.

        Returns:
            Dict[str, Any]: Service metrics
        """
        try:
            # Get basic health info
            health_status = await self.check_health()

            # Get service info
            service_info = await self.client.get_service_info()

            # Get available tools
            tools = await self.client.list_tools()

            # Get tool endpoints
            endpoints = await self.client.get_tool_endpoints()

            return {
                "health_status": health_status,
                "service_info": service_info,
                "tools_count": len(tools),
                "endpoints_count": len(endpoints),
                "tools": tools[:10],  # First 10 tools
                "endpoints": endpoints,
                "monitoring_active": self.is_monitoring,
                "history_size": len(self.health_history),
                "last_check": self.health_history[-1]["timestamp"] if self.health_history else None
            }

        except Exception as e:
            logger.error(f"Failed to get service metrics: {e}")
            return {
                "error": str(e),
                "monitoring_active": self.is_monitoring,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }