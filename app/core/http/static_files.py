import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")


class CachedStaticFiles(StaticFiles):
    """StaticFiles subclass that injects a Cache-Control header into every response."""

    def __init__(self, *, directory: str, cache_control: str) -> None:
        self._cache_control = cache_control
        super().__init__(directory=directory)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_with_cache(message):
            if message["type"] == "http.response.start":
                headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() != b"cache-control"
                ]
                headers.append((b"cache-control", self._cache_control.encode()))
                message["headers"] = headers
            await send(message)

        await super().__call__(scope, receive, send_with_cache)


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

    # Windows EXE: Check for bundled frontend
    try:
        import sys
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            # Running as PyInstaller bundle
            exe_frontend_build = os.path.join(sys._MEIPASS, 'frontend', 'build')
            static_dirs.insert(0, exe_frontend_build)  # Highest priority
            logger.info(f"Windows EXE mode: Checking frontend path: {exe_frontend_build}")
            logger.info(f"sys._MEIPASS = {sys._MEIPASS}")
            logger.info(f"Frontend path exists: {os.path.exists(exe_frontend_build)}")
            if os.path.exists(exe_frontend_build):
                logger.info(f"Frontend directory contents: {os.listdir(exe_frontend_build)}")
    except Exception as e:
        logger.error(f"Error checking Windows EXE frontend: {e}")

    static_dir = None
    for dir_path in static_dirs:
        if os.path.exists(dir_path):
            static_dir = dir_path
            logger.info(f"Found static directory: {static_dir}")
            break

    html_dir = None

    if static_dir:
        # Mount the entire build directory at root level for Vite compatibility
        # Vite generates index.html with references like /assets/xxx.js
        assets_dir = os.path.join(static_dir, "assets")
        if os.path.exists(assets_dir):
            app.mount(
                "/assets",
                CachedStaticFiles(
                    directory=assets_dir,
                    cache_control="public, max-age=31536000, immutable",
                ),
                name="assets",
            )
            logger.info(f"Serving Vite assets from: {assets_dir}")

        # Mount locales directory for i18n
        locales_dir = os.path.join(static_dir, "locales")
        if os.path.exists(locales_dir):
            app.mount(
                "/locales",
                CachedStaticFiles(
                    directory=locales_dir,
                    cache_control="public, max-age=3600",
                ),
                name="locales",
            )
            logger.info(f"Serving i18n locales from: {locales_dir}")

        # Also mount at /static for backward compatibility
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
        logger.info(f"Serving static files from: {static_dir}")
        html_dir = static_dir


        @app.get("/")
        async def read_index():
            """Serve React app index.html for root path"""
            index_path = os.path.join(html_dir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(
                    index_path,
                    headers={"Cache-Control": "no-cache"},
                )
            return {"error": "React app index.html not found"}

        @app.get("/manifest.json")
        async def read_manifest():
            """Serve PWA manifest.json"""
            manifest_path = os.path.join(html_dir, "manifest.json")
            if os.path.exists(manifest_path):
                return FileResponse(
                    manifest_path,
                    media_type="application/json",
                    headers={"Cache-Control": "no-cache"},
                )
            return {"error": "manifest.json not found"}

        @app.get("/service-worker.js")
        async def read_service_worker():
            """Serve PWA service worker"""
            sw_path = os.path.join(html_dir, "service-worker.js")
            if os.path.exists(sw_path):
                return FileResponse(
                    sw_path,
                    media_type="application/javascript",
                    headers={"Cache-Control": "no-cache, no-store"},
                )
            return {"error": "service-worker.js not found"}

        @app.get("/icon-256.png")
        async def read_icon_256():
            """Serve PWA icon 256x250"""
            icon_path = os.path.join(html_dir, "icon-256.png")
            if os.path.exists(icon_path):
                return FileResponse(
                    icon_path,
                    media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"},
                )
            return {"error": "icon-256.png not found"}

        @app.get("/icon-192.png")
        async def read_icon_192():
            """Serve PWA icon 192x192"""
            icon_path = os.path.join(html_dir, "icon-192.png")
            if os.path.exists(icon_path):
                return FileResponse(
                    icon_path,
                    media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"},
                )
            return {"error": "icon-192.png not found"}

        @app.get("/offline.html")
        async def read_offline():
            """Serve offline fallback page"""
            offline_path = os.path.join(html_dir, "offline.html")
            if os.path.exists(offline_path):
                return FileResponse(
                    offline_path,
                    media_type="text/html",
                    headers={"Cache-Control": "no-cache"},
                )
            return {"error": "offline.html not found"}

        # Catch-all route for React Router (must be last)
        @app.get("/{full_path:path}")
        async def serve_react_app(full_path: str):
            """
            Serve React app for all other routes (client-side routing).
            This must be the last route to avoid conflicts with API routes.

            Static files in the build root (SVGs, favicons, etc.) are served
            directly with proper MIME types. All other paths get index.html
            for React Router client-side routing.
            """
            # If path starts with /api, let it fall through to API routes
            if full_path.startswith("api/"):
                return {"error": "API endpoint not found"}

            # Serve root-level static files (SVGs, favicons, etc.) directly.
            # Only single-segment names with no path separators are considered,
            # and the name must match an actual file already in the build dir.
            if (
                full_path
                and "/" not in full_path
                and "\\" not in full_path
                and ".." not in full_path
                and not os.path.isabs(full_path)
                and full_path in os.listdir(html_dir)
            ):
                return FileResponse(os.path.join(html_dir, full_path))

            # Serve index.html for all other paths (React Router handles routing)
            index_path = os.path.join(html_dir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(
                    index_path,
                    headers={"Cache-Control": "no-cache"},
                )
            return {"error": "React app index.html not found"}

    else:
        logger.warning("No static directory found - React app will not be served")

        @app.get("/")
        async def api_root():
            return {
                "message": "Medical Records API",
                "docs": "/docs",
                "status": "React app not configured",
            }

    return static_dir, html_dir
