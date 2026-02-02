# Wiki Migration Scripts

This directory contains scripts for migrating documentation from `docs/developer-guide` to the GitHub wiki.

## Available Scripts

### `migrate-to-wiki.sh`
Performs the complete migration process: clones/updates wiki repo, copies files, updates links, and commits changes.

**Usage:**
```bash
./scripts/migrate-to-wiki.sh
```

**What it does:**
1. Clones or updates the wiki repository in `/tmp/MediKeep.wiki/`
2. Copies all documentation files from `docs/developer-guide/`
3. Updates internal links to wiki format
4. Creates navigation sidebar
5. Commits changes locally

### `push-to-wiki.sh`
Pushes the prepared wiki changes to GitHub.

**Usage:**
```bash
./scripts/push-to-wiki.sh
```

**What it does:**
1. Checks if wiki directory exists with changes
2. Pushes changes to GitHub wiki repository
3. Reports success or provides troubleshooting steps

## Quick Start

To migrate documentation to the wiki:

```bash
# 1. Run the migration
./scripts/migrate-to-wiki.sh

# 2. Push to GitHub
./scripts/push-to-wiki.sh
```

## Authentication

If you encounter authentication issues when pushing, see the troubleshooting section in `docs/WIKI_MIGRATION_GUIDE.md`.

Common solutions:
- Use GitHub CLI: `gh auth login`
- Use Personal Access Token
- Use SSH authentication

## More Information

See [WIKI_MIGRATION_GUIDE.md](../docs/WIKI_MIGRATION_GUIDE.md) for complete documentation.
