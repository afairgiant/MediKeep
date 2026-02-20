"""
Docker secrets _FILE pattern support.

Provides get_secret() to read sensitive configuration from either
environment variables or secret files (e.g., /run/secrets/db_password).

Convention: For any VAR, setting VAR_FILE=/path/to/file causes the
value to be read from that file. Direct VAR always takes precedence
over VAR_FILE.
"""

import logging
import os

# Use stdlib logging directly to avoid circular imports with app logging
logger = logging.getLogger(__name__)


def get_secret(env_var: str, default: str = "") -> str:
    """
    Read a secret from an environment variable or a _FILE reference.

    Precedence:
      1. Direct env var (VAR) - if set, returned immediately
      2. File env var (VAR_FILE) - file contents read and stripped
      3. Default value

    Args:
        env_var: The environment variable name (e.g., "DB_PASSWORD").
        default: Fallback value if neither VAR nor VAR_FILE is set.

    Returns:
        The secret value, or default if not available.
    """
    file_var = f"{env_var}_FILE"

    direct_value = os.environ.get(env_var)
    if direct_value is not None:
        if os.environ.get(file_var):
            logger.warning(
                "Both %s and %s are set; using %s (direct value takes precedence)",
                env_var,
                file_var,
                env_var,
            )
        return direct_value

    file_path = os.environ.get(file_var)
    if file_path:
        return _read_secret_file(file_path, file_var, default)

    return default


def _read_secret_file(file_path: str, file_var: str, default: str) -> str:
    """
    Read and return the contents of a secret file.

    Args:
        file_path: Path to the secret file.
        file_var: The _FILE env var name (for log messages).
        default: Fallback if the file cannot be read.

    Returns:
        Stripped file contents, or default on error.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            value = f.read().strip()

        if not value:
            logger.warning(
                "%s points to %s but the file is empty; using default",
                file_var,
                file_path,
            )
            return default

        return value

    except FileNotFoundError:
        logger.error(
            "%s points to %s but the file was not found; using default",
            file_var,
            file_path,
        )
        return default

    except PermissionError:
        logger.error(
            "%s points to %s but permission was denied; using default",
            file_var,
            file_path,
        )
        return default

    except OSError as exc:
        logger.error(
            "%s points to %s but reading failed (%s); using default",
            file_var,
            file_path,
            exc,
        )
        return default
