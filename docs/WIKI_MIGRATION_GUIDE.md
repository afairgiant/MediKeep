# Wiki Migration Guide

This guide explains how the documentation from `docs/developer-guide` has been migrated to the GitHub wiki.

## Migration Status

✅ **All documentation files have been prepared and are ready to push to the wiki!**

The wiki files are currently staged in `/tmp/MediKeep.wiki/` with all necessary updates applied.

## What Was Migrated

The following documentation files were migrated from `docs/developer-guide/` to the wiki:

| Original File | Wiki Page | Description |
|---------------|-----------|-------------|
| `README.md` | `Home.md` | Main documentation index and navigation |
| `00-quickstart.md` | `Quick-Start.md` | Developer quick start guide |
| `01-architecture.md` | `Architecture.md` | System architecture overview |
| `02-api-reference.md` | `API-Reference.md` | Complete API documentation |
| `03-database-schema.md` | `Database-Schema.md` | Database schema reference |
| `04-deployment.md` | `Deployment.md` | Deployment guide |
| `05-contributing.md` | `Contributing.md` | Contributing guidelines |
| `DOCUMENTATION_INDEX.md` | `Documentation-Index.md` | Documentation index |
| (new) | `_Sidebar.md` | Wiki navigation sidebar |

## Changes Applied

### 1. Link Updates
All internal documentation links were updated to work with GitHub wiki format:
- `00-quickstart.md` → `Quick-Start`
- `01-architecture.md` → `Architecture`
- `02-api-reference.md` → `API-Reference`
- `03-database-schema.md` → `Database-Schema`
- `04-deployment.md` → `Deployment`
- `05-contributing.md` → `Contributing`

### 2. External References
Links to other documentation files in the repository were converted to full GitHub URLs:
- `../SSO_QUICK_START.md` → `https://github.com/afairgiant/MediKeep/blob/main/docs/SSO_QUICK_START.md`
- Similar conversions for other cross-references

### 3. Navigation Sidebar
Created `_Sidebar.md` with organized navigation structure for easy access to all documentation.

## How to Push to Wiki (Manual)

If automated push doesn't work, you can manually push the wiki changes:

```bash
# Clone the wiki repository
cd /tmp
git clone https://github.com/afairgiant/MediKeep.wiki.git
cd MediKeep.wiki

# Copy the prepared wiki files
cp -r /tmp/MediKeep.wiki/* .

# Configure git (if needed)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Commit and push
git add -A
git commit -m "Migrate developer documentation from docs/developer-guide"
git push origin master
```

## Using the Script

A helper script has been provided at `scripts/push-to-wiki.sh` that automates this process.

**Usage:**
```bash
cd /home/runner/work/MediKeep/MediKeep
./scripts/push-to-wiki.sh
```

The script will:
1. Check if wiki files exist at `/tmp/MediKeep.wiki/`
2. Push changes to the wiki repository
3. Report success or failure

## Verification

After pushing, verify the wiki at:
- **Wiki Home:** https://github.com/afairgiant/MediKeep/wiki
- **Pages:** Check that all 8 pages are visible
- **Links:** Test internal links work correctly
- **Sidebar:** Verify navigation sidebar appears

## Maintaining Documentation

### Updating Wiki Content

When updating documentation:

1. **Edit source files** in `docs/developer-guide/`
2. **Run migration** to update wiki:
   ```bash
   ./scripts/push-to-wiki.sh
   ```
3. **Verify** changes appear on the wiki

### Best Practices

- Keep `docs/developer-guide/` as the source of truth
- Update wiki when documentation changes
- Test all links after updates
- Keep sidebar organized and up-to-date

## Troubleshooting

### Authentication Issues

If you get authentication errors when pushing:

**Option 1: Use Personal Access Token**
```bash
# Create a token at: https://github.com/settings/tokens
# Then use it for authentication
git push https://TOKEN@github.com/afairgiant/MediKeep.wiki.git master
```

**Option 2: Use GitHub CLI**
```bash
gh auth login
cd /tmp/MediKeep.wiki
git push origin master
```

**Option 3: SSH**
```bash
# If you have SSH keys set up
cd /tmp/MediKeep.wiki
git remote set-url origin git@github.com:afairgiant/MediKeep.wiki.git
git push origin master
```

### Wiki Not Updating

If changes don't appear:
1. Check GitHub wiki is enabled in repository settings
2. Verify push was successful: `git log -1`
3. Clear browser cache
4. Wait a few minutes for GitHub to process

### Link Issues

If links are broken:
1. Wiki links are case-sensitive
2. Use format: `[Link Text](Page-Name)` not `[Link Text](Page-Name.md)`
3. Anchors should be lowercase with hyphens: `#section-name`

## Status

- ✅ Documentation migrated
- ✅ Links updated
- ✅ Sidebar created
- ✅ Changes committed to local wiki clone
- ⏳ **PENDING:** Push to GitHub wiki repository

**Next Step:** Run `./scripts/push-to-wiki.sh` or manually push as described above.
