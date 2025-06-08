from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.web.routes import web_router
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

# Include routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(web_router)  # Web routes at root level


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    create_tables()


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
