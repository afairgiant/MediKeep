"""
System tray application for MediKeep Windows EXE.

This module provides a system tray icon that allows MediKeep to run in the background
on Windows. Users can start/stop the server, open the web interface, and exit the
application from the tray icon.
"""

import os
import sys
import threading
import webbrowser
from typing import Optional

try:
    import pystray
    from PIL import Image, ImageDraw
    TRAY_AVAILABLE = True
except ImportError:
    TRAY_AVAILABLE = False

from app.core.logging_config import get_logger
from app.core.config import settings

logger = get_logger(__name__, "app")


class MediKeepTrayApp:
    """System tray application for MediKeep."""

    def __init__(self, server_url: str = "http://127.0.0.1:8000"):
        """
        Initialize the system tray application.

        Args:
            server_url: URL where the MediKeep server is running
        """
        self.server_url = server_url
        self.icon: Optional[pystray.Icon] = None
        self.server_thread: Optional[threading.Thread] = None
        self.server_running = False

    def create_icon_image(self) -> Image.Image:
        """
        Create a simple icon for the system tray.

        Returns:
            PIL Image for the tray icon
        """
        # Create a simple 64x64 icon with a medical cross
        width = 64
        height = 64
        color1 = (52, 152, 219)  # Blue background
        color2 = (255, 255, 255)  # White cross

        image = Image.new('RGB', (width, height), color1)
        draw = ImageDraw.Draw(image)

        # Draw a medical cross
        # Vertical bar
        draw.rectangle([(24, 8), (40, 56)], fill=color2)
        # Horizontal bar
        draw.rectangle([(8, 24), (56, 40)], fill=color2)

        return image

    def open_browser(self, icon=None, item=None):
        """Open the MediKeep web interface in the default browser."""
        logger.info(f"Opening MediKeep in browser: {self.server_url}")
        webbrowser.open(self.server_url)

    def show_logs_folder(self, icon=None, item=None):
        """Open the logs folder in Windows Explorer."""
        from app.core.windows_config import get_logs_path
        logs_path = get_logs_path()
        if logs_path and os.path.exists(logs_path):
            os.startfile(logs_path)
            logger.info(f"Opened logs folder: {logs_path}")
        else:
            logger.warning("Logs folder not found")

    def show_data_folder(self, icon=None, item=None):
        """Open the data folder in Windows Explorer."""
        from app.core.windows_config import get_windows_appdata_path
        data_path = get_windows_appdata_path()
        if data_path and os.path.exists(data_path):
            os.startfile(data_path)
            logger.info(f"Opened data folder: {data_path}")
        else:
            logger.warning("Data folder not found")

    def quit_app(self, icon=None, item=None):
        """
        Initiate graceful application shutdown.

        Uses the shutdown manager to coordinate cleanup of all components.
        If graceful shutdown fails, forces termination to ensure no orphaned processes.
        """
        from app.core.shutdown_manager import shutdown_application

        logger.info("Shutdown requested from system tray")
        self.server_running = False

        # Stop the tray icon first (prevents user from clicking again)
        if self.icon:
            try:
                logger.info("Stopping system tray icon...")
                self.icon.stop()
            except Exception as e:
                logger.error(f"Error stopping tray icon: {e}")

        # Initiate coordinated shutdown
        # This will handle server shutdown, database cleanup, log flushing, etc.
        shutdown_application(exit_code=0)

    def setup_menu(self) -> pystray.Menu:
        """
        Create the system tray menu.

        Returns:
            pystray.Menu with application options
        """
        return pystray.Menu(
            pystray.MenuItem(
                "Open MediKeep",
                self.open_browser,
                default=True  # Double-click action
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Show Logs Folder", self.show_logs_folder),
            pystray.MenuItem("Show Data Folder", self.show_data_folder),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", self.quit_app)
        )

    def run(self):
        """Run the system tray application."""
        if not TRAY_AVAILABLE:
            logger.warning(
                "pystray not available - running in console mode. "
                "Install pystray for system tray support: pip install pystray pillow"
            )
            return False

        try:
            logger.info("Starting MediKeep system tray application")

            # Create the tray icon
            icon_image = self.create_icon_image()
            menu = self.setup_menu()

            self.icon = pystray.Icon(
                "MediKeep",
                icon_image,
                f"MediKeep Medical Records v{settings.VERSION}",
                menu
            )

            # Show notification
            if hasattr(self.icon, 'notify'):
                self.icon.notify(
                    "MediKeep is running",
                    f"Server available at {self.server_url}"
                )

            # Run the icon (this blocks until user quits from tray menu)
            self.server_running = True
            logger.info("System tray icon running - MediKeep is now in the background")
            self.icon.run()

            return True

        except Exception as e:
            logger.error(f"Failed to start system tray application: {e}")
            return False


def is_tray_available() -> bool:
    """
    Check if system tray functionality is available.

    Returns:
        True if pystray is installed and can be used
    """
    return TRAY_AVAILABLE


def run_with_tray(server_url: str = "http://127.0.0.1:8000") -> bool:
    """
    Run MediKeep with system tray support.

    This function should be called after the server has started.
    It will create a system tray icon and keep the application running
    in the background.

    Args:
        server_url: URL where the MediKeep server is running

    Returns:
        True if tray was started successfully, False otherwise
    """
    app = MediKeepTrayApp(server_url)
    return app.run()
