"""
Test Library Loader

Loads the shared test library JSON file with caching.
This provides a single source of truth for test definitions
used by both frontend and backend.
"""

import json
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

__all__ = [
    "load_test_library",
    "get_tests",
    "get_library_version",
    "reload_test_library",
    "get_test_by_name",
    "get_all_canonical_names",
]

# Path to shared test library JSON
_PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
TEST_LIBRARY_PATH = _PROJECT_ROOT / "shared" / "data" / "test_library.json"

# Thread-safe module-level cache
_test_library_cache: Optional[Dict[str, Any]] = None
_cache_lock = threading.Lock()


def _validate_path(path: Path) -> None:
    """Validate the test library path is within project root."""
    resolved_path = path.resolve()
    if not str(resolved_path).startswith(str(_PROJECT_ROOT)):
        raise ValueError(f"Test library path outside project root: {resolved_path}")
    if not resolved_path.exists():
        raise FileNotFoundError(f"Test library not found: {resolved_path}")


def load_test_library() -> Dict[str, Any]:
    """
    Load the test library JSON file with thread-safe caching.

    Returns:
        Dict containing version, lastUpdated, and tests list.

    Raises:
        FileNotFoundError: If the JSON file doesn't exist.
        json.JSONDecodeError: If the JSON is malformed.
        ValueError: If the path is outside project root.
    """
    global _test_library_cache

    # Fast path: return cached value without lock
    if _test_library_cache is not None:
        return _test_library_cache

    # Slow path: acquire lock and load
    with _cache_lock:
        # Double-check after acquiring lock
        if _test_library_cache is not None:
            return _test_library_cache

        logger.info("Loading test library from JSON", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "test_library_loading",
            LogFields.FILE: str(TEST_LIBRARY_PATH),
        })

        _validate_path(TEST_LIBRARY_PATH)

        with open(TEST_LIBRARY_PATH, "r", encoding="utf-8") as f:
            _test_library_cache = json.load(f)

        logger.info("Test library loaded successfully", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "test_library_loaded",
            "version": _test_library_cache.get("version"),
            LogFields.COUNT: len(_test_library_cache.get("tests", [])),
        })

        return _test_library_cache


def get_tests() -> List[Dict[str, Any]]:
    """
    Get the list of tests from the library.

    Returns:
        List of test definitions.
    """
    library = load_test_library()
    return library.get("tests", [])


def get_library_version() -> str:
    """
    Get the version of the test library.

    Returns:
        Version string.
    """
    library = load_test_library()
    return library.get("version", "unknown")


def reload_test_library() -> Dict[str, Any]:
    """
    Force reload the test library from disk.
    Useful for development or after updates.

    Returns:
        Dict containing version, lastUpdated, and tests list.
    """
    global _test_library_cache

    with _cache_lock:
        _test_library_cache = None

    return load_test_library()


def get_test_by_name(test_name: str) -> Optional[Dict[str, Any]]:
    """
    Find a test by its canonical name (case-insensitive).

    Args:
        test_name: The canonical test name to find.

    Returns:
        Test definition dict or None if not found.
    """
    tests = get_tests()
    test_name_lower = test_name.lower()

    for test in tests:
        if test["test_name"].lower() == test_name_lower:
            return test

    return None


def get_all_canonical_names() -> List[str]:
    """
    Get list of all canonical test names.

    Returns:
        List of canonical test names.
    """
    tests = get_tests()
    return [test["test_name"] for test in tests]
