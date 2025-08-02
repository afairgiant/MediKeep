import { notifications } from '@mantine/notifications';
import { useCallback } from 'react';

// Utility function for file size formatting
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Custom hook for backup-specific notifications with user-friendly messaging
 */
export const useBackupNotifications = () => {
  // User-friendly operation labels
  const getOperationLabel = useCallback((actionName) => {
    const labels = {
      createDatabaseBackup: 'Database Backup',
      createFilesBackup: 'Files Backup', 
      createFullBackup: 'Full System Backup',
      uploadBackup: 'Backup Upload',
      downloadBackup: 'Backup Download',
      verifyBackup: 'Backup Verification',
      deleteBackup: 'Backup Deletion',
      cleanupBackups: 'Backup Cleanup',
      cleanupAllOldData: 'Complete System Cleanup',
      restoreBackup: 'System Restoration'
    };
    return labels[actionName] || actionName;
  }, []);

  // User-friendly success messages
  const getSuccessMessage = useCallback((actionName, result = null) => {
    const messages = {
      createDatabaseBackup: 'Database backup completed successfully! Your patient data is now safely backed up.',
      createFilesBackup: 'Files backup completed successfully! Your document files have been backed up.',
      createFullBackup: 'Complete system backup finished successfully! All your data is now safely secured.',
      uploadBackup: result?.backup_type 
        ? `Backup uploaded successfully! Type: ${result.backup_type}, Size: ${formatFileSize(result.backup_size)}`
        : 'Backup file uploaded successfully!',
      downloadBackup: 'Backup file downloaded successfully to your device.',
      verifyBackup: 'Backup verification completed! The backup file integrity is confirmed.',
      deleteBackup: 'Backup deleted successfully! The backup file and record have been removed.',
      cleanupBackups: result?.total_deleted 
        ? `Cleanup completed successfully! ${result.total_deleted} old backup files were removed.`
        : 'Backup cleanup completed successfully!',
      cleanupAllOldData: result?.total_files_cleaned
        ? `Complete cleanup finished successfully! ${result.total_files_cleaned} files were removed, freeing up storage space.`
        : 'Complete system cleanup finished successfully!',
      restoreBackup: result?.safety_backup_id
        ? `System restored successfully! A safety backup (ID: ${result.safety_backup_id}) was created before restoration.`
        : 'System restoration completed successfully!'
    };
    
    return messages[actionName] || `${getOperationLabel(actionName)} completed successfully!`;
  }, [getOperationLabel]);

  // User-friendly error messages
  const getErrorMessage = useCallback((actionName, error) => {
    const baseMessages = {
      createDatabaseBackup: 'Failed to create database backup. Please check system status and try again.',
      createFilesBackup: 'Failed to create files backup. Please ensure sufficient storage space is available.',
      createFullBackup: 'Failed to create complete system backup. Please check system resources and try again.',
      uploadBackup: 'Failed to upload backup file. Please check the file format and try again.',
      downloadBackup: 'Failed to download backup file. The file may be corrupted or missing.',
      verifyBackup: 'Backup verification failed. The backup file may be corrupted.',
      deleteBackup: 'Failed to delete backup. Please try again or contact support.',
      cleanupBackups: 'Backup cleanup failed. Some files may be in use.',
      cleanupAllOldData: 'System cleanup failed. Please check for running processes and try again.',
      restoreBackup: 'System restoration failed. Your original data remains unchanged.'
    };

    const baseMessage = baseMessages[actionName] || `${getOperationLabel(actionName)} failed.`;
    
    // Add specific error details if available
    if (error?.message) {
      return `${baseMessage} Error: ${error.message}`;
    }
    
    return baseMessage;
  }, [getOperationLabel]);

  // Show success notification
  const showSuccess = useCallback((actionName, result = null) => {
    const title = `${getOperationLabel(actionName)} Successful`;
    const message = getSuccessMessage(actionName, result);
    
    notifications.show({
      title,
      message,
      color: 'green',
      icon: '✅',
      autoClose: 8000, // 8 seconds for success messages
      position: 'top-right',
      withCloseButton: true,
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.green[0],
          borderColor: theme.colors.green[6],
          '&::before': { backgroundColor: theme.colors.green[6] },
        },
        title: { color: theme.colors.green[9] },
        description: { color: theme.colors.green[7] },
        closeButton: {
          color: theme.colors.green[7],
          '&:hover': { backgroundColor: theme.colors.green[1] },
        },
      }),
    });
  }, [getOperationLabel, getSuccessMessage]);

  // Show error notification
  const showError = useCallback((actionName, error) => {
    const title = `${getOperationLabel(actionName)} Failed`;
    const message = getErrorMessage(actionName, error);
    
    notifications.show({
      title,
      message,
      color: 'red',
      icon: '❌',
      autoClose: 12000, // 12 seconds for error messages (longer to read)
      position: 'top-right',
      withCloseButton: true,
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.red[0],
          borderColor: theme.colors.red[6],
          '&::before': { backgroundColor: theme.colors.red[6] },
        },
        title: { color: theme.colors.red[9] },
        description: { color: theme.colors.red[7] },
        closeButton: {
          color: theme.colors.red[7],
          '&:hover': { backgroundColor: theme.colors.red[1] },
        },
      }),
    });
  }, [getOperationLabel, getErrorMessage]);

  // Show loading notification for long operations
  const showLoading = useCallback((actionName) => {
    const title = `${getOperationLabel(actionName)} in Progress`;
    const message = `Please wait while the ${getOperationLabel(actionName).toLowerCase()} completes...`;
    
    const id = `loading-${actionName}-${Date.now()}`;
    
    notifications.show({
      id,
      title,
      message,
      color: 'blue',
      icon: '⏳',
      loading: true,
      autoClose: false, // Don't auto-close loading notifications
      withCloseButton: false,
      position: 'top-right',
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.blue[0],
          borderColor: theme.colors.blue[6],
          '&::before': { backgroundColor: theme.colors.blue[6] },
        },
        title: { color: theme.colors.blue[9] },
        description: { color: theme.colors.blue[7] },
      }),
    });
    
    return id; // Return ID so caller can hide this notification
  }, [getOperationLabel]);

  // Hide loading notification
  const hideLoading = useCallback((id) => {
    if (id) {
      notifications.hide(id);
    }
  }, []);

  // Show warning notification
  const showWarning = useCallback((title, message) => {
    notifications.show({
      title,
      message,
      color: 'yellow',
      icon: '⚠️',
      autoClose: 10000, // 10 seconds for warnings
      position: 'top-right',
      withCloseButton: true,
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.yellow[0],
          borderColor: theme.colors.yellow[6],
          '&::before': { backgroundColor: theme.colors.yellow[6] },
        },
        title: { color: theme.colors.yellow[9] },
        description: { color: theme.colors.yellow[7] },
        closeButton: {
          color: theme.colors.yellow[7],
          '&:hover': { backgroundColor: theme.colors.yellow[1] },
        },
      }),
    });
  }, []);

  return {
    showSuccess,
    showError,
    showLoading,
    hideLoading,
    showWarning,
    getOperationLabel
  };
};

