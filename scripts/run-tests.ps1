# Medical Records Application - Test Runner Script (PowerShell)
# This script provides easy testing for the application

param(
    [string]$Command = "help",
    [string]$Option = "all"
)

# Configuration
$FRONTEND_DIR = "frontend"
$BACKEND_DIR = "."
$TEST_COMPOSE_FILE = "docker-compose.test.yml"

# Helper functions
function Log-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Blue
}

function Log-Success($message) {
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Log-Warning($message) {
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Log-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# Check if required tools are installed
function Check-Dependencies {
    $deps = @("node", "npm", "python", "pip", "docker", "docker-compose")
    $missing = @()
    
    foreach ($dep in $deps) {
        if (!(Get-Command $dep -ErrorAction SilentlyContinue)) {
            $missing += $dep
        }
    }
    
    if ($missing.Count -gt 0) {
        Log-Error "Missing dependencies: $($missing -join ', ')"
        Log-Info "Please install the missing dependencies and try again"
        exit 1
    }
}

# Frontend tests
function Run-FrontendTests($testType = "all") {
    Log-Info "Running frontend tests..."
    
    Push-Location $FRONTEND_DIR
    
    try {
        # Install dependencies if needed
        if (!(Test-Path "node_modules")) {
            Log-Info "Installing frontend dependencies..."
            npm ci
        }
        
        # Run tests based on arguments
        switch ($testType) {
            "unit" {
                Log-Info "Running frontend unit tests..."
                npm test -- --coverage --watchAll=false
            }
            "lint" {
                Log-Info "Running frontend linting..."
                try { npm run lint } catch { }
            }
            "coverage" {
                Log-Info "Running frontend tests with coverage..."
                npm run test:coverage
            }
            "forms" {
                Log-Info "Running medical form component tests..."
                npm test -- --testPathPattern="components/medical/__tests__" --watchAll=false
            }
            default {
                Log-Info "Running all frontend tests..."
                try { npm run lint } catch { }
                npm test -- --coverage --watchAll=false
            }
        }
        
        Log-Success "Frontend tests completed"
    }
    finally {
        Pop-Location
    }
}

# Backend tests
function Run-BackendTests($testType = "all") {
    Log-Info "Running backend tests..."
    
    # Set test environment variables
    $env:TESTING = "1"
    $env:SECRET_KEY = "test-secret-key"
    $env:DATABASE_URL = "sqlite:///./test.db"
    $env:LOG_LEVEL = "WARNING"
    
    # Install dependencies if needed
    try {
        python -c "import pytest" 2>$null
    }
    catch {
        Log-Info "Installing backend test dependencies..."
        pip install pytest pytest-asyncio pytest-cov httpx faker
    }
    
    # Run tests based on arguments
    switch ($testType) {
        "unit" {
            Log-Info "Running backend unit tests..."
            pytest tests/test_basic.py -v
        }
        "api" {
            Log-Info "Running API tests..."
            pytest tests/api/ -v
        }
        "crud" {
            Log-Info "Running CRUD tests..."
            pytest tests/crud/ -v
        }
        "crud-patient" {
            Log-Info "Running Patient CRUD tests..."
            pytest tests/crud/test_patient.py -v
        }
        "crud-medication" {
            Log-Info "Running Medication CRUD tests..."
            pytest tests/crud/test_medication.py -v
        }
        "crud-allergy" {
            Log-Info "Running Allergy CRUD tests..."
            pytest tests/crud/test_allergy.py -v
        }
        "crud-vitals" {
            Log-Info "Running Vitals CRUD tests..."
            pytest tests/crud/test_vitals.py -v
        }
        "crud-procedure" {
            Log-Info "Running Procedure CRUD tests..."
            pytest tests/crud/test_procedure.py -v
        }
        "crud-lab-result" {
            Log-Info "Running Lab Result CRUD tests..."
            pytest tests/crud/test_lab_result.py -v
        }
        "crud-condition" {
            Log-Info "Running Condition CRUD tests..."
            pytest tests/crud/test_condition.py -v
        }
        "crud-immunization" {
            Log-Info "Running Immunization CRUD tests..."
            pytest tests/crud/test_immunization.py -v
        }
        "crud-emergency-contact" {
            Log-Info "Running Emergency Contact CRUD tests..."
            pytest tests/crud/test_emergency_contact.py -v
        }
        "integration" {
            Log-Info "Running integration tests..."
            pytest tests/e2e/ -v
        }
        "coverage" {
            Log-Info "Running backend tests with coverage..."
            pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
        }
        "lint" {
            Log-Info "Running backend linting..."
            if (Get-Command flake8 -ErrorAction SilentlyContinue) {
                try { flake8 app tests --max-line-length=88 --extend-ignore=E203,W503 } catch { }
            }
            if (Get-Command black -ErrorAction SilentlyContinue) {
                try { black --check app tests } catch { }
            }
        }
        default {
            Log-Info "Running all backend tests..."
            pytest tests/ -v --cov=app --cov-report=term-missing
        }
    }
    
    Log-Success "Backend tests completed"
}

# Container tests
function Run-ContainerTests($testType = "build") {
    Log-Info "Running container tests..."
    
    switch ($testType) {
        "build" {
            Log-Info "Building and testing container..."
            docker build -f docker/Dockerfile.test -t medical-records:test .
            Log-Success "Container built successfully"
        }
        "integration" {
            Log-Info "Running container integration tests..."
            docker-compose -f $TEST_COMPOSE_FILE up --abort-on-container-exit backend-integration-tests
        }
        "e2e" {
            Log-Info "Running end-to-end tests..."
            docker-compose -f $TEST_COMPOSE_FILE up --abort-on-container-exit e2e-tests
        }
        "security" {
            Log-Info "Running security scan..."
            docker-compose -f $TEST_COMPOSE_FILE up --abort-on-container-exit security-scan
        }
        default {
            Log-Info "Running all container tests..."
            docker-compose -f $TEST_COMPOSE_FILE up --abort-on-container-exit
        }
    }
    
    Log-Success "Container tests completed"
}

# Show test statistics
function Show-TestStats {
    Log-Info "Current Test Coverage Statistics:"
    Write-Host ""
    Write-Host "CRUD Tests (112+ tests total):"
    Write-Host "  ✅ Patient CRUD             15 tests"
    Write-Host "  ✅ Medication CRUD          15 tests" 
    Write-Host "  ✅ Allergy CRUD             12 tests"
    Write-Host "  ✅ Vitals CRUD              15 tests"
    Write-Host "  ✅ Procedure CRUD           11 tests"
    Write-Host "  ✅ Lab Result CRUD          15 tests"
    Write-Host "  ✅ Condition CRUD           15 tests"
    Write-Host "  ✅ Immunization CRUD        15 tests"
    Write-Host "  ✅ Emergency Contact CRUD   15 tests"
    Write-Host ""
    Write-Host "API Tests (21+ tests total):"
    Write-Host "  ✅ Authentication API   5 tests"
    Write-Host "  ✅ Patient API          4 tests"
    Write-Host "  ✅ Medication API       4 tests"
    Write-Host "  ✅ Allergy API          4 tests"
    Write-Host "  ✅ Lab Result API       2 tests"
    Write-Host "  ✅ Procedure API        1 test"
    Write-Host "  ✅ Immunization API     1 test"
    Write-Host ""
    Write-Host "Integration Tests:"
    Write-Host "  ✅ User Workflows       Multiple scenarios"
    Write-Host ""
    Write-Host "Container Tests:"
    Write-Host "  ✅ Build Tests         1 test"
    Write-Host ""
}

# Quick tests (unit tests only)
function Run-QuickTests {
    Log-Info "Running quick test suite (unit tests only)..."
    
    Run-FrontendTests "unit"
    Run-BackendTests "unit"
    
    Log-Success "Quick tests completed"
}

# Full test suite
function Run-FullTests {
    Log-Info "Running full test suite..."
    
    Run-FrontendTests "all"
    Run-BackendTests "all"
    Run-ContainerTests "build"
    
    Log-Success "Full test suite completed"
}

# Performance tests
function Run-PerformanceTests {
    Log-Info "Running performance tests..."
    
    # Start application in container
    docker-compose -f $TEST_COMPOSE_FILE up -d app-e2e
    
    # Wait for application to be ready
    Log-Info "Waiting for application to start..."
    $timeout = 60
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { break }
        }
        catch { }
        Start-Sleep 2
        $elapsed += 2
    }
    
    # Run basic performance tests
    Log-Info "Running performance benchmarks..."
    
    # Test health endpoint
    Write-Host "Health endpoint:"
    Measure-Command { Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing } | Select-Object TotalMilliseconds
    
    # Test API endpoint
    Write-Host "API endpoint:"
    Measure-Command { Invoke-WebRequest -Uri "http://localhost:8001/api/v1/system/version" -UseBasicParsing } | Select-Object TotalMilliseconds
    
    # Test static files
    Write-Host "Static files:"
    Measure-Command { Invoke-WebRequest -Uri "http://localhost:8001/" -UseBasicParsing } | Select-Object TotalMilliseconds
    
    # Cleanup
    docker-compose -f $TEST_COMPOSE_FILE down
    
    Log-Success "Performance tests completed"
}

