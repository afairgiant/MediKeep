#!/usr/bin/sh
set -e

echo "Starting Medical Records Management System..."

# Fix bind mount permissions for upload directories
echo "Checking and fixing directory permissions..."

# Change container user to match PUID/PGID if provided (only when running as root)
if [ "$(id -u)" = "0" ] && [ -n "$PUID" ] && [ -n "$PGID" ]; then
    echo "Configuring container for PUID=$PUID, PGID=$PGID"
    
    # Modify appuser to match PUID/PGID (we're running as root at startup)
    usermod -u "$PUID" appuser
    groupmod -g "$PGID" appuser
    
    # Fix ownership of all app files for the new user
    chown -R "$PUID:$PGID" /app
    
    echo "✓ Container user configured for $PUID:$PGID"
fi

# Function to safely create and fix permissions for directories
fix_directory_permissions() {
    local dir_path="$1"
    local dir_name="$2"
    
    if [ ! -d "$dir_path" ]; then
        echo "Creating $dir_name directory: $dir_path"
        if ! mkdir -p "$dir_path" 2>/dev/null; then
            echo "WARNING: Could not create $dir_name directory $dir_path"
            echo "This may be due to bind mount permission issues."
            echo "Consider using Docker volumes or fixing host directory permissions."
            return 1
        fi
    fi
    
    # Fix ownership if PUID and PGID are provided
    if [ -n "$PUID" ] && [ -n "$PGID" ]; then
        echo "Attempting to set ownership of $dir_path to $PUID:$PGID"
        if chown "$PUID:$PGID" "$dir_path" 2>/dev/null; then
            echo "✓ Successfully changed ownership to $PUID:$PGID"
        else
            echo "WARNING: Failed to change ownership to $PUID:$PGID"
        fi
        if chmod 755 "$dir_path" 2>/dev/null; then
            echo "✓ Successfully set permissions to 755"
        else
            echo "WARNING: Failed to set permissions to 755"
        fi
        # Show current ownership after attempt
        ls -ld "$dir_path" || echo "Could not list directory details"
    else
        echo "PUID/PGID not set, skipping ownership changes"
    fi
    
    # Test write permissions
    if ! touch "$dir_path/.permission_test" 2>/dev/null; then
        echo "WARNING: No write permission to $dir_name directory $dir_path"
        echo "This may cause upload failures. Consider:"
        echo "  1. Using Docker volumes instead of bind mounts"
        echo "  2. Setting PUID and PGID environment variables"
        echo "  3. Setting host directory permissions: sudo chown -R 1000:1000 /host/path"
        return 1
    else
        rm -f "$dir_path/.permission_test" 2>/dev/null
        echo "✓ $dir_name directory permissions OK: $dir_path"
    fi
    
    return 0
}

# Check essential directories
fix_directory_permissions "/app/uploads" "uploads"
fix_directory_permissions "/app/uploads/lab_result_files" "lab result files"
fix_directory_permissions "/app/logs" "logs"
fix_directory_permissions "/app/backups" "backups"
fix_directory_permissions "/app/uploads/trash" "trash"

echo "Directory permission check completed."

# Switch to appuser if we're still running as root
if [ "$(id -u)" = "0" ]; then
    echo "Switching to appuser for application execution"
    exec su appuser -c "$0 $*"
fi

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
