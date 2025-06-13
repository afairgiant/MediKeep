from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import os

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import create_tables, create_default_user
from app.core.logging_middleware import RequestLoggingMiddleware
from app.core.logging_config import get_logger

# Initialize logger
logger = get_logger(__name__, "app")


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """Middleware to handle trailing slash redirects for API routes"""

    async def dispatch(self, request: Request, call_next):
        url_path = str(request.url.path)

        # For API routes that don't end with /, redirect to version with /
        if (
            url_path.startswith("/api/v1/")
            and not url_path.endswith("/")
            and not url_path.split("/")[
                -1
            ].isdigit()  # Don't redirect ID-based routes like /api/v1/treatments/123
            and url_path not in ["/api/v1/patients/me"]
        ):  # Don't redirect specific known routes
            # Check if this is a route that should have a trailing slash
            route_endings = [
                "/treatments",
                "/procedures",
                "/allergies",
                "/conditions",
                "/practitioners",
                "/medications",
                "/immunizations",
                "/encounters",
            ]
            if any(url_path.endswith(ending) for ending in route_endings):
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

# Add trailing slash middleware (should be added early)
app.add_middleware(TrailingSlashMiddleware)

# Add logging middleware (should be added first)
app.add_middleware(RequestLoggingMiddleware)

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


# Serve static files (React build) in production
# Try multiple possible static directory locations
static_dirs = [
    os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "static", "static"
    ),  # Development (nested)
    "/app/static/static",  # Docker container (nested static directory)
    "static/static",  # Current directory (Docker workdir is /app) (nested)
    os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "static"
    ),  # Development fallback
    "/app/static",  # Docker container fallback
    "static",  # Current directory fallback
]

# Debug: Log all attempted paths and their existence
logger.info("=== DEBUGGING STATIC FILE PATHS ===")
for i, dir_path in enumerate(static_dirs):
    exists = os.path.exists(dir_path)
    logger.info(f"Static path {i + 1}: {dir_path} - Exists: {exists}")
    if exists:
        # List contents if it exists
        try:
            contents = os.listdir(dir_path)
            logger.info(f"Contents of {dir_path}: {contents}")
        except Exception as e:
            logger.error(f"Error listing {dir_path}: {e}")

# Also check current working directory
cwd = os.getcwd()
logger.info(f"Current working directory: {cwd}")
logger.info(
    f"Contents of current directory: {os.listdir(cwd) if os.path.exists(cwd) else 'N/A'}"
)

static_dir = None
html_dir = None  # Separate directory for HTML files

for dir_path in static_dirs:
    if os.path.exists(dir_path):
        static_dir = dir_path
        html_dir = dir_path  # Initially same as static_dir
        break

if static_dir:
    # Check if we found the nested static directory directly
    if static_dir.endswith("/static/static") or static_dir.endswith("\\static\\static"):
        # We found the nested directory directly, use it for static assets
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
        logger.info(f"✅ Serving static assets from nested directory: {static_dir}")
        # Set html_dir to the parent directory for index.html
        html_dir = os.path.dirname(static_dir)
        logger.info(f"✅ Serving HTML files from parent directory: {html_dir}")
    else:
        # Check for nested static directory within the found directory
        nested_static = os.path.join(static_dir, "static")
        if (
            os.path.exists(nested_static)
            and os.path.exists(os.path.join(nested_static, "css"))
            and os.path.exists(os.path.join(nested_static, "js"))
        ):
            # Use nested directory for static assets (CSS/JS)
            app.mount("/static", StaticFiles(directory=nested_static), name="static")
            logger.info(
                f"✅ Serving static assets from nested directory: {nested_static}"
            )
            # Keep HTML files in the current directory
            html_dir = static_dir
            logger.info(f"✅ Serving HTML files from: {html_dir}")
        else:
            # Use the same directory for both static assets and HTML
            app.mount("/static", StaticFiles(directory=static_dir), name="static")
            logger.info(f"✅ Serving static files from: {static_dir}")
            html_dir = static_dir

    # List what's actually in the static directory
    try:
        static_contents = os.listdir(static_dir)
        logger.info(f"Static directory contents: {static_contents}")

        # Check for specific folders
        css_path = os.path.join(static_dir, "static", "css")
        js_path = os.path.join(static_dir, "static", "js")
        logger.info(f"CSS path exists: {os.path.exists(css_path)} - {css_path}")
        logger.info(f"JS path exists: {os.path.exists(js_path)} - {js_path}")

        if os.path.exists(css_path):
            logger.info(f"CSS files: {os.listdir(css_path)}")
        if os.path.exists(js_path):
            logger.info(f"JS files: {os.listdir(js_path)}")

    except Exception as e:
        logger.error(f"Error listing static directory: {e}")

    @app.get("/")
    async def read_index():
        """Serve React app index.html for root path"""
        if html_dir:  # Use html_dir instead of static_dir
            index_path = os.path.join(html_dir, "index.html")
            return FileResponse(index_path)
        return {"error": "Static files not available"}
else:
    logger.warning("❌ No static directory found - React app will not be served")


async def check_sequences_on_startup():
    """Check and fix sequence synchronization on application startup"""
    if not settings.SEQUENCE_CHECK_ON_STARTUP:
        return

    try:
        from scripts.sequence_monitor import SequenceMonitor

        monitor = SequenceMonitor()

        logger.info("🔍 Checking database sequences on startup...")
        results = monitor.monitor_all_sequences(auto_fix=settings.SEQUENCE_AUTO_FIX)

        if results["out_of_sync_tables"]:
            if settings.SEQUENCE_AUTO_FIX:
                logger.info(
                    f"✅ Auto-fixed {len(results['fixed_tables'])} sequence issues on startup"
                )
            else:
                logger.warning(
                    f"⚠️  Found {len(results['out_of_sync_tables'])} sequence issues - auto-fix disabled"
                )
        else:
            logger.info("✅ All database sequences are synchronized")

    except Exception as e:
        logger.error(f"❌ Failed to check sequences on startup: {e}")


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
    create_tables()
    create_default_user()
    await check_sequences_on_startup()
    logger.info(
        "Application startup completed",
        extra={"category": "app", "event": "application_startup_complete"},
    )


@app.get("/health")
def health():
    """Health check endpoint"""
    logger.info(
        "Health check requested", extra={"category": "app", "event": "health_check"}
    )
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}


# Note: Removed catch-all route that was interfering with API endpoints
# React routing should be handled by the frontend, not by a catch-all backend route
