"""
Health check endpoints for monitoring service status and dependencies.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import ping_database, get_database_stats
from app.config import get_settings


router = APIRouter()


class HealthResponse(BaseModel):
    """Basic health check response."""

    status: str
    timestamp: str
    version: str
    environment: str


class DetailedHealthResponse(BaseModel):
    """Detailed health check response with dependency status."""

    status: str
    timestamp: str
    version: str
    environment: str
    dependencies: Dict[str, Any]
    database: Dict[str, Any]


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Basic health check endpoint.

    Returns:
        Basic service health information
    """
    settings = get_settings()

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="2.0.0",
        environment=settings.environment
    )


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health_check() -> DetailedHealthResponse:
    """
    Detailed health check endpoint with dependency status.

    Returns:
        Detailed service health including dependency status

    Raises:
        HTTPException: If critical dependencies are unavailable
    """
    settings = get_settings()
    timestamp = datetime.now(timezone.utc).isoformat()

    # Check database connectivity
    database_healthy = await ping_database()
    database_stats = await get_database_stats() if database_healthy else {}

    # Check configuration requirements
    config_status = _check_configuration_status(settings)

    # Determine overall health status
    overall_status = "healthy"
    if not database_healthy:
        overall_status = "unhealthy"
        logging.error("Health check failed: Database unavailable")
    elif not config_status["valid"]:
        overall_status = "degraded"
        logging.warning("Health check warning: Configuration issues detected")

    dependencies = {
        "database": {
            "status": "healthy" if database_healthy else "unhealthy",
            "connected": database_healthy,
            "last_check": timestamp
        },
        "configuration": config_status,
        "external_services": {
            "openai": {
                "configured": bool(settings.openai_api_key),
                "model": settings.openai_model
            },
            "browser_service": {
                "mode": settings.browser_service_mode,
                "configured": (
                    settings.browser_service_mode != "cloud" or
                    bool(settings.browser_use_api_key)
                )
            },
            "python_execution": {
                "url": settings.python_execution_api_url,
                "configured": bool(settings.python_execution_api_url)
            },
            "simpletooling": {
                "url": settings.simpletooling_url,
                "configured": bool(settings.simpletooling_url)
            }
        }
    }

    response = DetailedHealthResponse(
        status=overall_status,
        timestamp=timestamp,
        version="2.0.0",
        environment=settings.environment,
        dependencies=dependencies,
        database=database_stats
    )

    # Return appropriate HTTP status
    if overall_status == "unhealthy":
        raise HTTPException(status_code=503, detail=response.model_dump())

    return response


def _check_configuration_status(settings) -> Dict[str, Any]:
    """
    Check configuration validity and completeness.

    Args:
        settings: Application settings

    Returns:
        Configuration status information
    """
    issues = []
    warnings = []

    # Check required configuration
    if not settings.openai_api_key:
        issues.append("OPENAI_API_KEY is not configured")

    if not settings.mongodb_url:
        issues.append("MONGODB_URL is not configured")

    # Check conditional requirements
    if settings.browser_service_mode == "cloud" and not settings.browser_use_api_key:
        issues.append(
            "BROWSER_USE_API_KEY is required when BROWSER_SERVICE_MODE=cloud"
        )

    # Check optional but recommended configuration
    if not settings.python_execution_api_key:
        warnings.append("PYTHON_EXECUTION_API_KEY is not configured")

    # Validate environment values
    valid_environments = {"development", "production", "test"}
    if settings.environment not in valid_environments:
        issues.append(f"Invalid ENVIRONMENT value: {settings.environment}")

    valid_browser_modes = {"cloud", "local", "mock"}
    if settings.browser_service_mode not in valid_browser_modes:
        issues.append(f"Invalid BROWSER_SERVICE_MODE value: {settings.browser_service_mode}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "total_issues": len(issues),
        "total_warnings": len(warnings)
    }


@router.get("/health/database")
async def database_health_check() -> Dict[str, Any]:
    """
    Database-specific health check endpoint.

    Returns:
        Database connectivity and statistics
    """
    is_connected = await ping_database()
    stats = await get_database_stats() if is_connected else {}

    return {
        "connected": is_connected,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "statistics": stats
    }