# Log Rotation Configuration

The Medical Records Management System supports hybrid log rotation with automatic fallback between Linux `logrotate` and Python's built-in rotation.

## Configuration

Set these environment variables to control log rotation behavior:

```env
# Rotation method: auto (default), python, or logrotate
LOG_ROTATION_METHOD=auto

# Size-based rotation threshold
LOG_ROTATION_SIZE=5M

# Time-based rotation frequency
LOG_ROTATION_TIME=daily

# Number of backup files to keep
LOG_ROTATION_BACKUP_COUNT=30

# Compress old log files
LOG_COMPRESSION=true
```

## Automatic Method Selection

- **auto** (default): Automatically detects if `logrotate` is available
  - Uses `logrotate` if found (recommended for production)
  - Falls back to Python rotation if not available
- **logrotate**: Forces use of Linux logrotate (production recommended)
- **python**: Forces use of Python's RotatingFileHandler (development/Windows)

## Production Setup

### Docker (Recommended)
**No setup required!** Logrotate is automatically configured during Docker build:
- ✅ logrotate package installed
- ✅ Configuration file copied to `/etc/logrotate.d/medical-records`
- ✅ `LOG_ROTATION_METHOD=logrotate` set by default
- ✅ 5MB + daily rotation enabled

### Manual Linux Setup
1. **Install logrotate** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install logrotate
   
   # CentOS/RHEL
   sudo yum install logrotate
   ```

2. **Run the setup script**:
   ```bash
   cd app/scripts
   sudo ./setup-logrotate.sh
   ```

3. **Set environment variable**:
   ```env
   LOG_ROTATION_METHOD=logrotate
   ```

## Manual logrotate Setup (Non-Docker)

Copy the configuration template:
```bash
sudo cp config/logrotate.conf /etc/logrotate.d/medical-records
```

Test the configuration:
```bash
sudo logrotate -d /etc/logrotate.d/medical-records
```

## Development Setup (Windows/Local)

No additional setup required. The system will automatically use Python's built-in rotation:

```env
LOG_ROTATION_METHOD=python
LOG_ROTATION_SIZE=5M
LOG_ROTATION_BACKUP_COUNT=10
```

## Log Files

The system creates these log files:

- **app.log**: Application logs (API calls, patient access, performance, etc.)
- **security.log**: Security events (failed logins, suspicious activity, etc.)

## Verification

Check which rotation method is being used by looking at the application startup logs:

```
Using logrotate for app.log rotation
Using logrotate for security.log rotation
```

or

```
Using Python rotation for app.log (size: 50M, backups: 30)
Using Python rotation for security.log (size: 50M, backups: 30)
```

## Troubleshooting

### logrotate not working

1. Check if logrotate is installed: `which logrotate`
2. Verify configuration syntax: `sudo logrotate -d /etc/logrotate.d/medical-records`
3. Check log directory permissions
4. Force rotation for testing: `sudo logrotate -f /etc/logrotate.d/medical-records`

### Python rotation not working

1. Check log directory write permissions
2. Verify LOG_ROTATION_SIZE format (e.g., '50M', '1G')
3. Check LOG_ROTATION_BACKUP_COUNT is a valid integer

### Switching methods

To switch from Python to logrotate:
1. Stop the application
2. Run the setup script: `cd app/scripts && sudo ./setup-logrotate.sh`
3. Set `LOG_ROTATION_METHOD=logrotate`
4. Restart the application

To switch from logrotate to Python:
1. Set `LOG_ROTATION_METHOD=python`
2. Restart the application
3. Optionally remove: `sudo rm /etc/logrotate.d/medical-records`