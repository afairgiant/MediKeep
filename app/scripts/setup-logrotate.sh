#!/bin/bash
# Setup script for Medical Records Management System log rotation
# Run this script on production servers to configure logrotate

set -e

# Configuration
CONFIG_SOURCE="../../config/logrotate.conf"
CONFIG_DEST="/etc/logrotate.d/medical-records"
LOG_DIR="${LOG_DIR:-/app/logs}"
RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
ROTATION_SIZE="${LOG_ROTATION_SIZE:-5M}"

echo "Setting up logrotate for Medical Records Management System..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Check if logrotate is installed
if ! command -v logrotate &> /dev/null; then
    echo "Error: logrotate is not installed"
    echo "Install it with:"
    echo "  Ubuntu/Debian: apt-get install logrotate"
    echo "  CentOS/RHEL: yum install logrotate"
    exit 1
fi

# Check if source config exists
if [ ! -f "$CONFIG_SOURCE" ]; then
    echo "Error: Configuration file not found: $CONFIG_SOURCE"
    echo "Make sure you're running this script from the app/scripts directory"
    exit 1
fi

# Create log directory if it doesn't exist
if [ ! -d "$LOG_DIR" ]; then
    echo "Creating log directory: $LOG_DIR"
    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"
fi

# Copy and customize the configuration
echo "Installing logrotate configuration..."
cp "$CONFIG_SOURCE" "$CONFIG_DEST"

# Customize the configuration based on environment variables
sed -i "s|/app/logs/\*\.log|$LOG_DIR/*.log|g" "$CONFIG_DEST"
sed -i "s|rotate 30|rotate $RETENTION_DAYS|g" "$CONFIG_DEST"
sed -i "s|size 5M|size $ROTATION_SIZE|g" "$CONFIG_DEST"

echo "Configuration installed to: $CONFIG_DEST"

# Test the configuration
echo "Testing logrotate configuration..."
if logrotate -d "$CONFIG_DEST" > /tmp/logrotate-test.log 2>&1; then
    echo "✓ Configuration test passed"
else
    echo "✗ Configuration test failed:"
    cat /tmp/logrotate-test.log
    exit 1
fi

# Set the application to use logrotate
export LOG_ROTATION_METHOD="logrotate"

echo ""
echo "✓ Logrotate setup completed successfully!"
echo ""
echo "Configuration details:"
echo "  - Log directory: $LOG_DIR"
echo "  - Retention: $RETENTION_DAYS days"
echo "  - Size limit: $ROTATION_SIZE"
echo "  - Compression: enabled"
echo ""
echo "To verify the setup:"
echo "  logrotate -d $CONFIG_DEST"
echo ""
echo "To force rotation (for testing):"
echo "  logrotate -f $CONFIG_DEST"
echo ""
echo "Make sure to set LOG_ROTATION_METHOD=logrotate in your environment variables"