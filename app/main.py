from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import create_tables
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
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router, prefix="/api/v1")


# Serve static files (React build) in production
# Try multiple possible static directory locations
static_dirs = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),  # Development
    "/app/static",  # Docker container
    "static",  # Current directory (Docker workdir is /app)
]

static_dir = None
for dir_path in static_dirs:
    if os.path.exists(dir_path):
        static_dir = dir_path
        break

if static_dir:
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    logger.info(f"Serving static files from: {static_dir}")

    @app.get("/")
    async def read_index():
        """Serve React app index.html for root path"""
        if static_dir:  # Additional check for type safety
            index_path = os.path.join(static_dir, "index.html")
            return FileResponse(index_path)
        return {"error": "Static files not available"}
else:
    logger.warning("No static directory found - React app will not be served")


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
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # Serve React app for frontend routes
    if static_dir and os.path.exists(os.path.join(static_dir, "index.html")):
        index_path = os.path.join(static_dir, "index.html")
        return FileResponse(index_path)
    
    return {"error": "React app not available"}
