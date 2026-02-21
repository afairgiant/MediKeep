# Admin Guide

This guide covers the administrative features available to users with the **admin** role in MediKeep.

---

## Overview

Admin users have access to a dedicated Admin Panel with system-wide management capabilities. Regular users manage their own patients and records; admins can additionally manage users, reference data, backups, and system health.

To access the Admin Panel, click the **Admin** link in the navigation sidebar (visible only to admin users).

---

## Admin Dashboard

The Admin Dashboard provides a system overview at a glance:

- **User count** - Total registered users
- **Patient count** - Total patient profiles in the system
- **Storage usage** - Disk space used by uploads and documents
- **System health** - Database status and connectivity
- **Quick actions** - Shortcuts to common admin tasks

---

## User Management

Admins can manage all user accounts in the system.

### Viewing Users

- Browse all registered users with search and filter
- View user details including registration date, last login, and role

### Creating Users

- Create new user accounts with username, email, and password
- Assign role (user or admin)

### Editing Users

- Update user details (name, email)
- Change user roles

### Password Reset

- Reset a user's password from the admin panel
- The user will need to use the new password on their next login

### Deactivating / Deleting Users

- Deactivate users to prevent login without removing their data
- Delete user accounts (cascades cleanup of related data)

---

## Data Model Management

Admins can perform CRUD operations on reference data and lookup tables used throughout the system. This includes:

- **Injury Types** - Predefined injury type classifications available to all users
- **Encounter Types** - Visit/encounter type options
- **Standardized Lab Tests** - Lab test definitions with reference ranges
- **Other Lookup Tables** - Any model in the system can be viewed and managed

### How to Use

1. Navigate to **Admin Panel** > **Model Management**
2. Select a model from the list of available models
3. Browse, create, edit, or delete records
4. All changes are logged in the activity log

---

## Backup & Restore

MediKeep includes a built-in backup system for database protection.

### Creating Backups

1. Go to **Admin Panel** > **Backups**
2. Click **Create Backup**
3. The system creates a database backup and confirms when complete

### Viewing Backup History

- Browse all backups with creation date and size
- Paginated list for easy navigation

### Restoring from Backup

1. Find the backup you want to restore in the backup list
2. Click **Restore**
3. Confirm the restore operation
4. The system restores the database to the selected backup state

**Warning:** Restoring a backup replaces the current database state. Make sure to create a fresh backup before restoring an older one.

### Deleting Backups

- Remove old backups that are no longer needed
- Configure retention settings to control how long backups are kept (by days, minimum count, and maximum count)

---

## Trash Management

When records are soft-deleted by users, they go to the trash rather than being permanently removed.

- **View trashed records** - Browse soft-deleted records across all models
- **Restore records** - Recover accidentally deleted records
- **Permanently delete** - Remove records from the system entirely

---

## System Health

Monitor the health and status of your MediKeep instance:

- **Database status** - Connection health and performance
- **Storage usage** - Disk space consumption
- **System metrics** - Overview of system resource usage

---

## Activity Logging

All administrative actions are automatically recorded in the activity log:

- **What was done** - Create, read, update, or delete operations
- **Which record** - The entity type and record ID affected
- **Who did it** - The admin user who performed the action
- **When** - Timestamp of the action

This provides a complete audit trail for administrative operations.

---

## Maintenance

Admins can run maintenance tasks to keep the system clean:

- **Clean up expired invitations** - Remove invitations that have passed their expiration date
- **Purge soft-deleted records** - Permanently remove records that have been in the trash
- **Database optimization** - Run optimization routines for improved performance

---

## Need Help?

- [User Guide](User-Guide) - End-user documentation
- [Deployment Guide](Deployment-Guide) - Server setup and configuration
- [FAQ](FAQ) - Common questions
