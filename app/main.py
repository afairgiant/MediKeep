from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import create_tables, create_default_user
from app.core.logging_middleware import RequestLoggingMiddleware
from app.core.logging_config import get_logger

# Initialize logger
logger = get_logger(__name__, "app")

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
)

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


# Catch-all route for React routing (must be last)
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve React app for all non-API routes"""
    # Don't interfere with API routes
    if full_path.startswith("api/"):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404, detail="API endpoint not found"
        )  # Serve React app for frontend routes
    if html_dir and os.path.exists(os.path.join(html_dir, "index.html")):
        index_path = os.path.join(html_dir, "index.html")
        return FileResponse(index_path)

    return {"error": "React app not available"}
