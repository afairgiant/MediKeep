# Backup & Restore CLI Documentation

This directory contains command-line tools for automating backups and restores of the Medical Records System. The tools are designed to work within Docker containers and can be easily integrated with cron jobs or other automation systems.

## Quick Start

### Using Docker Exec (Recommended)

```bash
# Database backup
docker exec <container_name> backup_db

# Files backup
docker exec <container_name> backup_files

# Full system backup (database + files)
docker exec <container_name> backup_full

# With custom description
docker exec <container_name> backup_db "Daily automated backup"

# List available backups
docker exec <container_name> restore list

# Preview a restore (shows what will be affected)
docker exec <container_name> restore preview 123

# Execute a restore (requires confirmation from preview)
docker exec <container_name> restore restore 123 123_1430
```

### Direct Usage

```bash
# From within the container or on the server
python app/scripts/backup_cli.py database
python app/scripts/backup_cli.py files --description "Weekly files backup"
python app/scripts/backup_cli.py full --json

# List and preview restores
python app/scripts/restore_cli.py list
python app/scripts/restore_cli.py preview 123
```

## Available Commands

### Backup Commands

### `backup_db`

Creates a database-only backup using PostgreSQL's `pg_dump`.

- **Output**: SQL dump file in the backups directory
- **Usage**: `docker exec <container> backup_db [description]`

### `backup_files`

Creates a backup of the uploads directory (files/documents).

- **Output**: ZIP archive containing all uploaded files
- **Usage**: `docker exec <container> backup_files [description]`

### `backup_full`

Creates a complete system backup including both database and files.

- **Output**: ZIP archive with database dump and all files
- **Usage**: `docker exec <container> backup_full [description]`

### Restore Commands

### `restore list`

Lists all available backups that can be restored.

- **Output**: Simple list of backups with IDs, types, filenames, and status
- **Usage**: `docker exec <container> restore list [type]`

### `restore preview`

Shows what will be affected by a restore operation (safe, read-only).

- **Output**: Basic preview with warnings and confirmation code
- **Usage**: `docker exec <container> restore preview <backup_id>`

### `restore restore`

Executes a restore operation with safety checks.

- **Safety**: Creates automatic safety backup before restore
- **Usage**: `docker exec <container> restore restore <backup_id> <confirmation_code>`

## Advanced Options

The main CLI script (`backup_cli.py`) supports additional options:

```bash
python app/scripts/backup_cli.py --help

# Quiet mode (only errors shown)
python app/scripts/backup_cli.py database --quiet

# JSON output (for automation)
python app/scripts/backup_cli.py full --json

# Custom description
python app/scripts/backup_cli.py files --description "Pre-upgrade backup"

# List and restore operations
python app/scripts/restore_cli.py list --type database
python app/scripts/restore_cli.py preview 123
python app/scripts/restore_cli.py restore 123 123_1430
```

## Restore Workflow

### Safe Restore Process

```bash
# 1. List available backups
docker exec medical-records-app restore list

# 2. Preview the restore (ALWAYS do this first)
docker exec medical-records-app restore preview 123

# 3. Review the warnings and confirmation code

# 4. Execute with the confirmation code from step 2
docker exec medical-records-app restore restore 123 123_1430
```

### Emergency Restore

```bash
# Quick restore for emergencies (still creates safety backup)
docker exec medical-records-app restore list
# Note: Get backup ID from list, then:
docker exec medical-records-app restore preview <backup_id>
# Note: Get confirmation code from preview, then:
docker exec medical-records-app restore restore <backup_id> <confirmation_code>
```

## Cron Job Examples

### Daily Database Backup

```bash
# Add to crontab: daily at 2 AM
0 2 * * * docker exec medical-records-app backup_db "Daily automated backup"
```

### Weekly Full Backup

```bash
# Add to crontab: weekly on Sunday at 3 AM
0 3 * * 0 docker exec medical-records-app backup_full "Weekly full backup"
```

### Monthly Files Backup with Logging

```bash
# Add to crontab: monthly on 1st at 4 AM
0 4 1 * * docker exec medical-records-app backup_files "Monthly files backup" >> /var/log/backup.log 2>&1
```

## Exit Codes

The scripts use standard exit codes for automation:

- `0`: Success
- `1`: General error (backup failed, database connection issues, etc.)
- `130`: Interrupted by user (Ctrl+C)

