from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

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

# Global exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Global handler for Pydantic validation errors (422) with detailed feedback.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    # Log the validation error details
    logger.warning(
        f"Validation error on {request.method} {request.url.path}",
        extra={
            "category": "app",
            "event": "validation_error",
            "ip": user_ip,
            "validation_errors": exc.errors(),
            "url_path": str(request.url.path),
            "method": request.method,
        }
    )
    
    # Create more user-friendly error messages
    detailed_errors = []
    for error in exc.errors():
        field = error.get('loc')[-1] if error.get('loc') else 'unknown'
        msg = error.get('msg', 'Invalid value')
        
        # Make common validation errors more user-friendly
        if 'ensure this value is greater than' in msg:
            detailed_errors.append(f"{field}: Value must be greater than the minimum allowed")
        elif 'ensure this value is less than' in msg:
            detailed_errors.append(f"{field}: Value exceeds the maximum allowed")
        elif 'field required' in msg:
            detailed_errors.append(f"{field}: This field is required")
        elif 'string too short' in msg:
            detailed_errors.append(f"{field}: Value is too short")
        elif 'string too long' in msg:
            detailed_errors.append(f"{field}: Value is too long")
        else:
            detailed_errors.append(f"{field}: {msg}")
    
    error_detail = {
        "message": "Validation failed",
        "errors": detailed_errors,
        "type": "validation_error"
    }
    
    raise HTTPException(status_code=422, detail=error_detail)

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
