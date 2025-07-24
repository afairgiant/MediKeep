# Docker Bind Mount Permission Issues - Troubleshooting Guide

## Problem Description

When using Docker bind mounts (instead of Docker volumes), you may encounter permission errors like:

```
PermissionError: [Errno 13] Permission denied: 'uploads/lab_result_files'
```

This happens because the container runs as a non-root user (`appuser` with UID 1000), but the bind-mounted directories on the host may have different ownership or permissions.

## Solutions

### Option 1: Use Docker Volumes

Docker volumes are managed by Docker and don't have permission issues:

```yaml
# In docker-compose.yml, use volumes instead of bind mounts:
volumes:
  - app_uploads:/app/uploads
  - app_logs:/app/logs
  - app_backups:/app/backups
```

### Option 2: Fix Host Directory Permissions

If you need to use bind mounts, fix the host directory permissions:

```bash
# Create directories on host
mkdir -p ./uploads ./logs ./backups

# Set correct ownership (UID 1000 or whatever matches container user)
sudo chown -R 1000:1000 ./uploads ./logs ./backups

# Set correct permissions
chmod -R 755 ./uploads ./logs ./backups
```

### Option 3: Use PUID and PGID Environment Variables

Set PUID and PGID environment variables to match your host user:

```bash
# Docker run command
docker run -e PUID=$(id -u) -e PGID=$(id -g) ...

# Or in docker-compose.yml
services:
  medical-records-app:
    environment:
      PUID: 1000  # Your user ID
      PGID: 1000  # Your group ID
```

### Option 4: Run Container with User Mapping

Map your current user to the container user:

```bash
# Docker run command
docker run --user $(id -u):$(id -g) ...

# Or in docker-compose.yml
services:
  medical-records-app:
    user: "${UID:-1000}:${GID:-1000}"
```

### Option 5: Modify Dockerfile to Match Host User

Create a custom build that matches your host user:

```dockerfile
# Add to Dockerfile
ARG USER_ID=1000
ARG GROUP_ID=1000
RUN groupmod -g $GROUP_ID appuser && usermod -u $USER_ID appuser
```

Then build with:

```bash
docker build --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) .
```

## Verification

The application now includes automatic permission checking at startup. Check the container logs for:

```
✓ uploads directory permissions OK: /app/uploads
✓ lab result files directory permissions OK: /app/uploads/lab_result_files
✓ logs directory permissions OK: /app/logs
✓ backups directory permissions OK: /app/backups
```

If you see warnings, follow the solutions above.

## Error Messages

The application now provides helpful error messages:

- **During upload**: "Permission denied creating upload directory. This may be a Docker bind mount permission issue..."
- **During startup**: "WARNING: No write permission to uploads directory..."

## Prevention

- **Prefer Docker volumes** over bind mounts for data persistence
- **Test permissions** after setting up bind mounts
- **Monitor logs** for permission warnings during container startup
