"""
Windows-specific configuration for EXE deployment.

Handles AppData directory setup, path configuration, and Windows-specific
file operations for standalone executable distribution.
"""
import os
import sys
from pathlib import Path
from typing import Optional

# Lazy import logger to avoid circular dependency with logging_config
# logging_config imports this module to detect Windows EXE mode
_logger = None

def _get_logger():
    """Lazy load logger to avoid circular import."""
    global _logger
    if _logger is None:
        from app.core.logging_config import get_logger
        _logger = get_logger(__name__, "app")
    return _logger


def is_windows_exe() -> bool:
    """
    Detect if running as a PyInstaller Windows EXE.

    Returns:
        True if running as bundled EXE, False otherwise
    """
    return getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')


def get_windows_appdata_path() -> Optional[Path]:
    r"""
    Get the Windows AppData Roaming directory for MediKeep.

    Returns:
        Path to AppData\Roaming\MediKeep or None if not on Windows

    Example:
        C:\Users\Username\AppData\Roaming\MediKeep
    """
    if not sys.platform.startswith('win'):
        return None

    appdata = os.getenv('APPDATA')
    if not appdata:
        # Can't log here - might cause circular import during logging setup
        return None

    medikeep_dir = Path(appdata) / 'MediKeep'
    return medikeep_dir


def ensure_windows_directories() -> dict:
    r"""
    Create necessary Windows directories for MediKeep EXE.

    Creates the following directory structure in AppData\Roaming\MediKeep:
    - database/  (SQLite database file)
    - uploads/   (Patient photos, PDFs, etc.)
    - logs/      (Application logs)
    - temp/      (Temporary files)

    Returns:
        Dictionary with paths to created directories

    Raises:
        OSError: If directories cannot be created
    """
    if not is_windows_exe():
        return {}

    base_path = get_windows_appdata_path()
    if not base_path:
        raise OSError("Could not determine Windows AppData path")

    directories = {
        'base': base_path,
        'database': base_path / 'database',
        'uploads': base_path / 'uploads',
        'logs': base_path / 'logs',
        'temp': base_path / 'temp',
        'backups': base_path / 'backups'
    }

    # Create all directories (no logging to avoid circular import)
    for name, path in directories.items():
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError:
            raise

    return directories


def get_database_path() -> Path:
    r"""
    Get the SQLite database path for Windows EXE.

    Returns:
        Path to SQLite database file
        - Windows EXE: AppData\Roaming\MediKeep\database\medikeep.db
        - Development: ./medikeep.db (current directory)
    """
    if is_windows_exe():
        dirs = ensure_windows_directories()
        db_path = dirs['database'] / 'medikeep.db'
        return db_path
    else:
        db_path = Path('./medikeep.db')
        return db_path


def get_uploads_path() -> Path:
    r"""
    Get the uploads directory path for Windows EXE.

    Returns:
        Path to uploads directory
        - Windows EXE: AppData\Roaming\MediKeep\uploads
        - Development: ./uploads (current directory)
    """
    if is_windows_exe():
        dirs = ensure_windows_directories()
        uploads_path = dirs['uploads']
        return uploads_path
    else:
        uploads_path = Path('./uploads')
        uploads_path.mkdir(exist_ok=True)
        return uploads_path


def get_logs_path() -> Path:
    r"""
    Get the logs directory path for Windows EXE.

    Returns:
        Path to logs directory
        - Windows EXE: AppData\Roaming\MediKeep\logs
        - Development: ./logs (current directory)
    """
    if is_windows_exe():
        dirs = ensure_windows_directories()
        logs_path = dirs['logs']
        return logs_path
    else:
        logs_path = Path('./logs')
        logs_path.mkdir(exist_ok=True)
        return logs_path


def get_temp_path() -> Path:
    r"""
    Get the temporary files directory path for Windows EXE.

    Returns:
        Path to temp directory
        - Windows EXE: AppData\Roaming\MediKeep\temp
        - Development: ./temp (current directory)
    """
    if is_windows_exe():
        dirs = ensure_windows_directories()
        temp_path = dirs['temp']
        return temp_path
    else:
        temp_path = Path('./temp')
        temp_path.mkdir(exist_ok=True)
        return temp_path


def get_backups_path() -> Path:
    r"""
    Get the backups directory path for Windows EXE.

    Returns:
        Path to backups directory
        - Windows EXE: AppData\Roaming\MediKeep\backups
        - Development: ./backups (current directory)
    """
    if is_windows_exe():
        dirs = ensure_windows_directories()
        backups_path = dirs['backups']
        return backups_path
    else:
        backups_path = Path('./backups')
        backups_path.mkdir(exist_ok=True)
        return backups_path
