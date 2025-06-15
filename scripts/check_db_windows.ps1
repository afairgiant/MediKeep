param(
    [string]$ContainerName = "medical-records-app-dev"
)

Write-Host "🐳 Checking database type in Docker container: $ContainerName" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check if container is running
$runningContainer = docker ps --filter "name=$ContainerName" --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }

if (-not $runningContainer) {
    Write-Host "❌ Container '$ContainerName' is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available containers:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    Write-Host ""
    Write-Host "To start the container, run:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f docker/docker-compose.yml up -d" -ForegroundColor White
    exit 1
}

Write-Host "✅ Container is running:" -ForegroundColor Green
docker ps --filter "name=$ContainerName" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
Write-Host ""

# Run the database type checker inside the container
Write-Host "🔍 Running database type check inside container..." -ForegroundColor Cyan
Write-Host ""

$checkResult = docker exec $ContainerName python /app/scripts/check_database_type.py
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host $checkResult
    Write-Host ""
    Write-Host "📊 Additional container information:" -ForegroundColor Cyan

    # Show container environment variables related to database
    Write-Host ""
    Write-Host "🔧 Database Environment Variables in Container:" -ForegroundColor Yellow
    $envVars = docker exec $ContainerName env | Where-Object { $_ -match "DB_|DATABASE_" }
    if ($envVars) {
        $envVars | ForEach-Object { $_ -replace "PASSWORD=.*", "PASSWORD=***" }
    } else {
        Write-Host "  No database environment variables found"
    }

    # Show PostgreSQL container status if it exists
    Write-Host ""
    Write-Host "🐘 PostgreSQL Container Status:" -ForegroundColor Yellow
    $pgContainer = docker ps --filter "name=medical-records-db" --format "{{.Names}}" | Where-Object { $_ -match "medical-records-db" }
    if ($pgContainer) {
        docker ps --filter "name=medical-records-db" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    } else {
        Write-Host "  PostgreSQL container not running"
    }
} else {
    Write-Host "❌ Error running database check" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Make sure the container is fully started and healthy"
    Write-Host "2. Check container logs: docker logs $ContainerName"
    Write-Host "3. Verify the script exists: docker exec $ContainerName ls -la /app/scripts/"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ Database check completed!" -ForegroundColor Green