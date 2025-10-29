"""
Archive File Validation Utility

Provides security validation functions for ZIP and ISO archive files.
Implements protections against:
- ZIP bombs (decompression bombs)
- Path traversal (Zip Slip) attacks
- Malicious file content
- Resource exhaustion
- Nested archive attacks

See docs/ZIP_ISO_SECURITY_REQUIREMENTS.md for detailed security requirements.
"""

import os
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__)

# Security Limits (configurable via environment or config file)
MAX_COMPRESSION_RATIO = float(os.getenv("MAX_COMPRESSION_RATIO", "10.0"))
MAX_UNCOMPRESSED_SIZE = int(os.getenv("MAX_UNCOMPRESSED_SIZE", str(10 * 1024 * 1024 * 1024)))  # 10GB
MAX_FILES_IN_ARCHIVE = int(os.getenv("MAX_FILES_IN_ARCHIVE", "10000"))
MAX_SINGLE_FILE_SIZE = int(os.getenv("MAX_SINGLE_FILE_SIZE", str(500 * 1024 * 1024)))  # 500MB

# Prohibited file extensions (executables, scripts)
PROHIBITED_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr',  # Windows executables
    '.sh', '.bash', '.zsh', '.fish',  # Unix shells
    '.ps1', '.psm1', '.psd1',  # PowerShell
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',  # Scripts
    '.app', '.deb', '.rpm',  # Application packages
    '.jar',  # Java executables
}

# Archive file extensions (for nested archive detection)
ARCHIVE_EXTENSIONS = {'.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.iso', '.tar.gz', '.tar.bz2', '.tar.xz'}


@dataclass
class ValidationResult:
    """Result of archive validation."""
    is_valid: bool
    error_message: Optional[str] = None
    warnings: List[str] = None
    compression_ratio: Optional[float] = None
    file_count: Optional[int] = None
    total_uncompressed_size: Optional[int] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


@dataclass
class FileInfo:
    """Information about a file in an archive."""
    name: str
    size: int
    compressed_size: int
    path: str


def validate_zip_file(file_path: str) -> ValidationResult:
    """
    Comprehensive validation of a ZIP file.

    Performs all security checks:
    - ZIP integrity
    - Compression ratio (ZIP bomb detection)
    - File count limits
    - Path traversal attempts
    - Prohibited file types
    - Nested archives
    - Individual file size limits

    Args:
        file_path: Path to the ZIP file to validate

    Returns:
        ValidationResult with validation status and details
    """
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return ValidationResult(
                is_valid=False,
                error_message="File does not exist"
            )

        # Check ZIP integrity
        if not zipfile.is_zipfile(file_path):
            return ValidationResult(
                is_valid=False,
                error_message="File is not a valid ZIP archive"
            )

        # Check ZIP bomb
        is_safe, ratio, uncompressed_size = check_zip_bomb(file_path)
        if not is_safe:
            logger.warning(
                f"ZIP bomb detected: compression ratio {ratio:.2f}:1",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "zip_bomb_detected",
                    "compression_ratio": ratio,
                    "uncompressed_size": uncompressed_size,
                    "file": file_path
                }
            )
            return ValidationResult(
                is_valid=False,
                error_message=f"Suspicious compression ratio detected ({ratio:.2f}:1). Maximum allowed: {MAX_COMPRESSION_RATIO}:1",
                compression_ratio=ratio
            )

        # Check file count
        is_safe, file_count = check_file_count(file_path)
        if not is_safe:
            return ValidationResult(
                is_valid=False,
                error_message=f"Archive exceeds file count limit ({file_count} files). Maximum allowed: {MAX_FILES_IN_ARCHIVE}",
                file_count=file_count
            )

        # Check for path traversal
        unsafe_paths = check_path_traversal(file_path)
        if unsafe_paths:
            logger.error(
                f"Path traversal attempt detected in archive",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "path_traversal_attempt",
                    "file": file_path,
                    "unsafe_paths": unsafe_paths[:5]  # Log first 5
                }
            )
            return ValidationResult(
                is_valid=False,
                error_message=f"Invalid file paths detected in archive (possible path traversal attack)"
            )

        # Check for prohibited file types
        prohibited_files = check_prohibited_files(file_path)
        if prohibited_files:
            logger.warning(
                f"Prohibited file types found in archive",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "prohibited_files_detected",
                    "file": file_path,
                    "prohibited_count": len(prohibited_files),
                    "prohibited_files": prohibited_files[:10]  # Log first 10
                }
            )
            return ValidationResult(
                is_valid=False,
                error_message=f"Prohibited file types detected: {', '.join(prohibited_files[:5])}"
            )

        # Check for nested archives (warning only)
        nested_archives = check_nested_archives(file_path)
        warnings = []
        if nested_archives:
            warnings.append(f"Archive contains nested archives: {', '.join(nested_archives[:3])}")
            logger.info(
                f"Nested archives detected",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "nested_archive_detected",
                    "file": file_path,
                    "nested_count": len(nested_archives)
                }
            )

        # All checks passed
        logger.info(
            f"Archive validation successful",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "archive_validated",
                "file": file_path,
                "compression_ratio": ratio,
                "file_count": file_count,
                "uncompressed_size": uncompressed_size
            }
        )

        return ValidationResult(
            is_valid=True,
            compression_ratio=ratio,
            file_count=file_count,
            total_uncompressed_size=uncompressed_size,
            warnings=warnings
        )

    except Exception as e:
        logger.error(
            f"Error validating ZIP file",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "archive_validation_error",
                LogFields.ERROR: str(e),
                "file": file_path
            }
        )
        return ValidationResult(
            is_valid=False,
            error_message=f"Validation error: {str(e)}"
        )


