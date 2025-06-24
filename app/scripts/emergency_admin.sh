#!/bin/bash

# Emergency Admin User Creation - Shell Wrapper
# This script provides an easy way to create emergency admin users

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚨 Medical Records - Emergency Admin Creator${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check if we're in a Docker container
if [ -f /.dockerenv ]; then
    echo -e "${GREEN}📦 Running inside Docker container${NC}"
    PYTHON_CMD="python"
else
    echo -e "${YELLOW}💻 Running on host machine${NC}"
    # Try to find python
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo -e "${RED}❌ Python not found. Please install Python 3.7+${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}🐍 Using Python: $PYTHON_CMD${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Run the Python script with all passed arguments
echo -e "${GREEN}🚀 Starting emergency admin creation...${NC}"
echo ""

exec "$PYTHON_CMD" app/scripts/create_emergency_admin.py "$@" 