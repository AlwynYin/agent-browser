"""
FastAPI application entry point for agent-browser backend.
Chemistry computation tool generation platform.
"""

from contextlib import asynccontextmanager
import logging
import subprocess
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


def authenticate_codex(api_key: str) -> bool:
    """Authenticate Codex CLI with OpenAI API key."""
    try:
        logging.info("🔍 Checking for Codex CLI installation...")

        # Check if codex is available
        which_result = subprocess.run(['which', 'codex'], capture_output=True, text=True)
        if which_result.returncode != 0:
            logging.error("❌ Codex CLI not found in PATH")
            logging.error(f"   which stdout: {which_result.stdout}")
            logging.error(f"   which stderr: {which_result.stderr}")

            # Try to find codex in common locations
            import os
            common_paths = ['/usr/local/bin/codex', '/usr/bin/codex', '/bin/codex']
            for path in common_paths:
                if os.path.exists(path):
                    logging.info(f"🔍 Found codex at: {path}")
                    break
            else:
                logging.error("❌ Codex not found in common locations")
            return False

        codex_path = which_result.stdout.strip()
        logging.info(f"✅ Found Codex CLI at: {codex_path}")

        # Check codex version first
        logging.info("🔍 Checking Codex CLI version...")
        version_result = subprocess.run([codex_path, '--version'], capture_output=True, text=True, timeout=10)
        if version_result.returncode == 0:
            logging.info(f"📋 Codex version: {version_result.stdout.strip()}")
        else:
            logging.warning(f"⚠️ Could not get Codex version: {version_result.stderr}")

        # Authenticate with API key
        logging.info("🔐 Authenticating Codex CLI with OpenAI API key...")
        logging.info(api_key[:20])
        auth_result = subprocess.run(
            [codex_path, 'login', '--api-key', api_key],
            capture_output=True,
            text=True,
            timeout=30
        )

        logging.info(f"🔍 Auth command exit code: {auth_result.returncode}")
        if auth_result.stdout:
            logging.info(f"🔍 Auth stdout: {auth_result.stdout}")
        if auth_result.stderr:
            logging.info(f"🔍 Auth stderr: {auth_result.stderr}")

        if auth_result.returncode == 0:
            logging.info("✅ Codex CLI authenticated successfully")

            # Verify authentication by checking login status
            logging.info("🔍 Verifying authentication...")
            status_result = subprocess.run(
                [codex_path, 'login', 'status'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if status_result.returncode == 0:
                logging.info(f"✅ Auth verification: {status_result.stdout.strip()}")
            else:
                logging.warning(f"⚠️ Auth verification failed: {status_result.stderr}")

            return True
        else:
            logging.error(f"❌ Codex authentication failed with exit code {auth_result.returncode}")
            logging.error(f"   stderr: {auth_result.stderr}")
            logging.error(f"   stdout: {auth_result.stdout}")
            return False

    except subprocess.TimeoutExpired:
        logging.error("❌ Codex authentication timed out")
        return False
    except Exception as e:
        logging.error(f"❌ Codex authentication error: {e}")
        import traceback
        logging.error(f"   traceback: {traceback.format_exc()}")
        return False


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

    # Authenticate Codex CLI
    if settings.openai_api_key:
        codex_auth_success = authenticate_codex(settings.openai_api_key)
        if not codex_auth_success:
            logging.warning("⚠️ Codex authentication failed - tool generation may not work")
    else:
        logging.warning("⚠️ No OpenAI API key provided - Codex authentication skipped")

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