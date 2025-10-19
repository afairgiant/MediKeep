"""
Shutdown manager for MediKeep Windows EXE.

Ensures graceful shutdown of all components with fallback to force termination
if graceful shutdown fails.
"""

import logging
import os
import signal
import sys
import threading
import time
from typing import Callable, List, Optional

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


class ShutdownManager:
    """
    Manages graceful application shutdown with force termination fallback.

    This class coordinates the shutdown of all application components:
    1. System tray icon
    2. Uvicorn web server
    3. Database connections
    4. Log file handlers

    If graceful shutdown times out, forces immediate termination.
    """

    def __init__(self, timeout: int = 5):
        """
        Initialize shutdown manager.

        Args:
            timeout: Maximum seconds to wait for graceful shutdown before forcing exit
        """
        self.timeout = timeout
        self.shutdown_handlers: List[Callable] = []
        self.shutdown_in_progress = False
        self._shutdown_lock = threading.Lock()

    def register_handler(self, handler: Callable, name: str = "Unknown"):
        """
        Register a shutdown handler function.

        Handlers are called in reverse order of registration (LIFO).

        Args:
            handler: Callable that performs cleanup (should not raise exceptions)
            name: Descriptive name for logging
        """
        self.shutdown_handlers.append((handler, name))
        logger.debug(f"Registered shutdown handler: {name}")

    def shutdown(self, exit_code: int = 0) -> None:
        """
        Initiate graceful shutdown with force termination fallback.

        Args:
            exit_code: Exit code to use (0 = success, non-zero = error)
        """
        # Prevent multiple simultaneous shutdown attempts
        with self._shutdown_lock:
            if self.shutdown_in_progress:
                logger.warning("Shutdown already in progress, ignoring duplicate request")
                return

            self.shutdown_in_progress = True

        logger.info("=" * 60)
        logger.info("SHUTDOWN INITIATED")
        logger.info("=" * 60)

        # Start graceful shutdown in a separate thread with timeout
        shutdown_thread = threading.Thread(target=self._graceful_shutdown, daemon=True)
        shutdown_thread.start()

        # Wait for graceful shutdown to complete (with timeout)
        shutdown_thread.join(timeout=self.timeout)

        if shutdown_thread.is_alive():
            # Graceful shutdown timed out
            logger.error(f"Graceful shutdown timed out after {self.timeout}s")
            logger.warning("Forcing immediate termination...")
            self._force_shutdown(exit_code)
        else:
            # Graceful shutdown completed
            logger.info("Graceful shutdown completed successfully")
            logger.info("=" * 60)

            # Flush all log handlers before exit
            logging.shutdown()

            # Normal exit
            sys.exit(exit_code)

    def _graceful_shutdown(self) -> None:
        """Execute all shutdown handlers gracefully."""
        logger.info(f"Running {len(self.shutdown_handlers)} shutdown handlers...")

        # Execute handlers in reverse order (LIFO - last registered, first executed)
        for handler, name in reversed(self.shutdown_handlers):
            try:
                logger.info(f"Executing shutdown handler: {name}")
                handler()
                logger.info(f"✓ Completed: {name}")
            except Exception as e:
                logger.error(f"✗ Shutdown handler '{name}' failed: {e}", exc_info=True)
                # Continue with other handlers even if one fails

        logger.info("All shutdown handlers completed")

    def _force_shutdown(self, exit_code: int) -> None:
        """
        Force immediate process termination.

        This is a last resort when graceful shutdown times out.
        Kills the entire process tree to ensure no orphaned processes.

        Args:
            exit_code: Exit code to use
        """
        logger.warning("FORCING IMMEDIATE SHUTDOWN")

        try:
            # Try to flush logs one last time
            logging.shutdown()
        except Exception:
            pass  # Ignore errors during emergency shutdown

        # On Windows, kill entire process tree
        if sys.platform.startswith('win'):
            try:
                import subprocess
                # Get current process ID
                pid = os.getpid()
                # Kill process tree (current process + all children)
                subprocess.run(
                    ['taskkill', '/F', '/T', '/PID', str(pid)],
                    capture_output=True,
                    timeout=2
                )
            except Exception as e:
                logger.error(f"Failed to kill process tree: {e}")

        # Force immediate exit (bypasses cleanup handlers)
        os._exit(exit_code)


# Global shutdown manager instance
_shutdown_manager: Optional[ShutdownManager] = None


def get_shutdown_manager(timeout: int = 5) -> ShutdownManager:
    """
    Get or create the global shutdown manager.

    Args:
        timeout: Shutdown timeout in seconds (only used on first call)

    Returns:
        Global ShutdownManager instance
    """
    global _shutdown_manager

    if _shutdown_manager is None:
        _shutdown_manager = ShutdownManager(timeout=timeout)

    return _shutdown_manager


def register_shutdown_handler(handler: Callable, name: str = "Unknown") -> None:
    """
    Convenience function to register a shutdown handler.

    Args:
        handler: Callable that performs cleanup
        name: Descriptive name for logging
    """
    manager = get_shutdown_manager()
    manager.register_handler(handler, name)


def shutdown_application(exit_code: int = 0) -> None:
    """
    Convenience function to initiate application shutdown.

    Args:
        exit_code: Exit code (0 = success, non-zero = error)
    """
    manager = get_shutdown_manager()
    manager.shutdown(exit_code)
