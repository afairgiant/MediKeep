#!/bin/bash
#
# Wiki Migration Script
# 
# This script migrates documentation from docs/developer-guide to the GitHub wiki.
# It handles cloning, copying files, updating links, and preparing for push.
#
# Usage: ./scripts/migrate-to-wiki.sh
#

set -e  # Exit on error

REPO_ROOT="/home/runner/work/MediKeep/MediKeep"
WIKI_DIR="/tmp/MediKeep.wiki"
WIKI_URL="https://github.com/afairgiant/MediKeep.wiki.git"
DOCS_DIR="$REPO_ROOT/docs/developer-guide"

echo "========================================="
echo "MediKeep Wiki Migration Script"
echo "========================================="
echo ""

# Step 1: Clone or update wiki repository
echo "📥 Step 1: Preparing wiki repository..."
if [ -d "$WIKI_DIR" ]; then
    echo "   Wiki directory exists, pulling latest changes..."
    cd "$WIKI_DIR"
    git pull origin master || echo "   (Pull may have failed, continuing...)"
else
    echo "   Cloning wiki repository..."
    git clone "$WIKI_URL" "$WIKI_DIR"
fi

cd "$WIKI_DIR"
echo "✅ Wiki repository ready"
echo ""

# Step 2: Copy documentation files
echo "📋 Step 2: Copying documentation files..."
cp "$DOCS_DIR/README.md" "$WIKI_DIR/Home.md"
cp "$DOCS_DIR/00-quickstart.md" "$WIKI_DIR/Quick-Start.md"
cp "$DOCS_DIR/01-architecture.md" "$WIKI_DIR/Architecture.md"
cp "$DOCS_DIR/02-api-reference.md" "$WIKI_DIR/API-Reference.md"
cp "$DOCS_DIR/03-database-schema.md" "$WIKI_DIR/Database-Schema.md"
cp "$DOCS_DIR/04-deployment.md" "$WIKI_DIR/Deployment.md"
cp "$DOCS_DIR/05-contributing.md" "$WIKI_DIR/Contributing.md"
cp "$DOCS_DIR/DOCUMENTATION_INDEX.md" "$WIKI_DIR/Documentation-Index.md"
echo "✅ Files copied"
echo ""

# Step 3: Update links
echo "🔗 Step 3: Updating documentation links..."

update_links() {
    local file="$1"
    
    # Update links to documentation files
    sed -i 's|\[Quick Start Guide\](00-quickstart\.md)|[Quick Start Guide](Quick-Start)|g' "$file"
    sed -i 's|\[Architecture Overview\](01-architecture\.md)|[Architecture Overview](Architecture)|g' "$file"
    sed -i 's|\[API Reference\](02-api-reference\.md)|[API Reference](API-Reference)|g' "$file"
    sed -i 's|\[Database Schema\](03-database-schema\.md)|[Database Schema](Database-Schema)|g' "$file"
    sed -i 's|\[Deployment Guide\](04-deployment\.md)|[Deployment Guide](Deployment)|g' "$file"
    sed -i 's|\[Development Guide\](05-contributing\.md)|[Development Guide](Contributing)|g' "$file"
    sed -i 's|\[Contributing Guide\](05-contributing\.md)|[Contributing Guide](Contributing)|g' "$file"
    sed -i 's|(README\.md)|(Home)|g' "$file"
    sed -i 's|(DOCUMENTATION_INDEX\.md)|(Documentation-Index)|g' "$file"
    
    # Remove relative path references
    sed -i 's|(../../README\.md)|(Home)|g' "$file"
    sed -i 's|(../SSO_QUICK_START\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/SSO_QUICK_START.md|g' "$file"
    sed -i 's|(../SSO_SETUP_GUIDE\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/SSO_SETUP_GUIDE.md|g' "$file"
    sed -i 's|(../SSO_TECHNICAL_OVERVIEW\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/SSO_TECHNICAL_OVERVIEW.md|g' "$file"
    sed -i 's|(../api/PATIENT_SHARING_INVITATIONS_API\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/api/PATIENT_SHARING_INVITATIONS_API.md|g' "$file"
    sed -i 's|(../examples/PATIENT_SHARING_EXAMPLES\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/examples/PATIENT_SHARING_EXAMPLES.md|g' "$file"
    sed -i 's|(../workflows/PATIENT_SHARE_INVITATION_WORKFLOW\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/workflows/PATIENT_SHARE_INVITATION_WORKFLOW.md|g' "$file"
    sed -i 's|(../BIND_MOUNT_PERMISSIONS\.md)|https://github.com/afairgiant/MediKeep/blob/main/docs/BIND_MOUNT_PERMISSIONS.md|g' "$file"
    
    # Update anchor-style links within same document
    sed -i 's|\](00-quickstart\.md#|\](Quick-Start#|g' "$file"
    sed -i 's|\](01-architecture\.md#|\](Architecture#|g' "$file"
    sed -i 's|\](02-api-reference\.md#|\](API-Reference#|g' "$file"
    sed -i 's|\](03-database-schema\.md#|\](Database-Schema#|g' "$file"
    sed -i 's|\](04-deployment\.md#|\](Deployment#|g' "$file"
    sed -i 's|\](05-contributing\.md#|\](Contributing#|g' "$file"
}

