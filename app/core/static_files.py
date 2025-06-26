import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


def setup_static_files(app: FastAPI) -> tuple[str | None, str | None]:
    """
    Setup static file serving for React app.

    Returns:
        tuple: (static_dir, html_dir) where static_dir is the static directory path
        and html_dir is the directory containing index.html
    """
    # Serve static files (React build)
    STATIC_DIR = os.environ.get("STATIC_DIR", "static")

    # Try multiple possible static directory locations for flexibility
    static_dirs = [
        STATIC_DIR,  # Environment variable or default "static"
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static"
        ),  # Development
        "/app/static",  # Docker container
        "static",  # Current directory fallback
    ]

    static_dir = None
    for dir_path in static_dirs:
        if os.path.exists(dir_path):
            static_dir = dir_path
            logger.info(f"✅ Found static directory: {static_dir}")
            break

    html_dir = None

    if static_dir:
        # Check for nested static directory (common in React builds)
        nested_static = os.path.join(static_dir, "static")
        if os.path.exists(nested_static):
            # Mount the nested static directory for assets
            app.mount("/static", StaticFiles(directory=nested_static), name="static")
            logger.info(f"✅ Serving static assets from: {nested_static}")
            # Use parent directory for index.html
            html_dir = static_dir
        else:
            # Mount the static directory directly
            app.mount("/static", StaticFiles(directory=static_dir), name="static")
            logger.info(f"✅ Serving static files from: {static_dir}")
            html_dir = static_dir

        @app.get("/")
        async def read_index():
            """Serve React app index.html for root path"""
            index_path = os.path.join(html_dir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
            return {"error": "React app index.html not found"}

    else:
        logger.warning("❌ No static directory found - React app will not be served")

        @app.get("/")
        async def api_root():
            return {
                "message": "Medical Records API",
                "docs": "/docs",
                "status": "React app not configured",
            }

    return static_dir, html_dir
