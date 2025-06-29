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
    from app.core.uvicorn_logging import get_uvicorn_log_config

    # Get log level from environment variable for consistency
    log_level = os.getenv("LOG_LEVEL", "INFO").lower()

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level=log_level,
        log_config=get_uvicorn_log_config(),
    )
