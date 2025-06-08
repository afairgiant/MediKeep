from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import create_tables

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
)

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

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """Serve React app for all non-API routes (SPA routing)"""
        # Don't intercept API routes
        if (
            full_path.startswith("api/")
            or full_path.startswith("docs")
            or full_path.startswith("health")
        ):
            return {"error": "Not found"}

        # Try to serve static file first
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        # Fallback to index.html for client-side routing
        return FileResponse(os.path.join(static_dir, "index.html"))


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    create_tables()


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
