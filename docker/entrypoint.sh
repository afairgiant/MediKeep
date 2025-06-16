#!/bin/bash
set -e

echo "Starting Medical Records Management System..."

# Check if running in test environment (no database required)
if [ "$SKIP_MIGRATIONS" = "true" ]; then
    echo "Skipping database migrations (test environment)"
else
    # Wait for database to be ready (if using external database)
    echo "Checking database connection..."

    # Run Alembic migrations
    echo "Running database migrations..."
    cd /app && python -m alembic -c alembic/alembic.ini upgrade head

    echo "Migrations completed successfully."
fi

# Start the FastAPI application
echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
