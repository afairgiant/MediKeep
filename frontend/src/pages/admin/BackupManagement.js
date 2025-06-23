import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/api/adminApi';
import AdminHeader from '../../components/admin/AdminHeader';
import '../../components/admin/AdminHeader.css';
import './BackupManagement.css';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState({ database: false, files: false });
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
      } else {
        await adminApiService.createFilesBackup(description);
      }

      setMessage({
        type: 'success',
        text: `${type === 'database' ? 'Database' : 'Files'} backup created successfully!`,
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
      const statusText = result.verified
        ? 'Backup is valid!'
        : 'Backup verification failed!';
      setMessage({
        type: result.verified ? 'success' : 'error',
        text: statusText,
      });
    } catch (error) {
      console.error('Error verifying backup:', error);
      setMessage({
        type: 'error',
        text: 'Failed to verify backup: ' + error.message,
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
      setMessage({
        type: 'success',
        text: `Cleanup completed: ${result.deleted_count} old backups removed`,
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
      setMessage({
        type: 'success',
        text: `Complete cleanup finished: ${totalFiles} files removed (backups + trash)`,
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
            <h3>Cleanup Old Backups</h3>
            <p>Remove old backups based on retention policy</p>
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
            <p>Remove old backups and trash files</p>
            <button
              className="backup-btn cleanup-all"
              onClick={cleanupAllOldData}
              disabled={loading}
            >
              {loading ? 'Cleaning...' : 'Cleanup All Old Data'}
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
