#!/bin/bash
# Setup script for Medical Records Management System log rotation
# Run this script on production servers to configure logrotate

set -e



# Input validation functions
validate_path() {
    local path="$1"
    local name="$2"
    
    # Check for path traversal attempts
    if [[ "$path" =~ \.\./|\.\.\\ ]]; then
        echo "Error: Path traversal detected in $name: $path"
        exit 1
    fi
    
    # Check for null bytes
    if [[ "$path" =~ $'\0' ]]; then
        echo "Error: Null byte detected in $name: $path"
        exit 1
    fi
    
    # Ensure path is absolute for critical directories
    if [[ "$name" == "LOG_DIR" && ! "$path" =~ ^/ ]]; then
        echo "Error: LOG_DIR must be an absolute path: $path"
        exit 1
    fi
}

validate_retention_days() {
    local days="$1"
    
    # Check if it's a positive integer
    if ! [[ "$days" =~ ^[1-9][0-9]*$ ]]; then
        echo "Error: LOG_RETENTION_DAYS must be a positive integer: $days"
        exit 1
    fi
    
    # Check reasonable bounds (1-3650 days / ~10 years)
    if [ "$days" -lt 1 ] || [ "$days" -gt 3650 ]; then
        echo "Error: LOG_RETENTION_DAYS must be between 1 and 3650: $days"
        exit 1
    fi
}

validate_rotation_size() {
    local size="$1"
    
    # Check format: number followed by K, M, or G (case insensitive)
    if ! [[ "$size" =~ ^[1-9][0-9]*[KMG]?$ ]]; then
        echo "Error: LOG_ROTATION_SIZE must be a number optionally followed by K, M, or G: $size"
        echo "Examples: 5M, 100K, 1G, 50"
        exit 1
    fi
    
    # Extract number and unit
    local number="${size%[KMG]}"
    local unit="${size: -1}"
    
    # Check reasonable bounds based on unit
    case "$unit" in
        K|k)
            if [ "$number" -lt 1 ] || [ "$number" -gt 1048576 ]; then  # 1K to 1GB in KB
                echo "Error: Size in KB must be between 1 and 1048576: $size"
                exit 1
            fi
            ;;
        M|m)
            if [ "$number" -lt 1 ] || [ "$number" -gt 1024 ]; then  # 1M to 1GB in MB
                echo "Error: Size in MB must be between 1 and 1024: $size"
                exit 1
            fi
            ;;
        G|g)
            if [ "$number" -lt 1 ] || [ "$number" -gt 10 ]; then  # 1G to 10GB
                echo "Error: Size in GB must be between 1 and 10: $size"
                exit 1
            fi
            ;;
        *)
            # No unit specified, assume bytes
            if [ "$number" -lt 1024 ] || [ "$number" -gt 1073741824 ]; then  # 1KB to 1GB in bytes
                echo "Error: Size in bytes must be between 1024 and 1073741824: $size"
                exit 1
            fi
            ;;
    esac
}

# Configuration with validation
CONFIG_SOURCE="../../config/logrotate.conf"
CONFIG_DEST="/etc/logrotate.d/medical-records"
LOG_DIR="${LOG_DIR:-/app/logs}"
RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
ROTATION_SIZE="${LOG_ROTATION_SIZE:-5M}"

# Validate all inputs
validate_path "$LOG_DIR" "LOG_DIR"
validate_retention_days "$RETENTION_DAYS"
validate_rotation_size "$ROTATION_SIZE"


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