def check_zip_bomb(file_path: str) -> Tuple[bool, float, int]:
    """
    Check if ZIP file is a potential bomb (high compression ratio).

    Args:
        file_path: Path to the ZIP file

    Returns:
        Tuple of (is_safe, compression_ratio, total_uncompressed_size)
    """
    compressed_size = os.path.getsize(file_path)
    total_uncompressed = 0

    with zipfile.ZipFile(file_path, 'r') as zf:
        for info in zf.infolist():
            # Skip directories
            if info.is_dir():
                continue

            total_uncompressed += info.file_size

            # Early exit if exceeding limits
            if total_uncompressed > MAX_UNCOMPRESSED_SIZE:
                ratio = total_uncompressed / compressed_size if compressed_size > 0 else 0
                return False, ratio, total_uncompressed

            # Check individual file size
            if info.file_size > MAX_SINGLE_FILE_SIZE:
                logger.warning(
                    f"Large file detected in archive: {info.filename} ({info.file_size} bytes)",
                    extra={
                        LogFields.CATEGORY: "security",
                        LogFields.EVENT: "large_file_in_archive",
                        "filename": info.filename,
                        "file_size": info.file_size
                    }
                )

    # Calculate compression ratio
    compression_ratio = total_uncompressed / compressed_size if compressed_size > 0 else 0

    # Check if ratio exceeds limit
    is_safe = compression_ratio <= MAX_COMPRESSION_RATIO

    return is_safe, compression_ratio, total_uncompressed


def check_file_count(file_path: str) -> Tuple[bool, int]:
    """
    Check if archive has reasonable file count.

    Args:
        file_path: Path to the ZIP file

    Returns:
        Tuple of (is_safe, file_count)
    """
    with zipfile.ZipFile(file_path, 'r') as zf:
        # Count actual files (exclude directories)
        file_count = sum(1 for info in zf.infolist() if not info.is_dir())

        is_safe = file_count <= MAX_FILES_IN_ARCHIVE

        return is_safe, file_count


def check_path_traversal(file_path: str) -> List[str]:
    """
    Check for path traversal attempts in archive file paths.

    Detects:
    - Paths containing '..'
    - Absolute paths (starting with / or drive letter)
    - Paths that resolve outside intended directory

    Args:
        file_path: Path to the ZIP file

    Returns:
        List of unsafe file paths found
    """
    unsafe_paths = []

    with zipfile.ZipFile(file_path, 'r') as zf:
        for filename in zf.namelist():
            # Check for '..' in path
            if '..' in filename:
                unsafe_paths.append(filename)
                continue

            # Check for absolute paths
            if filename.startswith('/') or filename.startswith('\\'):
                unsafe_paths.append(filename)
                continue

            # Check for drive letters (Windows absolute paths)
            if len(filename) >= 2 and filename[1] == ':':
                unsafe_paths.append(filename)
                continue

            # Validate path resolves within base directory
            if not validate_path_safety(filename):
                unsafe_paths.append(filename)

    return unsafe_paths


def validate_path_safety(file_path: str, base_dir: str = '.') -> bool:
    """
    Validate that a file path is safe for extraction.

    Uses Path.resolve() to check if the resolved path stays within
    the base directory.

    Args:
        file_path: The file path to validate
        base_dir: Base directory for extraction (default: current dir)

    Returns:
        True if path is safe, False otherwise
    """
    try:
        base_path = Path(base_dir).resolve()
        target_path = (base_path / file_path).resolve()

        # Check if resolved path is within base directory
        # For Python 3.9+, use is_relative_to()
        # For older Python, use string comparison
        try:
            is_safe = target_path.is_relative_to(base_path)
        except AttributeError:
            # Fallback for Python < 3.9
            is_safe = str(target_path).startswith(str(base_path))

        return is_safe

    except (ValueError, OSError):
        # Any error in path resolution is suspicious
        return False


