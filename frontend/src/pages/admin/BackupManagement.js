import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/api/adminApi';
import AdminHeader from '../../components/admin/AdminHeader';
import '../../components/admin/AdminHeader.css';
import './BackupManagement.css';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState({
    database: false,
    files: false,
    full: false,
  });
  const [restoring, setRestoring] = useState({});
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  // Get user info from token for header
  const getUserFromToken = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        username: payload.sub,
        role: payload.role,
        fullName: payload.full_name || payload.sub,
      };
    } catch (error) {
      return null;
    }
  };

  const user = getUserFromToken();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Load backups on component mount
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.getBackups();
      setBackups(data.backups || []);
    } catch (error) {
      console.error('Error loading backups:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load backups: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async type => {
    try {
      setCreating(prev => ({ ...prev, [type]: true }));
      setMessage({ type: '', text: '' });

      const description = `Manual ${type} backup created on ${new Date().toLocaleString()}`;

      if (type === 'database') {
        await adminApiService.createDatabaseBackup(description);
      } else if (type === 'files') {
        await adminApiService.createFilesBackup(description);
      } else if (type === 'full') {
        await adminApiService.createFullBackup(description);
      }

      const typeText =
        type === 'database'
          ? 'Database'
          : type === 'files'
            ? 'Files'
            : 'Full system';
      setMessage({
        type: 'success',
        text: `${typeText} backup created successfully!`,
      });

      // Reload backups to show the new one
      await loadBackups();
    } catch (error) {
      console.error(`Error creating ${type} backup:`, error);
      setMessage({
        type: 'error',
        text: `Failed to create ${type} backup: ` + error.message,
      });
    } finally {
      setCreating(prev => ({ ...prev, [type]: false }));
    }
  };

  const uploadBackup = async event => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.sql') && !filename.endsWith('.zip')) {
      setMessage({
        type: 'error',
        text: 'Please select a .sql or .zip backup file',
      });
      return;
    }

    try {
      setUploading(true);
      setMessage({ type: '', text: '' });

      const result = await adminApiService.uploadBackup(file);

      setMessage({
        type: 'success',
        text: `Backup uploaded successfully! Type: ${result.backup_type}, Size: ${formatFileSize(result.backup_size)}`,
      });

      // Reload backups to show the uploaded one
      await loadBackups();

      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading backup:', error);
      setMessage({
        type: 'error',
        text: 'Failed to upload backup: ' + error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadBackup = async (backupId, filename) => {
    try {
      const blob = await adminApiService.downloadBackup(backupId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (error) {
      console.error('Error downloading backup:', error);
      setMessage({
        type: 'error',
        text: 'Failed to download backup: ' + error.message,
      });
    }
  };

  const verifyBackup = async backupId => {
    try {
      const result = await adminApiService.verifyBackup(backupId);

      let statusText;
      if (result.verified) {
        statusText = 'Backup is valid!';
      } else if (result.status_updated) {
        statusText = `Backup verification failed: ${result.status_updated}`;
      } else {
        statusText = 'Backup verification failed!';
      }

      setMessage({
        type: result.verified ? 'success' : 'error',
        text: statusText,
      });

      // Reload backups to show updated status
      await loadBackups();
    } catch (error) {
      console.error('Error verifying backup:', error);
      setMessage({
        type: 'error',
        text: 'Failed to verify backup: ' + error.message,
      });
    }
  };

  const deleteBackup = async (backupId, filename) => {
    try {
      const confirmDelete = window.confirm(
        `Are you sure you want to delete backup "${filename}"?\n\n` +
          `This will permanently remove:\n` +
          `- The backup file from storage\n` +
          `- The backup record from the database\n\n` +
          `This action cannot be undone.`
      );

      if (!confirmDelete) return;

      const result = await adminApiService.deleteBackup(backupId);

      setMessage({
        type: 'success',
        text: result.message,
      });

      // Reload backups to remove the deleted one
      await loadBackups();
    } catch (error) {
      console.error('Error deleting backup:', error);
      setMessage({
        type: 'error',
        text: 'Failed to delete backup: ' + error.message,
      });
    }
  };

  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleString();
  };

  const cleanupOldBackups = async () => {
    try {
      const result = await adminApiService.cleanupBackups();
      const trackedDeleted = result.deleted_count || 0;
      const orphanedDeleted = result.orphaned_deleted || 0;
      const totalDeleted =
        result.total_deleted || trackedDeleted + orphanedDeleted;

      setMessage({
        type: 'success',
        text: `Cleanup completed: ${totalDeleted} files removed (${trackedDeleted} tracked backups, ${orphanedDeleted} orphaned files)`,
      });
      await loadBackups(); // Refresh the list
    } catch (error) {
      console.error('Error cleaning up backups:', error);
      setMessage({
        type: 'error',
        text: 'Failed to cleanup old backups: ' + error.message,
      });
    }
  };

  const cleanupAllOldData = async () => {
    try {
      const result = await adminApiService.cleanupAllOldData();
      const totalFiles = result.total_files_cleaned || 0;
      const summary = result.summary || {};

      setMessage({
        type: 'success',
        text: `Complete cleanup finished: ${totalFiles} files removed (${summary.tracked_backups_deleted || 0} tracked backups, ${summary.orphaned_backups_deleted || 0} orphaned backups, ${summary.trash_files_deleted || 0} trash files)`,
      });
      await loadBackups(); // Refresh the list
    } catch (error) {
      console.error('Error cleaning up all data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to cleanup old data: ' + error.message,
      });
    }
  };

  const restoreBackup = async (backupId, backupType) => {
    try {
      // Double confirmation for restore operations
      const confirmRestore = window.confirm(
        `⚠️ WARNING: This will restore from backup and REPLACE current data!\n\n` +
          `This action will:\n` +
          `- Create a safety backup of current data\n` +
          `- Replace current ${backupType} with backup data\n` +
          `- This operation cannot be undone\n\n` +
          `Are you absolutely sure you want to continue?`
      );

      if (!confirmRestore) return;

      setRestoring(prev => ({ ...prev, [backupId]: true }));
      setMessage({ type: '', text: '' });

      // Get confirmation token and execute restore in one flow
      const tokenResponse =
        await adminApiService.getConfirmationToken(backupId);
      const result = await adminApiService.executeRestore(
        backupId,
        tokenResponse.confirmation_token
      );

      let successMessage = `Restore completed successfully! Safety backup created with ID: ${result.safety_backup_id}`;

      // Add warnings if they exist
      if (result.warnings) {
        successMessage += `\n\nNote: Some compatibility warnings occurred during restore (this is normal when restoring backups from different systems).`;
      }

      setMessage({
        type: 'success',
        text: successMessage,
      });

      // Reload backups list
      await loadBackups();
    } catch (error) {
      console.error('Error restoring backup:', error);

      // Provide user-friendly error messages
      let userMessage = 'Failed to restore backup';
      if (error.message.includes('Invalid confirmation token')) {
        userMessage = 'Restore session expired. Please try again.';
      } else if (error.message.includes('Backup file does not exist')) {
        userMessage = 'Backup file is missing or corrupted.';
      } else if (error.message.includes('Database restore failed')) {
        userMessage = 'Database restore failed. Check system logs for details.';
      } else if (error.message.includes('timeout')) {
        userMessage =
          'Restore operation timed out. Large backups may take longer.';
      } else {
        userMessage = 'Restore operation failed. Please check system logs.';
      }

      setMessage({
        type: 'error',
        text: userMessage,
      });
    } finally {
      setRestoring(prev => ({ ...prev, [backupId]: false }));
    }
  };

  return (
    <div className="backup-management">
      <AdminHeader
        user={user}
        onLogout={handleLogout}
        onToggleSidebar={() => {}} // No sidebar in standalone backup page
      />

      <div className="backup-content">
        <div className="backup-page-header">
          <h1>Backup Management</h1>
          <p>Create and manage system backups</p>
        </div>

        {message.text && (
          <div className={`backup-message ${message.type}`}>{message.text}</div>
        )}

        <div className="backup-actions">
          <div className="backup-action-card">
            <h3>Database Backup</h3>
            <p>Create a backup of the database</p>
            <button
              className="backup-btn database"
              onClick={() => createBackup('database')}
              disabled={creating.database}
            >
              {creating.database ? 'Creating...' : 'Create Database Backup'}
            </button>
          </div>

          <div className="backup-action-card">
            <h3>Files Backup</h3>
            <p>Create a backup of uploaded files</p>
            <button
              className="backup-btn files"
              onClick={() => createBackup('files')}
              disabled={creating.files}
            >
              {creating.files ? 'Creating...' : 'Create Files Backup'}
            </button>
          </div>

          <div className="backup-action-card">
            <h3>Full System Backup</h3>
            <p>Create a complete backup (database + files)</p>
            <button
              className="backup-btn full"
              onClick={() => createBackup('full')}
              disabled={creating.full}
            >
              {creating.full ? 'Creating...' : 'Create Full Backup'}
            </button>
          </div>

          <div className="backup-action-card">
            <h3>Upload Backup</h3>
            <p>Upload an external backup file (.sql or .zip)</p>
            <div className="upload-section">
              <input
                type="file"
                accept=".sql,.zip"
                onChange={uploadBackup}
                disabled={uploading}
                id="backup-upload"
                style={{ display: 'none' }}
              />
              <label
                htmlFor="backup-upload"
                className={`backup-btn upload ${uploading ? 'disabled' : ''}`}
              >
                {uploading ? 'Uploading...' : 'Choose Backup File'}
              </label>
            </div>
          </div>

          <div className="backup-action-card">
            <h3>Cleanup Old Backups</h3>
            <p>
              Remove old backups based on retention policy (includes orphaned
              files)
            </p>
            <button
              className="backup-btn cleanup"
              onClick={cleanupOldBackups}
              disabled={loading}
            >
              {loading ? 'Cleaning...' : 'Cleanup Old Backups'}
            </button>
          </div>

          <div className="backup-action-card">
            <h3>Complete Cleanup</h3>
            <p>Remove old backups, orphaned files, and trash files</p>
            <button
              className="backup-btn cleanup-all"
              onClick={cleanupAllOldData}
              disabled={loading}
            >
              {loading ? 'Cleaning...' : 'Complete Cleanup'}
            </button>
          </div>
        </div>

        <div className="backup-list">
          <div className="backup-list-header">
            <h2>Existing Backups</h2>
            <button
              className="refresh-btn"
              onClick={loadBackups}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="backup-loading">Loading backups...</div>
          ) : (
            <div className="backup-table">
              {backups.length === 0 ? (
                <div className="no-backups">No backups found</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>File Exists</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map(backup => (
                      <tr key={backup.id}>
                        <td>
                          <span className={`backup-type ${backup.backup_type}`}>
                            {backup.backup_type}
                          </span>
                        </td>
                        <td>{backup.filename}</td>
                        <td>
                          {backup.size_bytes
                            ? formatFileSize(backup.size_bytes)
                            : 'Unknown'}
                        </td>
                        <td>
                          <span className={`backup-status ${backup.status}`}>
                            {backup.status}
                          </span>
                        </td>
                        <td>{formatDate(backup.created_at)}</td>
                        <td>
                          <span
                            className={`file-exists ${backup.file_exists ? 'yes' : 'no'}`}
                          >
                            {backup.file_exists ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <div className="backup-actions-cell">
                            {backup.file_exists && (
                              <button
                                className="action-btn download"
                                onClick={() =>
                                  downloadBackup(backup.id, backup.filename)
                                }
                                title="Download backup"
                              >
                                Download
                              </button>
                            )}
                            <button
                              className="action-btn verify"
                              onClick={() => verifyBackup(backup.id)}
                              title="Verify backup integrity"
                            >
                              Verify
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() =>
                                deleteBackup(backup.id, backup.filename)
                              }
                              title="Delete backup record and file"
                            >
                              Delete
                            </button>
                            {backup.file_exists && (
                              <button
                                className="action-btn restore"
                                onClick={() =>
                                  restoreBackup(backup.id, backup.backup_type)
                                }
                                disabled={restoring[backup.id]}
                                title="Restore from this backup (DANGER: Replaces current data)"
                              >
                                {restoring[backup.id]
                                  ? 'Restoring...'
                                  : 'Restore'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
