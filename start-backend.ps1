# PowerShell script to start FastAPI backend with virtual environment
Write-Host "Activating virtual environment and starting FastAPI backend..." -ForegroundColor Green

# Change to project directory
Set-Location "e:\Software\Projects\Medical Records-V2"

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# Start FastAPI server
Write-Host "Virtual environment activated." -ForegroundColor Green
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Cyan
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
