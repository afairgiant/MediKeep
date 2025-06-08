# Start development environment
# This script starts both the FastAPI backend and React frontend

Write-Host "Starting Medical Records Development Environment..." -ForegroundColor Green

# Set the base directory
$BASE_DIR = $PSScriptRoot

# Start backend in a new PowerShell window
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {
    Set-Location '$BASE_DIR'
    & .\.venv\Scripts\Activate.ps1
    $env:DEBUG = 'True'
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
}"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting React frontend on port 3000..." -ForegroundColor Blue
Set-Location "$BASE_DIR\frontend"
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm start

Write-Host "Development environment started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend API: http://localhost:3000/api" -ForegroundColor Yellow
Write-Host "API Docs: http://localhost:3000/docs" -ForegroundColor Yellow
