# Account Deletion Feature

## Overview

This feature allows users to permanently delete their own accounts and all associated medical data. The implementation includes comprehensive safety measures and proper audit logging.

## Backend Implementation

### Endpoint

- **URL**: `DELETE /api/v1/users/me`
- **Authentication**: Required (Bearer token)
- **Description**: Permanently deletes the current user's account and all associated data

### Safety Measures

1. **Last User Protection**: Prevents deletion of the last remaining user in the system
2. **Last Admin Protection**: Prevents deletion of the last remaining admin user
3. **Cascade Deletion**: Automatically deletes associated patient record and all medical data
4. **Audit Trail Preservation**: Nullifies foreign key references in activity logs while preserving the audit history

### Data Deleted

When a user deletes their account, the following data is permanently removed:

- User account (username, email, password, profile information)
- Patient record (if exists)
- All medical records including:
  - Medications and prescriptions
  - Lab results and medical files
  - Allergies and medical conditions
  - Procedures and treatments
  - Immunization records
  - Vital signs and measurements
  - Medical encounters and visits
  - Emergency contacts

### Error Handling

The endpoint returns appropriate HTTP status codes:

- `400 Bad Request`: When attempting to delete the last user or last admin
- `500 Internal Server Error`: For unexpected deletion failures
- `200 OK`: Successful deletion

## Frontend Implementation

### User Interface

The account deletion functionality is accessible through:

- **Settings Page**: Main entry point under "Account Management" section
- **Delete Account Modal**: Two-step confirmation process

### Safety Features

1. **Two-Step Confirmation Process**:

   - Step 1: Warning screen with detailed information about what will be deleted
   - Step 2: Text confirmation requiring user to type "DELETE MY ACCOUNT"

2. **Visual Warnings**:

   - Red color scheme to indicate danger
   - Warning icons and alerts
   - Clear listing of all data that will be deleted

3. **Prevention of Accidental Deletion**:
   - Modal cannot be closed during deletion process
   - Exact text matching required for confirmation
   - Multiple cancel opportunities

### Components

- **DeleteAccountModal**: Main modal component using Mantine UI library
- **Settings Page**: Updated to include account deletion section

## Security Considerations

1. **Authentication Required**: Only authenticated users can delete their own accounts
2. **Self-Service Only**: Users can only delete their own accounts (not others)
3. **Admin Protection**: System prevents lockout by protecting the last admin user
4. **Audit Logging**: All deletion attempts are logged for security auditing
5. **Irreversible Action**: No recovery mechanism exists (by design)

## Database Schema Impact

The implementation leverages existing SQLAlchemy cascade relationships:

- `Patient` model has `cascade="all, delete-orphan"` for all medical record relationships
- This ensures automatic cleanup of all related medical data when patient is deleted

## Activity Logging

All account deletion activities are logged with the following events:

- `last_user_deletion_attempt`: When someone tries to delete the last user
- `last_admin_deletion_attempt`: When someone tries to delete the last admin
- `patient_cascade_deletion`: When patient record and medical data are deleted
- `account_self_deletion`: When user account is successfully deleted
- `account_deletion_failed`: When deletion fails for any reason

## Usage Instructions

### For Users

1. Navigate to Settings page
2. Scroll to "Account Management" section
3. Click "Delete Account" button
4. Read through the warning information carefully
5. Click "I Understand, Continue" if you want to proceed
6. Type "DELETE MY ACCOUNT" exactly as shown
7. Click "Delete My Account Forever" to complete the process

### For Administrators

- Monitor activity logs for deletion attempts
- Ensure multiple admin accounts exist before allowing admin deletions
- Be aware that account deletion is irreversible

## Testing

To test the feature:

1. Create a test user account
2. Add some medical data (medications, conditions, etc.)
3. Navigate to Settings and attempt account deletion
4. Verify all safety measures work correctly
5. Check that all data is properly deleted from the database
6. Verify audit logs are created appropriately

## Future Enhancements

Potential improvements that could be added:

1. **Grace Period**: Add a 30-day grace period before permanent deletion
2. **Data Export**: Allow users to export their data before deletion
3. **Admin Override**: Allow admins to cancel pending deletions
4. **Backup Notification**: Send final backup to user's email before deletion
5. **Account Deactivation**: Option to deactivate instead of delete

## Dependencies

- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Frontend**: React, Mantine UI, @tabler/icons-react
- **Database**: PostgreSQL (or configured database)

## Files Modified/Created

### Backend

- `app/api/v1/endpoints/users.py`: Added DELETE endpoint
- Existing CRUD and logging systems leveraged

### Frontend

- `frontend/src/components/auth/DeleteAccountModal.js`: New modal component
- `frontend/src/components/auth/index.js`: Added export
- `frontend/src/pages/Settings.js`: Added account deletion section