for file in "$WIKI_DIR"/*.md; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "_Sidebar.md" ]; then
        echo "   Updating $(basename "$file")..."
        update_links "$file"
    fi
done

echo "✅ Links updated"
echo ""

# Step 4: Create sidebar
echo "🗂️  Step 4: Creating navigation sidebar..."
cat > "$WIKI_DIR/_Sidebar.md" << 'EOF'
# MediKeep Wiki

## 🏠 Home
* **[Home](Home)**
* **[Documentation Index](Documentation-Index)**

---

## 📚 Getting Started
* **[Quick Start Guide](Quick-Start)**
  * Development Setup
  * Docker Setup
  * Troubleshooting

---

## 🏗️ Core Documentation
* **[Architecture](Architecture)**
  * System Overview
  * Frontend Architecture
  * Backend Architecture
  * Database Design

* **[API Reference](API-Reference)**
  * Authentication
  * Endpoints
  * Request/Response

* **[Database Schema](Database-Schema)**
  * Tables Reference
  * Relationships
  * Migrations

---

## 🚀 Deployment
* **[Deployment Guide](Deployment)**
  * Docker Deployment
  * Cloud Deployment
  * Configuration
  * Security

---

## 🤝 Contributing
* **[Contributing Guide](Contributing)**
  * Code Standards
  * Development Workflow
  * Testing
  * Pull Requests

---

## 🔗 External Links
* [Main Repository](https://github.com/afairgiant/MediKeep)
* [Issues](https://github.com/afairgiant/MediKeep/issues)
* [Discussions](https://github.com/afairgiant/MediKeep/discussions)
EOF

echo "✅ Sidebar created"
echo ""

# Step 5: Configure git and commit
echo "💾 Step 5: Committing changes..."
cd "$WIKI_DIR"
git config user.name "MediKeep Bot" || true
git config user.email "bot@medikeep.dev" || true

git add -A

if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit (already up to date)"
else
    git commit -m "Migrate developer documentation from docs/developer-guide

- Added comprehensive Home page with navigation
- Migrated Quick Start Guide (00-quickstart.md → Quick-Start.md)
- Migrated Architecture Overview (01-architecture.md → Architecture.md)
- Migrated API Reference (02-api-reference.md → API-Reference.md)
- Migrated Database Schema (03-database-schema.md → Database-Schema.md)
- Migrated Deployment Guide (04-deployment.md → Deployment.md)
- Migrated Contributing Guide (05-contributing.md → Contributing.md)
- Migrated Documentation Index (DOCUMENTATION_INDEX.md → Documentation-Index.md)
- Created navigation sidebar (_Sidebar.md)
- Updated all internal links to work with wiki format
- Converted external file references to GitHub repository URLs"
    echo "✅ Changes committed"
fi

echo ""
echo "========================================="
echo "✅ Migration Complete!"
echo "========================================="
echo ""
echo "The documentation has been migrated and committed locally."
echo ""
echo "📍 Wiki files are ready at:"
echo "   $WIKI_DIR"
echo ""
echo "📤 Next step: Push to GitHub wiki"
echo "   Run: ./scripts/push-to-wiki.sh"
echo ""
echo "📄 Or push manually:"
echo "   cd $WIKI_DIR"
echo "   git push origin master"
echo ""
echo "See docs/WIKI_MIGRATION_GUIDE.md for more information."
echo ""
