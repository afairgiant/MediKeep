# Backup CLI Usage Examples

This file provides practical examples for using the backup CLI system in real-world scenarios.

## Basic Usage

### Simple Backups

```bash
# Create a database backup
docker exec medical-records-app backup_db

# Create a files backup with description
docker exec medical-records-app backup_files "Before system upgrade"

# Create a full system backup
docker exec medical-records-app backup_full
```

### Checking Container Name

```bash
# Find your container name
docker ps | grep medical

# If your container has a different name, use it:
docker exec your-container-name backup_db
```

## Automation Examples

### Simple Cron Setup

```bash
# Edit crontab
crontab -e

# Add these lines for automated backups:

# Daily database backup at 2 AM
0 2 * * * docker exec medical-records-app backup_db "Daily automated backup"

# Weekly full backup on Sundays at 3 AM
0 3 * * 0 docker exec medical-records-app backup_full "Weekly full backup"

# Monthly files backup on the 1st at 4 AM
0 4 1 * * docker exec medical-records-app backup_files "Monthly files backup"
```

### Advanced Cron with Logging

```bash
# Create a backup script that includes logging
cat > /usr/local/bin/medical-backup.sh << 'EOF'
#!/bin/bash

CONTAINER_NAME="medical-records-app"
LOG_FILE="/var/log/medical-backup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting backup..." >> $LOG_FILE

if docker exec $CONTAINER_NAME backup_db "Automated daily backup" >> $LOG_FILE 2>&1; then
    echo "[$DATE] Database backup completed successfully" >> $LOG_FILE
else
    echo "[$DATE] Database backup FAILED" >> $LOG_FILE
    # Send notification (optional)
    # echo "Medical Records backup failed" | mail -s "Backup Alert" admin@yourcompany.com
fi
EOF

chmod +x /usr/local/bin/medical-backup.sh

# Add to crontab
echo "0 2 * * * /usr/local/bin/medical-backup.sh" | crontab -
```

### Backup with Rotation

```bash
# Script that creates backups and cleans up old ones
cat > /usr/local/bin/backup-with-rotation.sh << 'EOF'
#!/bin/bash

CONTAINER_NAME="medical-records-app"
BACKUP_DIR="/host/backups"  # Adjust to your mounted backup directory
RETENTION_DAYS=30

echo "Starting backup process..."

# Create backup
if docker exec $CONTAINER_NAME backup_full "Automated backup with rotation"; then
    echo "Backup created successfully"

    # Clean up old backup files (if you have external access to backup directory)
    find $BACKUP_DIR -name "*.sql" -mtime +$RETENTION_DAYS -delete
    find $BACKUP_DIR -name "*.zip" -mtime +$RETENTION_DAYS -delete

    echo "Old backups cleaned up (older than $RETENTION_DAYS days)"
else
    echo "Backup failed!"
    exit 1
fi
EOF

chmod +x /usr/local/bin/backup-with-rotation.sh
```

## Docker Compose Integration

### Adding Backup Volume

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    # ... your existing configuration
    volumes:
      - ./backups:/app/backups # Persist backups outside container
      - /etc/localtime:/etc/localtime:ro # Sync timezone

  # Optional: Add a backup service
  backup:
    image: your-medical-records-image
    depends_on:
      - app
      - db
    volumes:
      - ./backups:/app/backups
    command: >
      sh -c "
        while true; do
          sleep 86400  # Wait 24 hours
          python app/scripts/backup_cli.py full --description 'Daily automated backup'
        done
      "
```

### Backup Service with Cron

```yaml
# docker-compose.yml
version: '3.8'
services:
  # ... your existing services

  backup-cron:
    image: your-medical-records-image
    depends_on:
      - app
      - db
    volumes:
      - ./backups:/app/backups
      - ./crontab:/etc/cron.d/backup-cron:ro
    command: >
      sh -c "
        cron &&
        tail -f /var/log/cron.log
      "

# Create crontab file
# echo '0 2 * * * root cd /app && python app/scripts/backup_cli.py database --description "Daily DB backup" >> /var/log/cron.log 2>&1' > crontab
```

## Monitoring and Alerting

### Simple Health Check

```bash
# health-check.sh
#!/bin/bash

CONTAINER_NAME="medical-records-app"
TODAY=$(date '+%Y-%m-%d')

