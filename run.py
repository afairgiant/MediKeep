#!/usr/bin/env python3
"""
Server runner for MediKeep.

This script starts the FastAPI server:
- Development mode: Hot reload enabled
- Windows EXE mode: Production server without reload
"""

import os
import sys

import uvicorn

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

if __name__ == "__main__":
    # Import and configure custom Uvicorn logging
    from app.core.config import settings
    from app.core.logging_config import get_logger
    from app.core.uvicorn_logging import get_uvicorn_log_config
    from app.core.windows_config import is_windows_exe

    # Get log level from environment variable for consistency
    log_level = os.getenv("LOG_LEVEL", "INFO").lower()

    # Detect if running as Windows EXE
    is_exe = is_windows_exe()

    # Setup logger for startup messages
    logger = get_logger(__name__, "app")

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
        logger.info("HTTPS enabled: https://127.0.0.1:8000")
    else:
        logger.info("HTTP mode: http://127.0.0.1:8000")

    # Configure uvicorn based on execution mode
    if is_exe:
        # Windows EXE mode - production settings with system tray
        import signal
        import threading
        import time
        import webbrowser
        from app.core.shutdown_manager import get_shutdown_manager, shutdown_application
        from app.core.system_tray import is_tray_available, run_with_tray

        logger.info("Starting MediKeep in Windows EXE mode")
        logger.info(f"Data directory: {os.getenv('APPDATA')}\\Roaming\\MediKeep")

        # Get shutdown manager and configure timeout
        shutdown_manager = get_shutdown_manager(timeout=5)

        # Server reference for shutdown
        server_instance = None
        server_thread = None

        def run_server():
            """Run the uvicorn server in a separate thread."""
            nonlocal server_instance
            logger.info("Starting FastAPI server on http://127.0.0.1:8000")

            # Create uvicorn config
            config = uvicorn.Config(
                "app.main:app",
                host="127.0.0.1",
                port=8000,
                reload=False,
                log_level=log_level,
                log_config=get_uvicorn_log_config(),
                **ssl_kwargs,
            )
            server_instance = uvicorn.Server(config)

            # Run server
            try:
                server_instance.run()
            except Exception as e:
                logger.error(f"Server error: {e}")

        def shutdown_server():
            """Gracefully shutdown the uvicorn server."""
            if server_instance:
                logger.info("Shutting down FastAPI server...")
                try:
                    # Signal the server to shut down
                    server_instance.should_exit = True
                    # Wait briefly for shutdown
                    time.sleep(1)
                except Exception as e:
                    logger.error(f"Error during server shutdown: {e}")
            else:
                logger.warning("No server instance to shutdown")

        def shutdown_database():
            """Close all database connections."""
            try:
                from app.core.database import engine
                logger.info("Closing database connections...")
                engine.dispose()
                logger.info("Database connections closed")
            except Exception as e:
                logger.error(f"Error closing database: {e}")

        # Register shutdown handlers (executed in reverse order)
        shutdown_manager.register_handler(shutdown_database, "Database Cleanup")
        shutdown_manager.register_handler(shutdown_server, "Uvicorn Server")

        # Handle Ctrl+C gracefully
        def signal_handler(sig, frame):
            logger.info("Received interrupt signal (Ctrl+C)")
            shutdown_application(exit_code=0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Check if system tray is available
        tray_available = is_tray_available()
        logger.info(f"System tray available: {tray_available}")

        if tray_available:
            logger.info("Starting system tray application")

            # Start server in background thread (non-daemon so it keeps running)
            server_thread = threading.Thread(target=run_server, daemon=False)
            server_thread.start()

            # Wait for server to start
            time.sleep(3)

            # Open browser automatically
            server_url = f"http://127.0.0.1:8000"
            logger.info(f"Opening browser to {server_url}")
            webbrowser.open(server_url)

            # Run system tray (this blocks until user quits from tray menu)
            try:
                run_with_tray(server_url)
            except Exception as e:
                logger.error(f"System tray failed: {e}")
                # If tray fails, keep server running in background
                server_thread.join()
        else:
            logger.warning("System tray not available, running in headless mode")
            # No tray available - just run server
            run_server()
    else:
        # Development mode - hot reload enabled
        logger.info("Starting MediKeep in development mode with hot reload")
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