# Clean up test artifacts
function Cleanup {
    Log-Info "Cleaning up test artifacts..."
    
    # Remove test containers
    try { docker-compose -f $TEST_COMPOSE_FILE down --volumes --remove-orphans } catch { }
    
    # Remove test images
    try { docker rmi medical-records:test } catch { }
    
    # Clean Python cache
    Get-ChildItem -Path . -Recurse -Directory -Name "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path . -Recurse -Filter "*.pyc" | Remove-Item -Force -ErrorAction SilentlyContinue
    
    # Clean test databases
    Remove-Item -Path "test.db*" -Force -ErrorAction SilentlyContinue
    
    # Clean coverage files
    Remove-Item -Path "htmlcov", ".coverage", "coverage.xml" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "frontend/coverage" -Recurse -Force -ErrorAction SilentlyContinue
    
    Log-Success "Cleanup completed"
}

# Show help
function Show-Help {
    Write-Host "Medical Records Application - Test Runner (PowerShell)"
    Write-Host ""
    Write-Host "Usage: .\scripts\run-tests.ps1 [COMMAND] [OPTIONS]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  frontend [unit|lint|coverage|forms|all]  Run frontend tests"
    Write-Host "  backend [unit|api|crud|crud-<module>|integration|coverage|lint|all]  Run backend tests"
    Write-Host "  container [build|integration|e2e|security|all]  Run container tests"
    Write-Host "  quick                              Run quick test suite (unit tests)"
    Write-Host "  full                               Run full test suite"
    Write-Host "  performance                        Run performance tests"
    Write-Host "  stats                              Show test coverage statistics"
    Write-Host "  cleanup                            Clean up test artifacts"
    Write-Host "  help                               Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\run-tests.ps1 quick                           # Run unit tests only"
    Write-Host "  .\scripts\run-tests.ps1 frontend unit                   # Run frontend unit tests"
    Write-Host "  .\scripts\run-tests.ps1 frontend forms                  # Run medical form component tests"
    Write-Host "  .\scripts\run-tests.ps1 backend coverage                # Run backend tests with coverage"
    Write-Host "  .\scripts\run-tests.ps1 backend crud                    # Run all CRUD tests"
    Write-Host "  .\scripts\run-tests.ps1 backend crud-patient            # Run Patient CRUD tests only"
    Write-Host "  .\scripts\run-tests.ps1 backend crud-lab-result         # Run Lab Result CRUD tests only"
    Write-Host "  .\scripts\run-tests.ps1 backend api                     # Run API tests"
    Write-Host "  .\scripts\run-tests.ps1 container build                 # Build and test container"
    Write-Host "  .\scripts\run-tests.ps1 full                            # Run complete test suite"
    Write-Host ""
    Write-Host "Available CRUD Test Modules:"
    Write-Host "  crud-patient        Patient CRUD operations (15 tests)"
    Write-Host "  crud-medication     Medication CRUD operations (15 tests)"
    Write-Host "  crud-allergy        Allergy CRUD operations (12 tests)"
    Write-Host "  crud-vitals         Vitals CRUD operations (15 tests)"
    Write-Host "  crud-procedure      Procedure CRUD operations (11 tests)"
    Write-Host "  crud-lab-result        Lab Result CRUD operations (15 tests)"
    Write-Host "  crud-condition         Condition CRUD operations (15 tests)"
    Write-Host "  crud-immunization      Immunization CRUD operations (15 tests)"
    Write-Host "  crud-emergency-contact Emergency Contact CRUD operations (15 tests)"
    Write-Host ""
}

# Main script logic
Check-Dependencies

switch ($Command) {
    "frontend" { Run-FrontendTests $Option }
    "backend" { Run-BackendTests $Option }
    "container" { Run-ContainerTests $Option }
    "quick" { Run-QuickTests }
    "full" { Run-FullTests }
    "performance" { Run-PerformanceTests }
    "cleanup" { Cleanup }
    default { Show-Help }
} 