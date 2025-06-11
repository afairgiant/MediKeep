#!/usr/bin/env python3
"""
Development server runner for Medical Records Management System.

This script starts the FastAPI development server with hot reload enabled.
"""

import uvicorn
import os
import sys

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level="debug",
    )
