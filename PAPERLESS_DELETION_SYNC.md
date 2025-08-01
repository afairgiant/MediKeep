# Paperless File Deletion Synchronization Options

## Problem Statement
When files are deleted directly in Paperless-ngx (outside of the Medical Records app), the app's database still retains records pointing to non-existent documents. This creates orphaned records and potential user confusion when files appear available but cannot be downloaded.

## Current Behavior
- **App → Paperless deletion**: ✅ Works properly (deletes from both systems)
- **Paperless → App deletion**: ❌ No automatic sync (creates orphaned records)

## Proposed Solutions

### Option 1: Reactive Cleanup (Recommended - Simple)
**Implementation**: When download/access fails with "document not found", automatically remove the database record.

**Pros**:
- Simple to implement
- No additional infrastructure needed
- Self-healing on user interaction
- Minimal performance impact

**Cons**:
- Only cleans up when users try to access orphaned files
- Delayed cleanup (not immediate)

### Option 2: Periodic Sync Job
**Implementation**: Background task that regularly compares database records with Paperless documents and removes orphans.

**Pros**:
- Proactive cleanup
- Complete synchronization
- Can detect and fix other inconsistencies

**Cons**:
- More complex implementation
- Requires task scheduler/worker
- Potential performance impact on large datasets
- May hit Paperless API rate limits

### Option 3: Webhook Integration
**Implementation**: Configure Paperless to send webhooks on document deletion, listen and update database accordingly.

**Pros**:
- Real-time synchronization
- Most accurate approach
- Immediate cleanup

**Cons**:
- Requires Paperless webhook support
- Network dependency
- More complex setup and error handling
- Potential security considerations

### Option 4: Manual Sync API
**Implementation**: Admin endpoint to manually trigger sync and cleanup operations.

**Pros**:
- Full control over sync timing
- Good for troubleshooting
- Can be combined with other approaches

**Cons**:
- Requires manual intervention
- Not automatic
- Admin overhead

## Recommended Implementation Plan

### Phase 1: Reactive Cleanup (Immediate)
1. Modify `_get_paperless_download_info()` method
2. Catch "document not found" errors
3. Mark database record as `sync_status='failed'` or delete entirely
4. Log cleanup actions for monitoring

### Phase 2: Manual Sync API (Future)
1. Create admin endpoint for manual sync operations
2. Provide sync status reporting
3. Allow bulk cleanup of failed records

### Phase 3: Periodic Sync (Optional)
1. Implement if reactive cleanup proves insufficient
2. Add configurable sync intervals
3. Include performance monitoring

## Database Schema Considerations
The existing `sync_status` and `last_sync_at` fields support these approaches:
- `sync_status`: 'synced', 'pending', 'failed'
- `last_sync_at`: Track last successful sync

## Error Handling Strategy
- Log all cleanup actions for audit trail
- Preserve record metadata before deletion
- Provide user feedback when orphaned files are cleaned up
- Maintain sync statistics for monitoring

## Next Steps
1. Implement Phase 1 (Reactive Cleanup)
2. Test with deliberately deleted Paperless documents
3. Monitor cleanup frequency and effectiveness
4. Evaluate need for additional phases based on usage patterns