# Check if backup was created today
if docker exec $CONTAINER_NAME ls /app/backups/*$TODAY* >/dev/null 2>&1; then
    echo "✅ Backup found for today"
    exit 0
else
    echo "❌ No backup found for today"
    exit 1
fi
```

### Backup Status with JSON

```bash
# backup-status.sh
#!/bin/bash

CONTAINER_NAME="medical-records-app"

echo "Creating test backup to verify system..."
RESULT=$(docker exec $CONTAINER_NAME python app/scripts/backup_cli.py database --json --description "Health check backup")

if echo "$RESULT" | jq -e '.success' >/dev/null 2>&1; then
    BACKUP_ID=$(echo "$RESULT" | jq -r '.id')
    FILENAME=$(echo "$RESULT" | jq -r '.filename')
    SIZE_MB=$(echo "$RESULT" | jq -r '.size_bytes / 1024 / 1024 | floor')

    echo "✅ Backup system is healthy"
    echo "   Backup ID: $BACKUP_ID"
    echo "   Filename: $FILENAME"
    echo "   Size: ${SIZE_MB} MB"
else
    echo "❌ Backup system is not working"
    echo "$RESULT"
    exit 1
fi
```

## Restoration Examples

### Emergency Restore Process

```bash
# 1. Stop the application (if needed)
docker-compose down

# 2. Start only the database
docker-compose up -d db

# 3. Restore from backup (via admin interface or restore service)
# Note: CLI restore is not implemented yet, use web interface

# 4. Start application
docker-compose up -d
```

### Backup Verification

```bash
# Test backup integrity
docker exec medical-records-app python app/scripts/test_backup_cli.py

# Manual verification
docker exec medical-records-app ls -la /app/backups/
docker exec medical-records-app python -c "
import json
result = '''$(docker exec medical-records-app python app/scripts/backup_cli.py database --json)'''
data = json.loads(result)
print(f'Backup created: {data[\"filename\"]} ({data[\"size_bytes\"]} bytes)')
"
```

## Troubleshooting

### Debug Failed Backups

```bash
# Check if container is running
docker ps | grep medical

# Check container logs
docker logs medical-records-app

# Test database connectivity
docker exec medical-records-app python -c "
from app.core.database import SessionLocal
from sqlalchemy import text
try:
    db = SessionLocal()
    db.execute(text('SELECT 1'))
    print('✅ Database connection OK')
except Exception as e:
    print(f'❌ Database error: {e}')
"

# Check backup directory permissions
docker exec medical-records-app ls -la /app/backups/
docker exec medical-records-app touch /app/backups/test.txt
```

### Performance Monitoring

```bash
# Monitor backup performance
time docker exec medical-records-app backup_db "Performance test"

# Check disk space
docker exec medical-records-app df -h /app/backups

# Monitor during backup
docker stats medical-records-app
```

## Integration Examples

### Slack Notifications

```bash
# backup-with-slack.sh
#!/bin/bash

CONTAINER_NAME="medical-records-app"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

RESULT=$(docker exec $CONTAINER_NAME backup_full --json)

if echo "$RESULT" | jq -e '.success' >/dev/null 2>&1; then
    FILENAME=$(echo "$RESULT" | jq -r '.filename')
    SIZE_MB=$(echo "$RESULT" | jq -r '.size_bytes / 1024 / 1024 | floor')

    MESSAGE="✅ Medical Records backup completed: $FILENAME (${SIZE_MB} MB)"
else
    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    MESSAGE="❌ Medical Records backup failed: $ERROR"
fi

curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$MESSAGE\"}" \
    $SLACK_WEBHOOK
```

### Database Backup to S3

```bash
# backup-to-s3.sh
#!/bin/bash

CONTAINER_NAME="medical-records-app"
S3_BUCKET="your-backup-bucket"
AWS_PROFILE="backup-user"

# Create backup
RESULT=$(docker exec $CONTAINER_NAME backup_db --json)

if echo "$RESULT" | jq -e '.success' >/dev/null 2>&1; then
    FILENAME=$(echo "$RESULT" | jq -r '.filename')

    # Copy backup file from container
    docker cp $CONTAINER_NAME:/app/backups/$FILENAME ./temp-backup.sql

    # Upload to S3
    aws s3 cp ./temp-backup.sql s3://$S3_BUCKET/medical-records/ --profile $AWS_PROFILE

    # Clean up local copy
    rm ./temp-backup.sql

    echo "✅ Backup uploaded to S3: $FILENAME"
else
    echo "❌ Backup failed"
    exit 1
fi
```

This provides comprehensive examples for real-world usage of the backup CLI system!
