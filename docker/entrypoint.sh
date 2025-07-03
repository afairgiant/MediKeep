#!/usr/bin/sh
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

# Start the FastAPI application with conditional SSL support
echo "Starting FastAPI server..."
LOG_LEVEL_LOWER=$(echo "${LOG_LEVEL:-INFO}" | tr '[:upper:]' '[:lower:]')

if [ "$ENABLE_SSL" = "true" ]; then
    if [ -f "/app/certs/localhost.crt" ] && [ -f "/app/certs/localhost.key" ]; then
        echo "Starting with HTTPS on port 8000"
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level "$LOG_LEVEL_LOWER" \
            --ssl-certfile /app/certs/localhost.crt --ssl-keyfile /app/certs/localhost.key
    else
        echo "HTTPS enabled but certificates not found at /app/certs/"
        echo "   Expected: /app/certs/localhost.crt and /app/certs/localhost.key"
        echo "   Falling back to HTTP mode"
        echo "Starting with HTTP on port 8000"
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level "$LOG_LEVEL_LOWER"
    fi
else
    echo "Starting with HTTP on port 8000"
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level "$LOG_LEVEL_LOWER"
fi
