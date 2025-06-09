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
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def read_index():
        """Serve React app index.html for root path"""
        return FileResponse(os.path.join(static_dir, "index.html"))


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
