"""
Vaccine Library Loader

Loads the shared vaccine library JSON file with caching.
This provides a single source of truth for vaccine definitions
used by both frontend and backend.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

__all__ = [
    "load_vaccine_library",
    "get_vaccine_entries",
]

# Path to shared vaccine library JSON
_PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
VACCINE_LIBRARY_PATH = _PROJECT_ROOT / "shared" / "data" / "vaccine_library.json"

# Module-level cache. Loaded once from FastAPI's single-threaded startup path
# (app.services.vaccine_library_sync); no concurrent callers to guard against.
_vaccine_library_cache: Optional[Dict[str, Any]] = None


def _validate_path(path: Path) -> None:
    """Validate the vaccine library path is within project root."""
    resolved_path = path.resolve()
    if not resolved_path.is_relative_to(_PROJECT_ROOT):
        raise ValueError(f"Vaccine library path outside project root: {resolved_path}")
    if not resolved_path.exists():
        raise FileNotFoundError(f"Vaccine library not found: {resolved_path}")


def load_vaccine_library() -> Dict[str, Any]:
    """
    Load the vaccine library JSON file, caching the result for the process
    lifetime.

    Returns:
        Dict containing version, lastUpdated, and vaccines list.

    Raises:
        FileNotFoundError: If the JSON file doesn't exist.
        json.JSONDecodeError: If the JSON is malformed.
        ValueError: If the path is outside project root.
    """
    global _vaccine_library_cache

    if _vaccine_library_cache is not None:
        return _vaccine_library_cache

    logger.info(
        "Loading vaccine library from JSON",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "vaccine_library_loading",
            LogFields.FILE: str(VACCINE_LIBRARY_PATH),
        },
    )

    _validate_path(VACCINE_LIBRARY_PATH)

    with open(VACCINE_LIBRARY_PATH, "r", encoding="utf-8") as f:
        _vaccine_library_cache = json.load(f)

    logger.info(
        "Vaccine library loaded successfully",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "vaccine_library_loaded",
            "version": _vaccine_library_cache.get("version"),
            LogFields.COUNT: len(_vaccine_library_cache.get("vaccines", [])),
        },
    )

    return _vaccine_library_cache


def get_vaccine_entries() -> List[Dict[str, Any]]:
    """
    Get the list of vaccine entries from the library.

    Returns:
        List of vaccine definitions.
    """
    library = load_vaccine_library()
    return library.get("vaccines", [])
