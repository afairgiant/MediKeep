# Backup CLI Documentation

This directory contains command-line tools for automating backups of the Medical Records System. The tools are designed to work within Docker containers and can be easily integrated with cron jobs or other automation systems.

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
```

### Direct Usage

```bash
# From within the container or on the server
python app/scripts/backup_cli.py database
python app/scripts/backup_cli.py files --description "Weekly files backup"
python app/scripts/backup_cli.py full --json
```

## Available Commands

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

## Integration with Existing System

The CLI tools reuse the existing `BackupService` class from the web application, ensuring:

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
3. **Logs**: Review application logs for backup status

## Security Considerations

- Scripts run with minimal privileges (non-root user)
- Database credentials are read from environment variables
- No sensitive data is exposed in command output
- All operations are logged for audit purposes

## Troubleshooting

### Common Issues

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

## API Integration

For programmatic access, use the `--json` flag:

```bash
# Get backup result as JSON
result=$(docker exec container backup_db --json)
backup_id=$(echo "$result" | jq -r '.id')
echo "Created backup with ID: $backup_id"
```

This enables integration with monitoring systems, notification services, or custom automation scripts.
