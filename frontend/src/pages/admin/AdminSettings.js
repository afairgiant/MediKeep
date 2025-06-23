import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApiService } from '../../services/api/adminApi';
import AdminHeader from '../../components/admin/AdminHeader';
import '../../components/admin/AdminHeader.css';
import './AdminSettings.css';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    backup_retention_days: 7,
    trash_retention_days: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      console.error('Error loading settings:', error);
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
      console.error('Error saving settings:', error);
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
      <div className="admin-settings">
        <AdminHeader user={user} onLogout={handleLogout} />
        <div className="settings-content">
          <div className="settings-loading">
            <div className="loading-spinner"></div>
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-settings">
      <AdminHeader user={user} onLogout={handleLogout} />

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
              <h2>Data Retention Policies</h2>
              <p>
                Configure how long different types of data are kept before
                automatic cleanup
              </p>
            </div>

            <div className="settings-section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">Backup Retention</div>
                  <div className="setting-description">
                    Number of days to keep backup files before automatic
                    deletion
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
    </div>
  );
};

export default AdminSettings;
