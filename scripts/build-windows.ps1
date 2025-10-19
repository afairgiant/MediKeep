# MediKeep Windows EXE Build Script
# Builds a standalone Windows executable using PyInstaller

param(
    [switch]$Clean = $false,
    [switch]$SkipTests = $false,
    [switch]$SkipFrontend = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MediKeep Windows EXE Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ProjectRoot = $PSScriptRoot
$DistDir = Join-Path $ProjectRoot "dist"
$BuildDir = Join-Path $ProjectRoot "build"
$OutputDir = Join-Path $DistDir "MediKeep"
$InternalDir = Join-Path $OutputDir "_internal"

# External binaries paths (you need to download these separately)
$PopplerSource = "C:\Program Files\poppler\Library\bin"  # Adjust to your poppler installation
$TesseractSource = "C:\Program Files\Tesseract-OCR"      # Adjust to your tesseract installation

# Step 1: Clean previous builds
if ($Clean) {
    Write-Host "[1/7] Cleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path $DistDir) {
        Remove-Item -Path $DistDir -Recurse -Force
        Write-Host "  Removed dist/" -ForegroundColor Gray
    }
    if (Test-Path $BuildDir) {
        Remove-Item -Path $BuildDir -Recurse -Force
        Write-Host "  Removed build/" -ForegroundColor Gray
    }
    Write-Host "  Clean complete" -ForegroundColor Green
} else {
    Write-Host "[1/7] Skipping clean (use -Clean to clean builds)" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Run tests
if (-not $SkipTests) {
    Write-Host "[2/7] Running tests..." -ForegroundColor Yellow
    & .venv\Scripts\python.exe -m pytest tests/ -v --tb=short
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Tests failed! Build aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Tests passed" -ForegroundColor Green
} else {
    Write-Host "[2/7] Skipping tests (use -SkipTests:$false to run)" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Build frontend
if (-not $SkipFrontend) {
    Write-Host "[3/7] Building frontend..." -ForegroundColor Yellow
    Push-Location frontend
    if (Test-Path "package.json") {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Frontend build failed! Build aborted." -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Write-Host "  Frontend build complete" -ForegroundColor Green
    } else {
        Write-Host "  No package.json found, skipping frontend" -ForegroundColor Gray
    }
    Pop-Location
} else {
    Write-Host "[3/7] Skipping frontend build" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Build executable with PyInstaller
Write-Host "[4/7] Building executable with PyInstaller..." -ForegroundColor Yellow
& .venv\Scripts\python.exe -m PyInstaller medikeep.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "  PyInstaller build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  PyInstaller build complete" -ForegroundColor Green
Write-Host ""

# Step 5: Copy external binaries
Write-Host "[5/7] Copying external binaries..." -ForegroundColor Yellow

# Copy Poppler
if (Test-Path $PopplerSource) {
    $PopplerDest = Join-Path $InternalDir "poppler\bin"
    New-Item -ItemType Directory -Force -Path $PopplerDest | Out-Null
    Copy-Item -Path "$PopplerSource\*" -Destination $PopplerDest -Recurse -Force
    Write-Host "  Copied Poppler binaries" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Poppler not found at $PopplerSource" -ForegroundColor Yellow
    Write-Host "  PDF text extraction will not work without Poppler!" -ForegroundColor Yellow
}

# Copy Tesseract
if (Test-Path $TesseractSource) {
    $TesseractDest = Join-Path $InternalDir "tesseract"
    New-Item -ItemType Directory -Force -Path $TesseractDest | Out-Null

    # Copy tesseract.exe
    Copy-Item -Path "$TesseractSource\tesseract.exe" -Destination $TesseractDest -Force

    # Copy tessdata
    if (Test-Path "$TesseractSource\tessdata") {
        Copy-Item -Path "$TesseractSource\tessdata" -Destination $TesseractDest -Recurse -Force
    }

    Write-Host "  Copied Tesseract OCR" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Tesseract not found at $TesseractSource" -ForegroundColor Yellow
    Write-Host "  OCR functionality will not work without Tesseract!" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Create README for distribution
Write-Host "[6/7] Creating distribution README..." -ForegroundColor Yellow
$ReadmeContent = @"
# MediKeep - Medical Records Management System

Version: $(Get-Date -Format "yyyy.MM.dd")
Built: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## First Run

1. Double-click MediKeep.exe to start the application
2. The application will create a database in %APPDATA%\Roaming\MediKeep\
3. Default admin credentials:
   - Username: admin
   - Password: admin123
   - **IMPORTANT: Change this password immediately after first login!**

## Data Location

All data is stored in: %APPDATA%\Roaming\MediKeep\
- database/    - SQLite database
- uploads/     - Patient photos and documents
- logs/        - Application logs
- temp/        - Temporary files

## Accessing the Application

After starting MediKeep.exe:
- Open your web browser
- Navigate to: http://127.0.0.1:8000

## Troubleshooting

If the application fails to start:
1. Check logs in: %APPDATA%\Roaming\MediKeep\logs\
2. Ensure no other application is using port 8000
3. Run as Administrator if you encounter permission issues

## Support

For issues and support, visit: https://github.com/afairgiant/MediKeep
"@

$ReadmePath = Join-Path $OutputDir "README.txt"
$ReadmeContent | Out-File -FilePath $ReadmePath -Encoding UTF8
Write-Host "  Created README.txt" -ForegroundColor Green
Write-Host ""

# Step 7: Summary
Write-Host "[7/7] Build Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

$ExePath = Join-Path $OutputDir "MediKeep.exe"
if (Test-Path $ExePath) {
    $ExeSize = (Get-Item $ExePath).Length / 1MB
    Write-Host "  Executable: MediKeep.exe ($([math]::Round($ExeSize, 2)) MB)" -ForegroundColor Green
    Write-Host "  Location: $ExePath" -ForegroundColor Green

    # Check for required external binaries
    $PopplerExists = Test-Path (Join-Path $InternalDir "poppler\bin\pdftotext.exe")
    $TesseractExists = Test-Path (Join-Path $InternalDir "tesseract\tesseract.exe")

    Write-Host ""
    Write-Host "  Components:" -ForegroundColor Cyan
    Write-Host "    Python Runtime:    " -NoNewline; Write-Host "Included" -ForegroundColor Green
    Write-Host "    FastAPI Backend:   " -NoNewline; Write-Host "Included" -ForegroundColor Green
    Write-Host "    SQLite Database:   " -NoNewline; Write-Host "Included" -ForegroundColor Green
    Write-Host "    Frontend Files:    " -NoNewline; Write-Host "Included" -ForegroundColor Green
    Write-Host "    Poppler (PDF):     " -NoNewline
    if ($PopplerExists) {
        Write-Host "Included" -ForegroundColor Green
    } else {
        Write-Host "MISSING" -ForegroundColor Red
    }
    Write-Host "    Tesseract (OCR):   " -NoNewline
    if ($TesseractExists) {
        Write-Host "Included" -ForegroundColor Green
    } else {
        Write-Host "MISSING" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "  Build complete!" -ForegroundColor Green
    Write-Host "  Distribution folder: $OutputDir" -ForegroundColor Cyan

    if (-not ($PopplerExists -and $TesseractExists)) {
        Write-Host ""
        Write-Host "  WARNING: Some external binaries are missing!" -ForegroundColor Yellow
        Write-Host "  Update paths at the top of this script and re-run." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ERROR: Build failed - executable not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
