# Start development environment
# This script starts PostgreSQL in Docker, then the FastAPI backend and React frontend locally

Write-Host "Starting Medical Records Development Environment..." -ForegroundColor Green

# Set the base directory
$BASE_DIR = $PSScriptRoot

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Blue
try {
    docker info | Out-Null
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start PostgreSQL container
Write-Host "Starting PostgreSQL container..." -ForegroundColor Blue
Set-Location "$BASE_DIR\docker"
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 5

# Load development environment variables
Set-Location $BASE_DIR
if (Test-Path ".env.development") {
    Get-Content ".env.development" | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "Set $name" -ForegroundColor Gray
        }
    }
    Write-Host "Development environment variables loaded" -ForegroundColor Green
}

# Start backend in a new PowerShell window
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {
    Set-Location '$BASE_DIR'
    # Load environment variables
    if (Test-Path '.env.development') {
        Get-Content '.env.development' | ForEach-Object {
            if (`$_ -match '^([^#=]+)=(.*)$') {
                `$name = `$matches[1].Trim()
                `$value = `$matches[2].Trim()
                [Environment]::SetEnvironmentVariable(`$name, `$value, 'Process')
            }
        }
    }
    & .\.venv\Scripts\Activate.ps1
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
Write-Host "PostgreSQL: localhost:5432 (running in Docker)" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend API: http://localhost:3000/api" -ForegroundColor Yellow
Write-Host "API Docs: http://localhost:3000/docs" -ForegroundColor Yellow
Write-Host "" -ForegroundColor White
Write-Host "To stop PostgreSQL: docker-compose -f docker/docker-compose.yml down" -ForegroundColor Cyan
