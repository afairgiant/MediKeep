import pathlib


def pytest_ignore_collect(collection_path, config):
    """Prevent pytest from recursing into non-test directories."""
    ignore_dirs = {"frontend", "node_modules", "uploads", "htmlcov", ".venv", "dist"}
    parts = pathlib.Path(collection_path).parts
    return any(part in ignore_dirs for part in parts)
