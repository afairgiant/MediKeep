#!/bin/bash

# Medical Records Application - Test Runner Script
# This script provides easy testing for the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="frontend"
BACKEND_DIR="."
TEST_COMPOSE_FILE="docker-compose.test.yml"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    local deps=("node" "npm" "python3" "pip" "docker" "docker-compose")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        log_info "Please install the missing dependencies and try again"
        exit 1
    fi
}

# Frontend tests
run_frontend_tests() {
    log_info "Running frontend tests..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm ci
    fi
    
    # Run tests based on arguments
    case "${1:-all}" in
        "unit")
            log_info "Running frontend unit tests..."
            npm test -- --coverage --watchAll=false
            ;;
        "lint")
            log_info "Running frontend linting..."
            npm run lint || true
            ;;
        "coverage")
            log_info "Running frontend tests with coverage..."
            npm run test:coverage
            ;;
        "all"|*)
            log_info "Running all frontend tests..."
            npm run lint || true
            npm test -- --coverage --watchAll=false
            ;;
    esac
    
    cd ..
    log_success "Frontend tests completed"
}

# Backend tests
run_backend_tests() {
    log_info "Running backend tests..."
    
    # Set test environment variables
    export TESTING=1
    export SECRET_KEY="test-secret-key"
    export DATABASE_URL="sqlite:///./test.db"
    export LOG_LEVEL="WARNING"
    
    # Install dependencies if needed
    if ! python3 -c "import pytest" 2>/dev/null; then
        log_info "Installing backend test dependencies..."
        pip install pytest pytest-asyncio pytest-cov httpx faker
    fi
    
    # Run tests based on arguments
    case "${1:-all}" in
        "unit")
            log_info "Running backend unit tests..."
            pytest tests/unit/ -v
            ;;
        "api")
            log_info "Running API tests..."
            pytest tests/api/ -v
            ;;
        "integration")
            log_info "Running integration tests..."
            pytest tests/integration/ -v
            ;;
        "coverage")
            log_info "Running backend tests with coverage..."
            pytest tests/ -v --cov=app --cov-report=html --cov-report=term-missing
            ;;
        "lint")
            log_info "Running backend linting..."
            if command -v flake8 &> /dev/null; then
                flake8 app tests --max-line-length=88 --extend-ignore=E203,W503 || true
            fi
            if command -v black &> /dev/null; then
                black --check app tests || true
            fi
            ;;
        "all"|*)
            log_info "Running all backend tests..."
            pytest tests/ -v --cov=app --cov-report=term-missing
            ;;
    esac
    
    log_success "Backend tests completed"
}

# Container tests
run_container_tests() {
    log_info "Running container tests..."
    
    case "${1:-build}" in
        "build")
            log_info "Building and testing container..."
            docker build -f docker/Dockerfile.test -t medical-records:test .
            log_success "Container built successfully"
            ;;
        "integration")
            log_info "Running container integration tests..."
            docker-compose -f "$TEST_COMPOSE_FILE" up --abort-on-container-exit backend-integration-tests
            ;;
        "e2e")
            log_info "Running end-to-end tests..."
            docker-compose -f "$TEST_COMPOSE_FILE" up --abort-on-container-exit e2e-tests
            ;;
        "security")
            log_info "Running security scan..."
            docker-compose -f "$TEST_COMPOSE_FILE" up --abort-on-container-exit security-scan
            ;;
        "all"|*)
            log_info "Running all container tests..."
            docker-compose -f "$TEST_COMPOSE_FILE" up --abort-on-container-exit
            ;;
    esac
    
    log_success "Container tests completed"
}

# Quick tests (unit tests only)
run_quick_tests() {
    log_info "Running quick test suite (unit tests only)..."
    
    run_frontend_tests "unit"
    run_backend_tests "unit"
    
    log_success "Quick tests completed"
}

# Full test suite
run_full_tests() {
    log_info "Running full test suite..."
    
    run_frontend_tests "all"
    run_backend_tests "all"
    run_container_tests "build"
    
    log_success "Full test suite completed"
}

# Performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    # Start application in container
    docker-compose -f "$TEST_COMPOSE_FILE" up -d app-e2e
    
    # Wait for application to be ready
    log_info "Waiting for application to start..."
    timeout 60 bash -c 'until curl -f http://localhost:8001/health; do sleep 2; done'
    
    # Run basic performance tests
    log_info "Running performance benchmarks..."
    
    # Test health endpoint
    echo "Health endpoint:"
    time curl -s http://localhost:8001/health > /dev/null
    
    # Test API endpoint
    echo "API endpoint:"
    time curl -s http://localhost:8001/api/v1/system/version > /dev/null
    
    # Test static files
    echo "Static files:"
    time curl -s http://localhost:8001/ > /dev/null
    
    # Cleanup
    docker-compose -f "$TEST_COMPOSE_FILE" down
    
    log_success "Performance tests completed"
}

# Clean up test artifacts
cleanup() {
    log_info "Cleaning up test artifacts..."
    
    # Remove test containers
    docker-compose -f "$TEST_COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
    
    # Remove test images
    docker rmi medical-records:test 2>/dev/null || true
    
    # Clean Python cache
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    
    # Clean test databases
    rm -f test.db test.db-* 2>/dev/null || true
    
    # Clean coverage files
    rm -rf htmlcov .coverage coverage.xml 2>/dev/null || true
    rm -rf frontend/coverage 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Show help
show_help() {
    echo "Medical Records Application - Test Runner"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  frontend [unit|lint|coverage|all]  Run frontend tests"
    echo "  backend [unit|api|integration|coverage|lint|all]  Run backend tests"
    echo "  container [build|integration|e2e|security|all]  Run container tests"
    echo "  quick                              Run quick test suite (unit tests)"
    echo "  full                               Run full test suite"
    echo "  performance                        Run performance tests"
    echo "  cleanup                            Clean up test artifacts"
    echo "  help                               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 quick                           # Run unit tests only"
    echo "  $0 frontend unit                   # Run frontend unit tests"
    echo "  $0 backend coverage                # Run backend tests with coverage"
    echo "  $0 container build                 # Build and test container"
    echo "  $0 full                            # Run complete test suite"
    echo ""
}

# Main script logic
main() {
    # Check dependencies
    check_dependencies
    
    # Parse command line arguments
    COMMAND="${1:-help}"
    OPTION="${2:-all}"
    
    case "$COMMAND" in
        "frontend")
            run_frontend_tests "$OPTION"
            ;;
        "backend")
            run_backend_tests "$OPTION"
            ;;
        "container")
            run_container_tests "$OPTION"
            ;;
        "quick")
            run_quick_tests
            ;;
        "full")
            run_full_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"