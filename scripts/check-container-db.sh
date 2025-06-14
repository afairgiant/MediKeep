#!/bin/bash
# Check if Docker container is using SQLite or PostgreSQL

CONTAINER_NAME="${1:-medical-records-app}"

echo "🐳 Checking database type in Docker container: $CONTAINER_NAME"
echo "============================================================"

# Check if container is running
if ! docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
    echo "❌ Container '$CONTAINER_NAME' is not running!"
    echo ""
    echo "Available containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "To start the container, run:"
    echo "  docker-compose -f docker/docker-compose.yml up -d"
    exit 1
fi

echo "✅ Container is running:"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Run the database type checker inside the container
echo "🔍 Running database type check inside container..."
echo ""

if docker exec "$CONTAINER_NAME" python /app/scripts/check_database_type.py; then
    echo ""
    echo "📊 Additional container information:"
    
    # Show container environment variables related to database
    echo ""
    echo "🔧 Database Environment Variables in Container:"
    if docker exec "$CONTAINER_NAME" env | grep -E "DB_|DATABASE_"; then
        docker exec "$CONTAINER_NAME" env | grep -E "DB_|DATABASE_" | sed 's/PASSWORD=.*/PASSWORD=***/'
    else
        echo "  No database environment variables found"
    fi
    
    # Show PostgreSQL container status if it exists
    echo ""
    echo "🐘 PostgreSQL Container Status:"
    if docker ps --filter "name=medical-records-db" --format "{{.Names}}" | grep -q "medical-records-db"; then
        docker ps --filter "name=medical-records-db" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        echo "  PostgreSQL container not running"
    fi
else
    echo "❌ Error running database check"
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "1. Make sure the container is fully started and healthy"
    echo "2. Check container logs: docker logs $CONTAINER_NAME"
    echo "3. Verify the script exists: docker exec $CONTAINER_NAME ls -la /app/scripts/"
fi

echo ""
echo "============================================================"
echo "✅ Database check completed!"
