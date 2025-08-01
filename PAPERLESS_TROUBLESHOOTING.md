# Paperless Integration Troubleshooting Document

## Problem Statement
Files are not uploading to Paperless-ngx despite configuration appearing correct. Files show up in the lab results locally but don't appear in Paperless, and no error messages are displayed to the user.

## Current Configuration Status
- **Paperless Enabled**: True
- **Paperless URL**: http://192.168.0.175:8000
- **Has Credentials**: True (encrypted username/password stored)
- **Default Storage Backend**: paperless
- **Connection Test**: Working (credentials are valid)

## Database Investigation Results
Most recent file upload (ID: 19):
- **Storage Backend**: local (← PROBLEM: Should be 'paperless')
- **File Name**: Medical Records - Personal Health Management.pdf
- **Paperless Document ID**: None
- **File Path**: uploads\lab_result_files\a0c19356-43f8-41f4-b500-1ddd8d7d870d.pdf

## Root Cause Analysis

### Issue #1: Frontend Storage Backend Parameter (FIXED)
**Problem**: `uploadEntityFile()` only sent `storage_backend` if truthy value
**Fix**: Always send parameter with fallback to 'local'
**File**: `frontend/src/services/api/index.js:409-410`

### Issue #2: Overly Restrictive Default Selection (FIXED)
**Problem**: Added too restrictive logic for default backend selection
**Fix**: Use user's `default_storage_backend` preference directly
**File**: `frontend/src/components/shared/DocumentManager.js:83-89`

### Issue #3: Missing Credentials Check API Field (FIXED)  
**Problem**: Backend wasn't returning whether credentials exist
**Fix**: Added `paperless_has_credentials` boolean field
**Files**: `app/api/v1/endpoints/paperless.py:224-231, 307-316`

### Issue #4: Silent Failures (ATTEMPTED FIX)
**Problem**: No errors thrown when Paperless upload fails
**Fix**: Added validation and enhanced error messages
**Files**: 
- `app/services/generic_entity_file_service.py:121-137` (pre-upload validation)
- `frontend/src/components/shared/DocumentManager.js:206-240` (error handling)

## Current Problem: Silent Upload Failure
Despite fixes, files are still being uploaded to local storage instead of Paperless without any error messages.

### Debugging Steps Added
1. **Backend Logging**: Added debug logs to see what `storage_backend` parameter is received
2. **Frontend Logging**: Enhanced logging to track `selectedStorageBackend` values
3. **Form Data Validation**: Ensured `storage_backend` parameter is always sent

### Next Investigation Steps
1. **Check Browser Console**: Look for `document_manager_upload_attempt` logs to see what `selectedStorageBackend` value is being used
2. **Check Backend Logs**: Look for "File upload request" logs to see what `storage_backend` parameter is received
3. **Verify StorageBackendSelector**: Confirm that Paperless option is enabled and selectable in UI
4. **API Request Inspection**: Use browser dev tools to inspect the actual form data being sent

### Key Questions to Answer
1. Is the StorageBackendSelector showing Paperless as available and selected?
2. What value is `selectedStorageBackend` when upload is attempted?
3. What `storage_backend` parameter value is the backend receiving?
4. Is the upload routing to `_upload_to_paperless()` or `_upload_to_local()`?

### Verification Commands
```bash
# Check most recent file record
python -c "
from app.core.database import get_db
from app.models.models import EntityFile
db = next(get_db())
recent_file = db.query(EntityFile).order_by(EntityFile.uploaded_at.desc()).first()
print(f'Storage Backend: {recent_file.storage_backend}')
print(f'Paperless Doc ID: {recent_file.paperless_document_id}')
"

# Check user preferences
python -c "
from app.core.database import get_db
from app.crud.user_preferences import user_preferences
db = next(get_db())
user_prefs = user_preferences.get_by_user_id(db, user_id=1)
print(f'Default Backend: {user_prefs.default_storage_backend}')
print(f'Paperless Enabled: {user_prefs.paperless_enabled}')
"
```

## Files Modified
1. `frontend/src/components/shared/DocumentManager.js` - Storage backend selection and error handling
2. `frontend/src/services/api/index.js` - Form data construction
3. `app/api/v1/endpoints/paperless.py` - Added credentials check field
4. `app/services/generic_entity_file_service.py` - Added pre-upload validation
5. `frontend/src/components/shared/StorageBackendSelector.js` - Improved error messages

## Current Status
- ✅ Paperless connection test works
- ✅ Credentials are properly saved and encrypted
- ✅ Backend has proper error handling for Paperless uploads
- ❌ Files still saving to local storage instead of Paperless
- ❌ No error messages shown to user

## Immediate Next Steps
1. Add temporary alert/console.log in DocumentManager to show `selectedStorageBackend` value
2. Check browser network tab during upload to see actual form data
3. Add backend debug logging to confirm routing logic
4. Test with deliberately broken Paperless config to ensure errors are thrown