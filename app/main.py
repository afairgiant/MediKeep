from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging_config import LoggingConfig, get_logger
from app.core.logging_middleware import RequestLoggingMiddleware
from app.core.middleware import TrailingSlashMiddleware
from app.core.activity_middleware import ActivityTrackingMiddleware
from app.core.spa_routing import setup_spa_routing
from app.core.startup import startup_event
from app.core.static_files import setup_static_files
from app.core.uvicorn_logging import configure_uvicorn_logging

# Initialize logging configuration
logging_config = LoggingConfig()

# Configure Uvicorn logging to match our format
configure_uvicorn_logging()

# Initialize logger
logger = get_logger(__name__, "app")

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
)

# Add middleware stack
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(ActivityTrackingMiddleware)
app.add_middleware(TrailingSlashMiddleware)
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

# Setup static files and get directory paths
static_dir, html_dir = setup_static_files(app)

# Setup startup event
app.add_event_handler("startup", startup_event)


@app.get("/health")
def health():
    """Health check endpoint"""
    logger.info(
        "Health check requested", extra={"category": "app", "event": "health_check"}
    )
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}


# Setup SPA routing (only activates if React build exists)
setup_spa_routing(app, static_dir, html_dir)