## Error Handling

- **Database Connection**: Scripts verify database connectivity before attempting backups
- **Permissions**: All scripts run as the `appuser` with appropriate permissions
- **Disk Space**: Large backups may fail if insufficient disk space is available
- **Service Dependencies**: PostgreSQL service must be running and accessible

## Safety Features

### Restore Safety

- **Preview First**: Always preview before executing restores
- **Confirmation Tokens**: Date-based tokens prevent accidental restores
- **Safety Backups**: Automatic backup creation before restore
- **Validation**: Backup file integrity checks before restore

### Backup Verification

- **File Existence**: Check if backup files still exist
- **Integrity**: Checksum validation for corruption detection
- **Size Verification**: Compare expected vs actual file sizes

## Integration with Existing System

The CLI tools reuse the existing `BackupService` and `RestoreService` classes from the web application, ensuring:

- **Consistency**: Same backup format and metadata as web-based backups
- **Database Records**: All CLI backups are recorded in the backup management system
- **File Organization**: Backups are stored in the same directory structure
- **Logging**: Activity is logged through the same logging system

## Backup Storage

Backups are stored in the container's `/app/backups` directory by default. To persist backups outside the container:

```bash
# Mount a volume for backups
docker run -v /host/backup/path:/app/backups <image>

# Or use docker-compose
services:
  app:
    volumes:
      - ./backups:/app/backups
```

## Monitoring and Verification

You can verify backups through:

1. **Web Interface**: Admin panel → Backup Management
2. **CLI**: Check the backups directory for recent files
3. **Logs**: Review application logs for backup/restore status
4. **Restore List**: Use `restore list` to see all available backups

## Security Considerations

- Scripts run with minimal privileges (non-root user)
- Database credentials are read from environment variables
- No sensitive data is exposed in command output
- All operations are logged for audit purposes

## Troubleshooting

### Backup Issues

1. **Permission Denied**

   ```bash
   chmod +x /app/app/scripts/backup_*
   ```

2. **Database Connection Failed**

   - Verify PostgreSQL service is running
   - Check DATABASE_URL environment variable
   - Ensure network connectivity

3. **Disk Space Issues**

   - Check available space: `df -h`
   - Clean up old backups if needed
   - Consider mounting external storage

4. **Container Not Found**

   ```bash
   # List running containers
   docker ps

   # Use correct container name/ID
   docker exec <actual_container_name> backup_db
   ```

### Restore Issues

1. **Invalid Confirmation Token**

   - Tokens are date-based and expire daily
   - Get new code with: `restore preview <backup_id>`

2. **Backup File Not Found**

   - Check with: `restore list`
   - Verify file exists in backups directory

3. **Restore Permission Denied**

   - Ensure PostgreSQL is accessible
   - Check database connection
   - Verify backup file permissions

4. **Partial Restore Failure**
   - System creates safety backup before restore
   - Check safety backup ID in error output
   - May need manual rollback

### Testing Commands

```bash
# Test backup CLI
docker exec container python app/scripts/test_backup_cli.py

# Test restore CLI
docker exec container python app/scripts/test_restore_cli.py

# Manual verification
docker exec container restore list
docker exec container ls -la /app/backups/
```

## API Integration

For programmatic access, use the `--json` flag:

```bash
# Get backup result as JSON
result=$(docker exec container backup_db --json)
backup_id=$(echo "$result" | jq -r '.id')
echo "Created backup with ID: $backup_id"

# Restore operations (simplified)
docker exec container restore list
docker exec container restore preview 123
docker exec container restore restore 123 123_1430
```

This enables integration with monitoring systems, notification services, or custom automation scripts.

## Complete Example Workflow

```bash
#!/bin/bash
# Complete backup and restore workflow example

CONTAINER="medical-records-app"

echo "Creating backup..."
backup_result=$(docker exec $CONTAINER backup_full --json)
backup_id=$(echo "$backup_result" | jq -r '.id')
echo "Created backup ID: $backup_id"

echo "Listing available backups..."
docker exec $CONTAINER restore list

echo "Previewing restore..."
docker exec $CONTAINER restore preview $backup_id

echo "To restore, use the confirmation code from preview:"
echo "docker exec $CONTAINER restore restore $backup_id <confirmation_code>"
```
