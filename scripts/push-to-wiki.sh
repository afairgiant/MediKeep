#!/bin/bash
#
# Push Wiki Migration Script
# 
# This script pushes the migrated documentation from docs/developer-guide
# to the GitHub wiki repository.
#
# Usage: ./scripts/push-to-wiki.sh
#

set -e  # Exit on error

WIKI_DIR="/tmp/MediKeep.wiki"
WIKI_URL="https://github.com/afairgiant/MediKeep.wiki.git"

echo "========================================="
echo "MediKeep Wiki Migration Push Script"
echo "========================================="
echo ""

# Check if wiki directory exists
if [ ! -d "$WIKI_DIR" ]; then
    echo "❌ Error: Wiki directory not found at $WIKI_DIR"
    echo ""
    echo "The wiki files need to be prepared first."
    echo "Please run the migration process or check WIKI_MIGRATION_GUIDE.md"
    exit 1
fi

# Check if there are changes to push
cd "$WIKI_DIR"

if ! git diff --quiet HEAD 2>/dev/null; then
    echo "✅ Found uncommitted changes in wiki directory"
    echo "   Committing changes..."
    git add -A
    git commit -m "Update documentation from docs/developer-guide" || true
elif [ "$(git rev-list --count origin/master..HEAD 2>/dev/null || echo 0)" -eq 0 ]; then
    echo "ℹ️  No new commits to push (already up to date)"
    echo ""
    echo "If you expected changes, verify that:"
    echo "  1. Files were copied to $WIKI_DIR"
    echo "  2. Changes were committed"
    exit 0
fi

echo ""
echo "📤 Pushing changes to GitHub wiki..."
echo "   Repository: $WIKI_URL"
echo ""

# Attempt to push
if git push origin master 2>&1 | tee /tmp/push_output.log; then
    echo ""
    echo "========================================="
    echo "✅ SUCCESS!"
    echo "========================================="
    echo ""
    echo "Documentation has been pushed to the wiki!"
    echo ""
    echo "📍 View the wiki at:"
    echo "   https://github.com/afairgiant/MediKeep/wiki"
    echo ""
    echo "📄 Available pages:"
    echo "   - Home"
    echo "   - Quick-Start"
    echo "   - Architecture"
    echo "   - API-Reference"
    echo "   - Database-Schema"
    echo "   - Deployment"
    echo "   - Contributing"
    echo "   - Documentation-Index"
    echo ""
else
    echo ""
    echo "========================================="
    echo "❌ Push Failed"
    echo "========================================="
    echo ""
    echo "The push to the wiki repository failed."
    echo "This is likely due to authentication issues."
    echo ""
    echo "Options to fix this:"
    echo ""
    echo "1️⃣  Use GitHub CLI (recommended):"
    echo "   gh auth login"
    echo "   cd $WIKI_DIR"
    echo "   git push origin master"
    echo ""
    echo "2️⃣  Use Personal Access Token:"
    echo "   Create token at: https://github.com/settings/tokens"
    echo "   cd $WIKI_DIR"
    echo "   git push https://TOKEN@github.com/afairgiant/MediKeep.wiki.git master"
    echo ""
    echo "3️⃣  Use SSH (if configured):"
    echo "   cd $WIKI_DIR"
    echo "   git remote set-url origin git@github.com:afairgiant/MediKeep.wiki.git"
    echo "   git push origin master"
    echo ""
    echo "See docs/WIKI_MIGRATION_GUIDE.md for more details."
    echo ""
    exit 1
fi
