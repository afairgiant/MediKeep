#!/bin/bash
set -e

echo "Starting Medical Records Test Environment..."

# Set test environment variables
export TESTING=1
export DATABASE_URL="sqlite:///./test.db"
export SECRET_KEY="test-secret-key-for-testing"
export LOG_LEVEL="WARNING"

# Check if we should skip migrations (for unit tests)
if [ "$SKIP_MIGRATIONS" = "true" ]; then
    echo "Skipping database migrations (unit test mode)"
else
    echo "Setting up test database..."
    
    # Create test database and run migrations
    python -c "
from app.core.database import engine, Base
from app.models import models
print('Creating test database tables...')
Base.metadata.create_all(bind=engine)
print('Test database ready.')
"
fi

# Run any additional test setup
echo "Test environment ready."

# Check if we should run the server or just tests
if [ "$RUN_SERVER" = "true" ]; then
    echo "Starting test server on port 8000..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning
else
    echo "Running test suite..."
    
    # Run different test suites based on environment variable
    case "${TEST_SUITE:-all}" in
        "unit")
            echo "Running unit tests..."
            pytest tests/unit/ -v --tb=short
            ;;
        "integration")
            echo "Running integration tests..."
            pytest tests/integration/ -v --tb=short
            ;;
        "api")
            echo "Running API tests..."
            pytest tests/api/ -v --tb=short
            ;;
        "e2e")
            echo "Running end-to-end tests..."
            pytest tests/e2e/ -v --tb=short
            ;;
        "all"|*)
            echo "Running all tests..."
            pytest tests/ -v --tb=short --cov=app --cov-report=term-missing
            ;;
    esac
    
    echo "Test suite completed."
fi