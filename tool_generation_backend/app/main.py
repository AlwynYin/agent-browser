"""
FastAPI application entry point for agent-browser backend.
Chemistry computation tool generation platform.
"""

from contextlib import asynccontextmanager
import logging
from typing import Dict, Any

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_database
from app.api.health import router as health_router
from app.api.sessions import router as sessions_router
from app.api.jobs import router as jobs_router
from app.websocket.manager import WebSocketManager
from app.middleware.logging import setup_logging_middleware
from simpletooling_integration import SimpleToolingClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    settings = get_settings()
    logging.info("🚀 Starting agent-browser backend...")
    logging.info(f"📊 Environment: {settings.environment}")
    logging.info(f"🌐 Port: {settings.port}")

    # Initialize database connection
    await init_database(settings.mongodb_url)
    logging.info("✅ Database connection established")

    # Initialize SimpleTooling integration
    app.state.simpletooling = SimpleToolingClient(
        base_url=settings.simpletooling_url
    )
    logging.info(f"🔧 SimpleTooling client initialized: {settings.simpletooling_url}")

    # Initialize WebSocket manager
    app.state.websocket_manager = WebSocketManager()
    logging.info("🔌 WebSocket manager initialized")

    yield

    # Shutdown
    logging.info("🛑 Shutting down agent-browser backend...")
    if hasattr(app.state, 'simpletooling'):
        await app.state.simpletooling.close()
        logging.info("🔧 SimpleTooling client closed")


# Create FastAPI application
app = FastAPI(
    title="Agent Browser Backend",
    description="Chemistry computation tool generation platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Setup CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup logging middleware
setup_logging_middleware(app)

# Include API routers
app.include_router(health_router, prefix="/api/v1", tags=["health"])
app.include_router(sessions_router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(jobs_router, prefix="/api/v1/jobs", tags=["jobs"])


@app.get("/")
async def root() -> Dict[str, Any]:
    """Root endpoint with basic service information."""
    return {
        "service": "agent-browser-backend",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
        "websocket": "/ws/{session_id}",
        "simpletooling": get_settings().simpletooling_url
    }


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time session updates."""
    websocket_manager = app.state.websocket_manager
    await websocket_manager.connect(websocket, session_id)


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level=settings.log_level.lower()
    )