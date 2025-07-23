import React, { useState, useEffect } from 'react';
import { adminApiService } from '../../services/api/adminApi';
import AdminLayout from '../../components/admin/AdminLayout';
import frontendLogger from '../../services/frontendLogger';
import './AdminSettings.css';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    backup_retention_days: 7,
    trash_retention_days: 30,
    backup_min_count: 5,
    backup_max_count: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.getRetentionSettings();
      setSettings(data);
    } catch (error) {
      frontendLogger.logError('Error loading settings', { error: error.message, component: 'AdminSettings' });
      setMessage({
        type: 'error',
        text: 'Failed to load settings: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      return; // Don't update if invalid
    }
    setSettings(prev => ({
      ...prev,
      [field]: numValue,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const updateData = {
        backup_retention_days: settings.backup_retention_days,
        trash_retention_days: settings.trash_retention_days,
        backup_min_count: settings.backup_min_count,
        backup_max_count: settings.backup_max_count,
      };

      const response =
        await adminApiService.updateRetentionSettings(updateData);

      setMessage({
        type: 'success',
        text: response.message || 'Settings updated successfully',
      });

      // Update local state with confirmed values
      if (response.current_settings) {
        setSettings(response.current_settings);
      }

      // Clear message after 5 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
    } catch (error) {
      frontendLogger.logError('Error saving settings', { error: error.message, component: 'AdminSettings' });
      setMessage({
        type: 'error',
        text: 'Failed to save settings: ' + error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings(); // Reload from server
    setMessage({ type: '', text: '' });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="settings-content">
          <div className="settings-loading">
            <div className="loading-spinner"></div>
            <p>Loading settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="settings-content">
        <div className="settings-page-header">
          <h1>Admin Settings</h1>
          <p>Configure system-wide settings and retention policies</p>
        </div>

        {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="settings-sections">
          {/* Data Retention Settings */}
          <div className="settings-section-card">
            <div className="settings-section-header">
              <h2>Enhanced Backup Retention Policies</h2>
              <p>
                Configure backup retention with count-based protection and time-based cleanup
              </p>
            </div>

            {/* Retention Logic Explanation */}
            <div className="retention-info-card">
              <div className="retention-info-header">
                <h3>🔒 Retention Logic</h3>
              </div>
              <ul className="retention-info-list">
                <li><strong>Count Protection:</strong> Always keep the {settings.backup_min_count || 5} most recent backups</li>
                <li><strong>Time-based Cleanup:</strong> Delete backups older than {settings.backup_retention_days || 7} days (beyond minimum count)</li>
                <li><strong>Priority:</strong> Minimum count always takes precedence over time limits</li>
              </ul>
            </div>

            <div className="settings-section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">Backup Retention (Days)</div>
                  <div className="setting-description">
                    Delete backups older than this many days (beyond minimum count)
                  </div>
                </div>
                <div className="setting-control">
                  <div className="input-group">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.backup_retention_days}
                      onChange={e =>
                        handleInputChange(
                          'backup_retention_days',
                          e.target.value
                        )
                      }
                      className="settings-input"
                    />
                    <span className="input-suffix">days</span>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">🛡️ Minimum Backup Count</div>
                  <div className="setting-description">
                    Always keep at least this many backups (regardless of age)
                  </div>
                </div>
                <div className="setting-control">
                  <div className="input-group">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.backup_min_count}
                      onChange={e =>
                        handleInputChange(
                          'backup_min_count',
                          e.target.value
                        )
                      }
                      className="settings-input"
                    />
                    <span className="input-suffix">backups</span>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">⚠️ Maximum Backup Count</div>
                  <div className="setting-description">
                    Alert when backup count exceeds this limit (optional)
                  </div>
                </div>
                <div className="setting-control">
                  <div className="input-group">
                    <input
                      type="number"
                      min="5"
                      max="500"
                      value={settings.backup_max_count}
                      onChange={e =>
                        handleInputChange(
                          'backup_max_count',
                          e.target.value
                        )
                      }
                      className="settings-input"
                    />
                    <span className="input-suffix">backups</span>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">Trash Retention</div>
                  <div className="setting-description">
                    Number of days to keep deleted files in trash before
                    permanent deletion
                  </div>
                </div>
                <div className="setting-control">
                  <div className="input-group">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.trash_retention_days}
                      onChange={e =>
                        handleInputChange(
                          'trash_retention_days',
                          e.target.value
                        )
                      }
                      className="settings-input"
                    />
                    <span className="input-suffix">days</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section-actions">
              <button
                onClick={handleReset}
                className="settings-btn secondary"
                disabled={saving}
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="settings-btn primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Future Settings Sections */}
          <div className="settings-section-card">
            <div className="settings-section-header">
              <h2>Future Settings</h2>
              <p>
                Additional configuration options will be added here in future
                updates
              </p>
            </div>
            <div className="settings-section-content">
              <div className="settings-placeholder">
                <p>More settings coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
