import re
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.logging_config import get_logger

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logger = get_logger(__name__, "app")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Generate a hash for a password.

    Args:
        password: The plain text password to hash

    Returns:
        The hashed password
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create a JWT access token.

    Args:
        data: The data to encode in the token
        expires_delta: Token expiration time (optional)

    Returns:
        The encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


class SecurityValidator:
    """Centralized security validation for backup/restore operations."""

    @staticmethod
    def validate_connection_params(database_url: str) -> Dict[str, str]:
        """Extract and validate database connection parameters."""
        if not database_url:
            raise ValueError("DATABASE_URL not configured")

        try:
            parsed = urllib.parse.urlparse(database_url)
        except Exception as e:
            raise ValueError(f"Invalid DATABASE_URL format: {str(e)}")

        # Extract and validate components
        hostname = parsed.hostname or "localhost"
        if not SecurityValidator._is_safe_hostname(hostname):
            raise ValueError(f"Unsafe hostname: {hostname}")

        username = parsed.username or "postgres"
        if not SecurityValidator._is_safe_identifier(username):
            raise ValueError(f"Unsafe username: {username}")

        database = parsed.path[1:] if parsed.path else "postgres"
        if not SecurityValidator._is_safe_identifier(database):
            raise ValueError(f"Unsafe database name: {database}")

        port = parsed.port or 5432
        if not (1 <= port <= 65535):
            raise ValueError(f"Invalid port: {port}")

        # Handle Docker host mapping
        if hostname in ["localhost", "127.0.0.1"]:
            try:
                with open("/proc/1/cgroup", "r") as f:
                    if "docker" in f.read():
                        hostname = "host.docker.internal"
            except (FileNotFoundError, PermissionError):
                pass

        return {
            "hostname": hostname,
            "port": str(port),
            "username": username,
            "password": parsed.password or "",
            "database": database,
            "url": database_url,
        }

    @staticmethod
    def validate_backup_path(backup_path: Path, allowed_dirs: list) -> bool:
        """Validate backup path is safe and within allowed directories."""
        try:
            resolved_path = backup_path.resolve()

            # Check if path is within allowed directories
            path_allowed = any(
                str(resolved_path).startswith(str(Path(allowed_dir).resolve()))
                for allowed_dir in allowed_dirs
            )

            if not path_allowed:
                logger.warning(f"Path outside allowed directories: {resolved_path}")
                return False

            # Basic filename safety check
            filename = backup_path.name
            if (
                any(char in filename for char in ["..", "\0", "|", "&", ";", "`"])
                or len(filename) > 255
            ):
                logger.warning(f"Unsafe filename: {filename}")
                return False

            # Verify file exists and is readable
            if not backup_path.exists() or not backup_path.is_file():
                logger.warning(f"File not found or not readable: {backup_path}")
                return False

            return True

        except Exception as e:
            logger.error(f"Path validation error: {str(e)}")
            return False

    @staticmethod
    def get_secure_docker_flags():
        """Get standard Docker security flags."""
        import os

        flags = [
            "--rm",
            "--security-opt",
            "no-new-privileges",
        ]

        # Add user mapping if available (Unix systems)
        if hasattr(os, "getuid"):
            flags.extend(["--user", f"{os.getuid()}:{os.getgid()}"])

        return flags

    @staticmethod
    def _is_safe_hostname(hostname: str) -> bool:
        """Validate hostname for basic safety."""
        if not hostname or len(hostname) > 253:
            return False

        # Allow common safe patterns
        pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$|^localhost$|^127\.|^host\.docker\.internal$"
        return bool(re.match(pattern, hostname))

    @staticmethod
    def _is_safe_identifier(identifier: str) -> bool:
        """Validate PostgreSQL identifier (username, database name)."""
        if not identifier or len(identifier) > 63:
            return False

        # PostgreSQL identifier pattern
        pattern = r"^[a-zA-Z_][a-zA-Z0-9_]*$"
        return bool(re.match(pattern, identifier))
