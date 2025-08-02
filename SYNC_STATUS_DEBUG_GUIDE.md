# Sync Status Detection Debug Guide

## Current Issue
The user is not seeing sync status detection trigger. This guide identifies where sync should be happening and why it might not be working.

## System Architecture

### Components Being Used
- **Main Component**: `DocumentManagerWithProgress.js` (used by all medical pages)
- **Core Logic**: `DocumentManagerCore.js` (contains all sync logic)
- **UI Component**: `RenderModeContent.js` (renders the Sync Check button)

### Auto-Sync Implementation

#### Location: DocumentManagerCore.js lines 429-445
```javascript
// Auto-sync on component load when enabled and Paperless files exist
useEffect(() => {
  const shouldAutoSync = paperlessSettings?.paperless_auto_sync && 
                        files.some(f => f.storage_backend === 'paperless');
  
  if (shouldAutoSync) {
    logger.info('Auto-sync triggered on component load', {
      entityType,
      entityId,
      paperlessFilesCount: files.filter(f => f.storage_backend === 'paperless').length,
      autoSyncEnabled: paperlessSettings.paperless_auto_sync,
      component: 'DocumentManagerCore',
    });
    
    checkSyncStatus();
  }
}, [files, paperlessSettings?.paperless_auto_sync, checkSyncStatus, entityType, entityId]);
```

#### Periodic Sync: DocumentManagerCore.js lines 447-468
```javascript
// Optional: Periodic sync checking every 5 minutes when auto-sync is enabled
useEffect(() => {
  if (paperlessSettings?.paperless_auto_sync && files.some(f => f.storage_backend === 'paperless')) {
    const interval = setInterval(() => {
      logger.info('Periodic auto-sync check triggered', {
        entityType,
        entityId,
        component: 'DocumentManagerCore',
      });
      checkSyncStatus();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      clearInterval(interval);
      logger.debug('Periodic auto-sync interval cleared', {
        entityType,
        entityId,
        component: 'DocumentManagerCore',
      });
    };
  }
}, [paperlessSettings?.paperless_auto_sync, files, checkSyncStatus, entityType, entityId]);
```

## Conditions Required for Auto-Sync

### 1. Auto-Sync Must Be Enabled
- Setting: `paperlessSettings.paperless_auto_sync` must be `true`
- Location: User preferences/settings
- Check in: `StoragePreferencesCard.js` around line 177

### 2. Files Must Exist with Paperless Backend
- At least one file with `storage_backend === 'paperless'`
- Files are loaded via `loadFiles()` function

### 3. Paperless Must Be Enabled
- `paperlessSettings.paperless_enabled` must be `true`
- Paperless URL and credentials must be configured

### 4. Component Must Be in View or Edit Mode
- Not applicable to create mode initially

## Manual Sync Button

### Location: RenderModeContent.js lines 168-177
```javascript
<Button
  variant="light"
  size="xs"
  leftSection={<IconRefresh size={14} />}
  loading={syncLoading}
  onClick={onCheckSyncStatus}
  title="Check sync status with Paperless"
>
  Sync Check
</Button>
```

### Important: Only visible in EDIT mode!
The Sync Check button is only rendered when `mode === 'edit'` in RenderModeContent.js.

## Debugging Steps

### 1. Check Auto-Sync Setting
```javascript
// Add console log in DocumentManagerCore.js after line 430
console.log('DEBUG: Auto-sync check', {
  paperlessAutoSync: paperlessSettings?.paperless_auto_sync,
  paperlessEnabled: paperlessSettings?.paperless_enabled,
  paperlessFiles: files.filter(f => f.storage_backend === 'paperless'),
  totalFiles: files.length,
  shouldAutoSync: paperlessSettings?.paperless_auto_sync && files.some(f => f.storage_backend === 'paperless')
});
```

### 2. Check Files Loading
```javascript
// Add console log in DocumentManagerCore.js in loadFiles function around line 264
console.log('DEBUG: Files loaded', {
  entityType,
  entityId,
  fileCount: fileList.length,
  paperlessFiles: fileList.filter(f => f.storage_backend === 'paperless'),
  files: fileList
});
```

