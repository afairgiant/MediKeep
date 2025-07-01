#!/usr/bin/env python3
"""
Development server runner for Medical Records Management System.

This script starts the FastAPI development server with hot reload enabled.
"""

import os
import sys

import uvicorn

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

if __name__ == "__main__":
    # Import and configure custom Uvicorn logging
    from app.core.config import settings
    from app.core.uvicorn_logging import get_uvicorn_log_config

    # Get log level from environment variable for consistency
    log_level = os.getenv("LOG_LEVEL", "INFO").lower()

    # SSL configuration
    ssl_kwargs = {}
    if (
        settings.ENABLE_SSL
        and os.path.exists(settings.SSL_CERTFILE)
        and os.path.exists(settings.SSL_KEYFILE)
    ):
        ssl_kwargs.update(
            {
                "ssl_certfile": settings.SSL_CERTFILE,
                "ssl_keyfile": settings.SSL_KEYFILE,
            }
        )
        print(f"HTTPS enabled: https://127.0.0.1:8000")
    else:
        print(f"HTTP mode: http://127.0.0.1:8000")

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level=log_level,
        log_config=get_uvicorn_log_config(),
        **ssl_kwargs,
    )
