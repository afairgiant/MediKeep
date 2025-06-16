from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import os

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import (
    check_database_connection,
    create_tables,
    create_default_user,
    check_sequences_on_startup,
    database_migrations,
)
from app.core.logging_middleware import RequestLoggingMiddleware
from app.core.logging_config import get_logger, LoggingConfig
from app.scripts.sequence_monitor import SequenceMonitor

# Initialize logging configuration
logging_config = LoggingConfig()

# Initialize logger
logger = get_logger(__name__, "app")


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """Middleware to handle trailing slash redirects for API routes"""

    async def dispatch(self, request: Request, call_next):
        url_path = str(
            request.url.path
        )  # For routes that should NOT have trailing slashes, remove them
        no_slash_routes = [
            "/api/v1/patients/me/",
            "/api/v1/auth/login/",
            "/api/v1/auth/logout/",
            "/api/v1/health/",
        ]

        if url_path in no_slash_routes:
            redirect_url = str(request.url).replace(url_path, url_path.rstrip("/"))
            return RedirectResponse(
                url=redirect_url, status_code=307
            )  # 307 preserves the HTTP method

        # For specific API routes that need trailing slashes, add them
        if (
            url_path.startswith("/api/v1/patients/")
            and not url_path.endswith("/")
            and not url_path.endswith("/me")  # Don't add slash to /patients/me
        ):
            # Check if this is a patient sub-resource route that needs trailing slash
            path_parts = url_path.split("/")
            if (
                len(path_parts) >= 5 and path_parts[4].isdigit()
            ):  # /api/v1/patients/{id}/...
                sub_resource_routes = [
                    "medications",
                    "treatments",
                    "procedures",
                    "allergies",
                    "conditions",
                    "immunizations",
                    "encounters",
                    "lab-results",
                ]
                if len(path_parts) == 6 and path_parts[5] in sub_resource_routes:
                    redirect_url = str(request.url).replace(url_path, url_path + "/")
                    return RedirectResponse(
                        url=redirect_url, status_code=307
                    )  # 307 preserves the HTTP method

        response = await call_next(request)
        return response


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
)


# Add logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Add trailing slash middleware
app.add_middleware(TrailingSlashMiddleware)


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include API routers
app.include_router(api_router, prefix="/api/v1")


# Serve static files (React build)
STATIC_DIR = os.environ.get("STATIC_DIR", "static")

# Try multiple possible static directory locations for flexibility
static_dirs = [
    STATIC_DIR,  # Environment variable or default "static"
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),  # Development
    "/app/static",  # Docker container
    "static",  # Current directory fallback
]

static_dir = None
for dir_path in static_dirs:
    if os.path.exists(dir_path):
        static_dir = dir_path
        logger.info(f"✅ Found static directory: {static_dir}")
        break

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


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    logger.info(
        "Application starting up",
        extra={
            "category": "app",
            "event": "application_startup",
            "version": settings.VERSION,
        },
    )

    # Skip database operations if in test mode
    skip_migrations = os.getenv("SKIP_MIGRATIONS", "false").lower() == "true"

    if skip_migrations:
        logger.info("⏭️ Skipping database operations (test mode)")
        logger.info("Application startup completed (test mode)")
        return

    # Check if database connection is valid
    db_check_result = check_database_connection()

    if not db_check_result:
        logger.error("❌ Database connection failed")
        import sys

        sys.exit(1)

    logger.info("✅ Database connection established")

    # Run database migrations
    migration_success = database_migrations()
    if not migration_success:
        logger.error("❌ Database migrations failed")
        import sys

        sys.exit(1)

    # Create default user if not exists
    create_default_user()
    await check_sequences_on_startup()
    logger.info("Application startup completed")


@app.get("/health")
def health():
    """Health check endpoint"""
    logger.info(
        "Health check requested", extra={"category": "app", "event": "health_check"}
    )
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}


def setup_spa_routing():
    """
    Setup SPA routing only when React build files exist (production).
    This avoids conflicts during development.
    """
    if not static_dir:
        logger.info("🔧 Development mode - No static directory, SPA routing disabled")
        return

    index_path = os.path.join(static_dir, "index.html")
    if not os.path.exists(index_path):
        logger.info("🔧 Development mode - No index.html found, SPA routing disabled")
        return

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve React SPA for non-API routes in production only.
        This route is only created when React build files exist.
        """
        # Block API routes explicitly
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # Block special FastAPI routes
        if full_path in ["docs", "redoc", "openapi.json", "health"]:
            raise HTTPException(status_code=404, detail="Not found")

        # Serve React app for all other routes
        return FileResponse(index_path)

    logger.info("✅ Production mode - SPA routing enabled for React Router")


# Setup SPA routing (only activates if React build exists)
setup_spa_routing()

# Note: Catch-all route removed to prevent interference with API endpoints
# For production deployment, React Router should be handled by the frontend build process