### 3. Check Settings Loading
```javascript
// Add console log in DocumentManagerCore.js in loadPaperlessSettings around line 215
console.log('DEBUG: Paperless settings loaded', {
  paperlessEnabled: settings?.paperless_enabled,
  paperlessAutoSync: settings?.paperless_auto_sync,
  hasUrl: !!settings?.paperless_url,
  hasCredentials: !!settings?.paperless_has_credentials,
  defaultBackend: settings?.default_storage_backend,
  fullSettings: settings
});
```

### 4. Check Sync Status Function Execution
```javascript
// Add console log at start of checkSyncStatus function around line 301
console.log('DEBUG: checkSyncStatus called', {
  isManualSync,
  paperlessFiles: files.filter(f => f.storage_backend === 'paperless'),
  paperlessEnabled: paperlessSettings?.paperless_enabled,
  entityType,
  entityId
});
```

## Common Issues and Solutions

### Issue 1: Auto-Sync Not Enabled
**Problem**: `paperless_auto_sync` setting is false
**Solution**: 
1. Go to Settings page
2. Enable "Automatically check sync status when loading Paperless files"
3. Save settings

### Issue 2: No Paperless Files
**Problem**: No files with `storage_backend === 'paperless'`
**Solution**: 
1. Upload files using Paperless storage backend
2. Or change existing file storage backend

### Issue 3: Paperless Not Configured
**Problem**: Paperless is not enabled or not properly configured
**Solution**:
1. Go to Settings page
2. Configure Paperless connection
3. Test connection
4. Enable Paperless integration

### Issue 4: Manual Sync Button Not Visible
**Problem**: User is in view mode, button only shows in edit mode
**Solution**: 
1. Switch to edit mode to see Sync Check button
2. Or add Sync Check button to view mode in RenderModeContent.js

### Issue 5: Sync Failing Silently
**Problem**: Sync is triggering but failing without user notification
**Solution**: Check browser console for error logs with filter "sync" or "paperless"

## Enhancement Recommendations

### 1. Add Sync Check to View Mode
Modify RenderModeContent.js to show sync check in view mode when Paperless files exist:

```javascript
// Add to view mode section around line 127
{files.some(f => f.storage_backend === 'paperless') && (
  <Group justify="space-between" align="center">
    <Text fw={500}>Files</Text>
    <Button
      variant="light"
      size="xs"
      leftSection={<IconRefresh size={14} />}
      loading={syncLoading}
      onClick={onCheckSyncStatus}
      title="Check sync status with Paperless"
    >
      Sync Check
    </Button>
  </Group>
)}
```

### 2. Add Visual Indicators
Add a small indicator showing when auto-sync is enabled:

```javascript
// Add next to storage backend selector
{paperlessSettings?.paperless_auto_sync && (
  <Badge size="xs" color="green" variant="light">
    Auto-sync enabled
  </Badge>
)}
```

### 3. Add Sync Status to Dashboard
Show global sync status on the main dashboard for quick overview.

### 4. Enhanced Debug Mode
Add a debug mode that shows:
- Current auto-sync setting
- Number of Paperless files
- Last sync check time
- Next scheduled sync time

## Testing the Fix

### 1. Enable Auto-Sync
1. Go to Settings
2. Enable "Automatically check sync status when loading Paperless files"
3. Save settings

### 2. Create Test Paperless File
1. Go to any medical record (Lab Results, Procedures, etc.)
2. Switch to edit mode
3. Upload a file using Paperless storage backend
4. Save the record

### 3. Verify Auto-Sync
1. Reload the page
2. Check browser console for auto-sync logs
3. Verify sync status is checked automatically

### 4. Test Manual Sync
1. Go to edit mode on a record with Paperless files
2. Click "Sync Check" button
3. Verify notification appears with sync results

## Log Filters for Debugging

Use these browser console filters to see relevant logs:
- `paperless_auto_sync`
- `Auto-sync triggered`
- `Paperless sync status check`
- `checkSyncStatus`
- `component: 'DocumentManagerCore'`

## Files to Monitor

Key files that contain sync logic:
- `DocumentManagerCore.js` - Main sync logic
- `RenderModeContent.js` - Sync button UI
- `DocumentManagerWithProgress.js` - Component integration
- `StoragePreferencesCard.js` - Auto-sync settings
- `paperlessApi.js` - API calls