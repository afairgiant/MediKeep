import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


def setup_spa_routing(app: FastAPI, static_dir: str | None, html_dir: str | None):
    """
    Setup SPA routing only when React build files exist (production).
    This avoids conflicts during development.

    Args:
        app: FastAPI application instance
        static_dir: Path to static directory
        html_dir: Path to directory containing index.html
    """
    if not static_dir:
        logger.info("🔧 Development mode - No static directory, SPA routing disabled")
        return

    if not html_dir:
        logger.info("🔧 Development mode - No HTML directory, SPA routing disabled")
        return

    index_path = os.path.join(html_dir, "index.html")
    if not os.path.exists(index_path):
        logger.info("🔧 Development mode - No index.html found, SPA routing disabled")
        return

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve React SPA for non-API routes in production only.
        This route is only created when React build files exist.
        """
        # For API routes, let them fall through to be handled by FastAPI endpoints
        # Don't serve React app for API routes - this is critical for proper API functionality
        if (
            full_path.startswith("api/")
            or full_path.startswith("api")
            or full_path == "api"
            or full_path.startswith("api/v1/")
        ):
            # Return a 404 to let FastAPI handle the routing properly
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # Block special FastAPI routes
        if full_path in ["docs", "redoc", "openapi.json", "health"]:
            raise HTTPException(status_code=404, detail="Route not found")

        # Serve React app for all other routes (SPA routing)
        return FileResponse(index_path)

        logger.info("Production mode - SPA routing enabled for React Router")
