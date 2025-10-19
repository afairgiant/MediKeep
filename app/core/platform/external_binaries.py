"""
External binary management for Windows EXE deployment.

Handles Poppler and Tesseract OCR binaries that are bundled with the
Windows executable for PDF text extraction functionality.
"""
import os
import sys
from pathlib import Path
from typing import Optional
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.platform.windows_config import is_windows_exe

logger = get_logger(__name__, "app")


def get_poppler_path() -> Optional[Path]:
    r"""
    Get the path to Poppler binaries (pdftotext, pdfimages, etc.).

    Returns:
        Path to poppler/bin directory
        - Windows EXE: bundled in _internal/poppler/bin
        - Development: expects poppler in PATH or downloads automatically

    Example Windows EXE structure:
        MediKeep.exe
        _internal/
            poppler/
                bin/
                    pdftotext.exe
                    pdfimages.exe
                    pdfinfo.exe
    """
    if is_windows_exe():
        # PyInstaller onedir mode: binaries in _internal directory next to EXE
        if hasattr(sys, '_MEIPASS'):
            # Running from temporary extraction directory (onefile mode or debug)
            base_path = Path(sys._MEIPASS)
        else:
            # Running from installed location (onedir mode)
            # Check for _internal directory first (PyInstaller standard structure)
            exe_dir = Path(sys.executable).parent
            internal_dir = exe_dir / "_internal"
            if internal_dir.exists():
                base_path = internal_dir
            else:
                # Fallback: binaries next to EXE (older structure)
                base_path = exe_dir

        poppler_bin = base_path / "poppler" / "bin"

        if poppler_bin.exists():
            logger.info(f"Using bundled Poppler from: {poppler_bin}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "poppler_path_found",
                "path": str(poppler_bin)
            })
            return poppler_bin
        else:
            logger.warning(f"Poppler not found at expected path: {poppler_bin}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "poppler_not_found",
                "expected_path": str(poppler_bin)
            })
            return None
    else:
        # Development mode - return None (will use system PATH)
        logger.debug("Development mode - using system Poppler from PATH", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "poppler_system_path"
        })
        return None


def get_tesseract_path() -> Optional[Path]:
    r"""
    Get the path to Tesseract OCR executable.

    Returns:
        Path to tesseract.exe
        - Windows EXE: bundled in _internal/tesseract/tesseract.exe
        - Development: expects tesseract in PATH or downloads automatically

    Example Windows EXE structure:
        MediKeep.exe
        _internal/
            tesseract/
                tesseract.exe
                tessdata/
                    eng.traineddata
                    osd.traineddata
    """
    if is_windows_exe():
        # PyInstaller onedir mode: binaries in _internal directory next to EXE
        if hasattr(sys, '_MEIPASS'):
            # Running from temporary extraction directory (onefile mode or debug)
            base_path = Path(sys._MEIPASS)
        else:
            # Running from installed location (onedir mode)
            # Check for _internal directory first (PyInstaller standard structure)
            exe_dir = Path(sys.executable).parent
            internal_dir = exe_dir / "_internal"
            if internal_dir.exists():
                base_path = internal_dir
            else:
                # Fallback: binaries next to EXE (older structure)
                base_path = exe_dir

        tesseract_exe = base_path / "tesseract" / "tesseract.exe"

        if tesseract_exe.exists():
            logger.info(f"Using bundled Tesseract from: {tesseract_exe}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "tesseract_path_found",
                "path": str(tesseract_exe)
            })
            return tesseract_exe
        else:
            logger.warning(f"Tesseract not found at expected path: {tesseract_exe}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "tesseract_not_found",
                "expected_path": str(tesseract_exe)
            })
            return None
    else:
        # Development mode - return None (will use system PATH)
        logger.debug("Development mode - using system Tesseract from PATH", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "tesseract_system_path"
        })
        return None


def get_tessdata_path() -> Optional[Path]:
    r"""
    Get the path to Tesseract language data directory.

    Returns:
        Path to tessdata directory containing .traineddata files
        - Windows EXE: bundled in _internal/tesseract/tessdata
        - Development: uses system tessdata location

    Example structure:
        tessdata/
            eng.traineddata  (English)
            osd.traineddata  (Orientation and script detection)
    """
    if is_windows_exe():
        tesseract_exe = get_tesseract_path()
        if tesseract_exe:
            tessdata_dir = tesseract_exe.parent / "tessdata"
            if tessdata_dir.exists():
                logger.info(f"Using bundled tessdata from: {tessdata_dir}", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "tessdata_path_found",
                    "path": str(tessdata_dir)
                })
                return tessdata_dir
            else:
                logger.warning(f"Tessdata not found at expected path: {tessdata_dir}", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "tessdata_not_found",
                    "expected_path": str(tessdata_dir)
                })
                return None
        else:
            return None
    else:
        # Development mode - return None (will use system tessdata)
        return None


def verify_external_binaries() -> dict:
    """
    Verify that all required external binaries are available.

    Returns:
        Dictionary with verification results:
        {
            'poppler': {'available': bool, 'path': str/None},
            'tesseract': {'available': bool, 'path': str/None},
            'tessdata': {'available': bool, 'path': str/None},
            'all_available': bool
        }
    """
    results = {}

    # Check Poppler
    poppler_path = get_poppler_path()
    results['poppler'] = {
        'available': poppler_path is not None and poppler_path.exists(),
        'path': str(poppler_path) if poppler_path else None
    }

    # Check Tesseract
    tesseract_path = get_tesseract_path()
    results['tesseract'] = {
        'available': tesseract_path is not None and tesseract_path.exists(),
        'path': str(tesseract_path) if tesseract_path else None
    }

    # Check Tessdata
    tessdata_path = get_tessdata_path()
    results['tessdata'] = {
        'available': tessdata_path is not None and tessdata_path.exists(),
        'path': str(tessdata_path) if tessdata_path else None
    }

    # Overall availability
    results['all_available'] = all(
        results[key]['available'] for key in ['poppler', 'tesseract', 'tessdata']
    )

    logger.info("External binaries verification complete", extra={
        LogFields.CATEGORY: "app",
        LogFields.EVENT: "external_binaries_verified",
        "poppler_available": results['poppler']['available'],
        "tesseract_available": results['tesseract']['available'],
        "tessdata_available": results['tessdata']['available'],
        "all_available": results['all_available']
    })

    return results


def configure_environment_for_binaries() -> None:
    """
    Configure environment variables for external binaries.

    Sets up PATH and other environment variables needed for
    Poppler and Tesseract to work correctly.
    """
    if not is_windows_exe():
        logger.debug("Not Windows EXE - skipping binary environment configuration", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "skip_binary_env_config"
        })
        return

    # Add Poppler to PATH
    poppler_path = get_poppler_path()
    if poppler_path:
        current_path = os.environ.get('PATH', '')
        if str(poppler_path) not in current_path:
            os.environ['PATH'] = f"{poppler_path}{os.pathsep}{current_path}"
            logger.info(f"Added Poppler to PATH: {poppler_path}", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "poppler_added_to_path",
                "path": str(poppler_path)
            })

    # Set TESSDATA_PREFIX for Tesseract
    tessdata_path = get_tessdata_path()
    if tessdata_path:
        os.environ['TESSDATA_PREFIX'] = str(tessdata_path.parent)
        logger.info(f"Set TESSDATA_PREFIX: {tessdata_path.parent}", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "tessdata_prefix_set",
            "path": str(tessdata_path.parent)
        })

    logger.info("External binary environment configured", extra={
        LogFields.CATEGORY: "app",
        LogFields.EVENT: "binary_env_configured"
    })