def check_prohibited_files(file_path: str) -> List[str]:
    """
    Check for prohibited file types within archive.

    Prohibited types include executables and scripts that could
    pose security risks.

    Args:
        file_path: Path to the ZIP file

    Returns:
        List of prohibited files found
    """
    prohibited_files = []

    with zipfile.ZipFile(file_path, 'r') as zf:
        for filename in zf.namelist():
            ext = Path(filename).suffix.lower()
            if ext in PROHIBITED_EXTENSIONS:
                prohibited_files.append(filename)

    return prohibited_files


def check_nested_archives(file_path: str) -> List[str]:
    """
    Detect nested archive files within the upload.

    Nested archives can be used for archive bomb attacks.

    Args:
        file_path: Path to the ZIP file

    Returns:
        List of archive files found within the ZIP
    """
    nested_archives = []

    with zipfile.ZipFile(file_path, 'r') as zf:
        for filename in zf.namelist():
            ext = Path(filename).suffix.lower()
            if ext in ARCHIVE_EXTENSIONS:
                nested_archives.append(filename)

    return nested_archives


def scan_zip_contents(file_path: str) -> List[FileInfo]:
    """
    Scan ZIP file and extract information about all files.

    Args:
        file_path: Path to the ZIP file

    Returns:
        List of FileInfo objects
    """
    file_list = []

    with zipfile.ZipFile(file_path, 'r') as zf:
        for info in zf.infolist():
            # Skip directories
            if info.is_dir():
                continue

            file_list.append(FileInfo(
                name=Path(info.filename).name,
                size=info.file_size,
                compressed_size=info.compress_size,
                path=info.filename
            ))

    return file_list


def validate_iso_file(file_path: str) -> ValidationResult:
    """
    Validate ISO 9660 file format.

    Checks:
    - File size limits
    - ISO format validity

    Note: Requires pycdlib library

    Args:
        file_path: Path to the ISO file

    Returns:
        ValidationResult with validation status
    """
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return ValidationResult(
                is_valid=False,
                error_message="File does not exist"
            )

        # Check file size (should not exceed max archive size)
        file_size = os.path.getsize(file_path)
        max_size = 1024 * 1024 * 1024  # 1GB
        if file_size > max_size:
            return ValidationResult(
                is_valid=False,
                error_message=f"ISO file too large ({file_size} bytes). Maximum: {max_size} bytes"
            )

        # Try to import pycdlib
        try:
            import pycdlib
        except ImportError:
            logger.warning(
                "pycdlib not installed, skipping detailed ISO validation",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "iso_validation_skipped"
                }
            )
            # Basic validation only (file exists and size OK)
            return ValidationResult(
                is_valid=True,
                warnings=["Detailed ISO validation skipped (pycdlib not installed)"]
            )

        # Validate ISO format
        iso = pycdlib.PyCdlib()
        try:
            iso.open(file_path)

            # Extract volume information
            pvd = iso.pvd
            volume_id = pvd.volume_identifier.decode('utf-8').strip()

            logger.info(
                f"ISO validation successful",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "iso_validated",
                    "file": file_path,
                    "volume_id": volume_id,
                    "file_size": file_size
                }
            )

            iso.close()

            return ValidationResult(
                is_valid=True,
                total_uncompressed_size=file_size
            )

        except Exception as e:
            logger.error(
                f"Invalid ISO file format",
                extra={
                    LogFields.CATEGORY: "security",
                    LogFields.EVENT: "iso_validation_failed",
                    LogFields.ERROR: str(e),
                    "file": file_path
                }
            )
            return ValidationResult(
                is_valid=False,
                error_message=f"Invalid ISO file format: {str(e)}"
            )

    except Exception as e:
        logger.error(
            f"Error validating ISO file",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "iso_validation_error",
                LogFields.ERROR: str(e),
                "file": file_path
            }
        )
        return ValidationResult(
            is_valid=False,
            error_message=f"Validation error: {str(e)}"
        )


def get_archive_type(file_path: str) -> Optional[str]:
    """
    Determine the type of archive file.

    Args:
        file_path: Path to the archive file

    Returns:
        'zip', 'iso', or None if unknown
    """
    ext = Path(file_path).suffix.lower()

    if ext == '.zip':
        return 'zip'
    elif ext == '.iso':
        return 'iso'
    else:
        # Try to detect by content
        if zipfile.is_zipfile(file_path):
            return 'zip'
        return None
