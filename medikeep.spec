# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for MediKeep Windows EXE.

This spec file builds a standalone Windows executable with:
- FastAPI backend bundled
- SQLite database support
- PDF text extraction (Poppler + Tesseract)
- All dependencies included
- Frontend static files

Build command:
    pyinstaller medikeep.spec

Output:
    dist/MediKeep.exe - Standalone executable
    dist/_internal/    - Required libraries and data files
"""

import os
import sys
from pathlib import Path

# Get the project root directory
project_root = Path(SPECPATH).resolve()

# Define data files to include
datas = []

# Add the app package as data files (CRITICAL: Must be included for imports to work)
if (project_root / 'app').exists():
    datas.append(('app', 'app'))
    print("[OK] Including app package")

# Add system tray icon for the packaged EXE
tray_icon = project_root / 'frontend' / 'public' / 'icon-64.png'
if tray_icon.exists():
    datas.append(('frontend/public/icon-64.png', 'frontend/build'))
    print("[OK] Including tray icon (icon-64.png)")

# Add frontend build if it exists (Create React App builds to 'build' directory)
if (project_root / 'frontend' / 'build').exists():
    datas.append(('frontend/build', 'frontend/build'))
    print("[OK] Including frontend build")
else:
    print("[SKIP] Frontend not built - run 'npm run build' in frontend/ to include")

# Add Alembic migrations if they exist
if (project_root / 'alembic').exists():
    datas.append(('alembic', 'alembic'))
    print("[OK] Including Alembic migrations")

# Add .env.example if it exists
if (project_root / '.env.example').exists():
    datas.append(('.env.example', '.'))
    print("[OK] Including .env.example")

# Define hidden imports (modules not automatically detected)
hiddenimports = [
    # MediKeep app modules (CRITICAL: Must be explicitly imported)
    'app.main',
    'app.core.config',
    'app.core.database',
    'app.core.logging_config',
    'app.core.windows_config',
    'app.core.external_binaries',
    'app.core.system_tray',

    # Alembic (for database migrations)
    'alembic',
    'alembic.command',
    'alembic.config',
    'alembic.script',
    'alembic.runtime',
    'alembic.runtime.migration',
    'alembic.runtime.environment',

    # FastAPI and dependencies
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',

    # SQLAlchemy and database
    'sqlalchemy.ext.baked',
    'sqlalchemy.sql.default_comparator',

    # Pydantic
    'pydantic.deprecated.decorator',

    # PDF processing
    'pdfplumber',
    'pdf2image',
    'pytesseract',
    'PIL._imagingtk',
    'PIL._tkinter_finder',

    # System tray
    'pystray',
    'pystray._win32',

    # Other critical imports
    'passlib.handlers.bcrypt',
    'python_dotenv',
]

# Binary files to exclude (reduce size)
excludes = [
    # Exclude development/testing tools
    'pytest',
    'coverage',
    'black',
    'pylint',
    'mypy',

    # Exclude unused modules
    'tkinter',
    'matplotlib',
    'IPython',
    'jupyter',

    # Exclude server-only databases
    'psycopg2',  # PostgreSQL - not needed in Windows EXE (uses SQLite)
    'asyncpg',
]

# Analysis: Collect all Python files and dependencies
a = Analysis(
    ['run.py'],  # Entry point
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

# PYZ: Create Python archive
pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=None,
)

# EXE: Create executable
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,  # Use COLLECT for multi-file distribution
    name='MediKeep',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Compress with UPX
    console=False,  # Windowed mode - runs in background with system tray
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='medikeep.ico',
    version_file=None,  # TODO: Add version info when available
)

# Get version directly from config.py file without importing
# This avoids circular import issues during build
import re
config_file = project_root / 'app' / 'core' / 'config.py'
with open(config_file, 'r') as f:
    config_content = f.read()
    version_match = re.search(r'VERSION:\s*str\s*=\s*["\']([^"\']+)["\']', config_content)
    if version_match:
        APP_VERSION = version_match.group(1)
    else:
        APP_VERSION = "0.0.0"  # Fallback
        print("WARNING: Could not extract version from config.py")

print(f"Building MediKeep version {APP_VERSION}")

# COLLECT: Gather all files into distribution folder with version in folder name
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=f'MediKeep-v{APP_VERSION}',
)

# Post-build notes:
# After building, you need to manually add to dist/MediKeep/:
#
# 1. External binaries (PDF text extraction):
#    - poppler/bin/        (pdftotext.exe, pdfimages.exe, etc.)
#    - tesseract/          (tesseract.exe)
#    - tesseract/tessdata/ (eng.traineddata, osd.traineddata)
#
# 2. Frontend (if not already included):
#    - frontend/dist/      (React build output)
#
# Directory structure should be:
# dist/
#   MediKeep/
#     MediKeep.exe
#     _internal/
#       (Python libraries, dependencies)
#       poppler/
#         bin/
#           pdftotext.exe
#           pdfimages.exe
#           pdfinfo.exe
#       tesseract/
#         tesseract.exe
#         tessdata/
#           eng.traineddata
#           osd.traineddata
#       frontend/
#         dist/
#           (React build files)
