import React, { useState, useEffect } from 'react';
import { adminApiService } from '../../services/api/adminApi';
import { authService } from '../../services/auth/simpleAuthService';
import AdminLayout from '../../components/admin/AdminLayout';
import frontendLogger from '../../services/frontendLogger';
import './AdminSettings.css';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    backup_retention_days: 7,
    trash_retention_days: 30,
    backup_min_count: 5,
    backup_max_count: 50,
    allow_user_registration: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ssoConfig, setSSOConfig] = useState({ enabled: false });
  const [ssoTestLoading, setSSOTestLoading] = useState(false);
  const [ssoTestResult, setSSOTestResult] = useState(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    loadSSOConfig();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.getRetentionSettings();
      setSettings(data);
    } catch (error) {
      frontendLogger.logError('Error loading settings', {
        error: error.message,
        component: 'AdminSettings',
      });
      setMessage({
        type: 'error',
        text: 'Failed to load settings: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    // Allow empty string for temporary editing
    if (value === '') {
      setSettings(prev => ({
        ...prev,
        [field]: '',
      }));
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      return; // Don't update if invalid
    }
    setSettings(prev => ({
      ...prev,
      [field]: numValue,
    }));
  };

  const handleBlur = (field, min = 1) => {
    // On blur, ensure we have a valid number
    if (settings[field] === '' || settings[field] < min) {
      setSettings(prev => ({
        ...prev,
        [field]: min,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      // Ensure all numeric fields have valid values before saving
      const validSettings = {
        backup_retention_days: settings.backup_retention_days || 7,
        trash_retention_days: settings.trash_retention_days || 30,
        backup_min_count: settings.backup_min_count || 5,
        backup_max_count: settings.backup_max_count || 50,
      };

      // Update local state with valid values
      setSettings(prev => ({
        ...prev,
        ...validSettings,
      }));

      const updateData = {
        ...validSettings,
        allow_user_registration: settings.allow_user_registration,
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
      frontendLogger.logError('Error saving settings', {
        error: error.message,
        component: 'AdminSettings',
      });
      setMessage({
        type: 'error',
        text: 'Failed to save settings: ' + error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const loadSSOConfig = async () => {
    try {
      const config = await authService.getSSOConfig();
      setSSOConfig(config);
    } catch (error) {
      frontendLogger.logError('Error loading SSO config', {
        error: error.message,
        component: 'AdminSettings',
      });
    }
  };

  const testSSOConnection = async () => {
    try {
      setSSOTestLoading(true);
      setSSOTestResult(null);

      const result = await authService.testSSOConnection();
      setSSOTestResult(result);
    } catch (error) {
      setSSOTestResult({
        success: false,
        message: error.message || 'Connection test failed',
      });
    } finally {
      setSSOTestLoading(false);
    }
  };

  const handleReset = () => {
    loadSettings(); // Reload from server
    loadSSOConfig();
    setSSOTestResult(null);
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
              <h2>Backup Retention Policies</h2>
              <p>
                Configure backup retention with count-based protection and
                time-based cleanup
              </p>
            </div>

            {/* Retention Logic Explanation */}
            <div className="retention-info-card">
              <div className="retention-info-header">
                <h3>🔒 Retention Logic</h3>
              </div>
              <ul className="retention-info-list">
                <li>
                  <strong>Count Protection:</strong> Always keep the{' '}
                  {settings.backup_min_count} most recent backups
                </li>
                <li>
                  <strong>Time-based Cleanup:</strong> Delete backups older than{' '}
                  {settings.backup_retention_days || 7} days (beyond minimum
                  count)
                </li>
                <li>
                  <strong>Priority:</strong> Minimum count always takes
                  precedence over time limits
                </li>
              </ul>
            </div>

            <div className="settings-section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">Backup Retention (Days)</div>
                  <div className="setting-description">
                    Delete backups older than this many days (beyond minimum
                    count)
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
                      onBlur={() => handleBlur('backup_retention_days', 1)}
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
                        handleInputChange('backup_min_count', e.target.value)
                      }
                      onBlur={() => handleBlur('backup_min_count', 1)}
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
                        handleInputChange('backup_max_count', e.target.value)
                      }
                      onBlur={() => handleBlur('backup_max_count', 1)}
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
                      onBlur={() => handleBlur('trash_retention_days', 1)}
                      className="settings-input"
                    />
                    <span className="input-suffix">days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User Management Settings */}
          <div className="settings-section-card">
            <div className="settings-section-header">
              <h2>User Management</h2>
              <p>Control user registration and access settings</p>
            </div>

            <div className="settings-section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">
                    Allow New User Registration
                  </div>
                  <div className="setting-description">
                    Enable or disable the ability for new users to create
                    accounts from the login page
                  </div>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.allow_user_registration}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          allow_user_registration: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">
                    {settings.allow_user_registration ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SSO Settings */}
          <div className="settings-section-card">
            <div className="settings-section-header">
              <h2>Single Sign-On (SSO)</h2>
              <p>Configure SSO authentication settings</p>
            </div>

            <div className="settings-section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-title">SSO Status</div>
                  <div className="setting-description">
                    Current SSO configuration status
                  </div>
                </div>
                <div className="setting-control">
                  <div
                    className={`status-indicator ${ssoConfig.enabled ? 'enabled' : 'disabled'}`}
                  >
                    {ssoConfig.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                  {ssoConfig.enabled && ssoConfig.provider_type && (
                    <div className="sso-provider-info">
                      Provider:{' '}
                      {ssoConfig.provider_type.charAt(0).toUpperCase() +
                        ssoConfig.provider_type.slice(1)}
                    </div>
                  )}
                </div>
              </div>

              {ssoConfig.enabled && (
                <>
                  <div className="setting-item">
                    <div className="setting-info">
                      <div className="setting-title">SSO Registration</div>
                      <div className="setting-description">
                        Whether new users can be created via SSO
                      </div>
                    </div>
                    <div className="setting-control">
                      <div
                        className={`status-indicator ${ssoConfig.registration_enabled ? 'enabled' : 'disabled'}`}
                      >
                        {ssoConfig.registration_enabled ? 'Allowed' : 'Blocked'}
                      </div>
                    </div>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <div className="setting-title">Test Connection</div>
                      <div className="setting-description">
                        Test the SSO provider connection and configuration
                      </div>
                    </div>
                    <div className="setting-control">
                      <button
                        onClick={testSSOConnection}
                        disabled={ssoTestLoading}
                        className="settings-btn secondary"
                      >
                        {ssoTestLoading ? 'Testing...' : 'Test SSO Connection'}
                      </button>
                    </div>
                  </div>

                  {ssoTestResult && (
                    <div className="setting-item">
                      <div className="setting-info">
                        <div className="setting-title">Test Result</div>
                      </div>
                      <div className="setting-control">
                        <div
                          className={`sso-test-result ${ssoTestResult.success ? 'success' : 'error'}`}
                        >
                          {ssoTestResult.success ? '✓ ' : '✗ '}
                          {ssoTestResult.message}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!ssoConfig.enabled && (
                <div className="sso-disabled-info">
                  <p>
                    SSO is currently disabled. To enable SSO, configure the
                    following environment variables and restart the application:
                  </p>
                  <ul>
                    <li>
                      <code>SSO_ENABLED=true</code>
                    </li>
                    <li>
                      <code>SSO_PROVIDER_TYPE</code> (google, github, or oidc)
                    </li>
                    <li>
                      <code>SSO_CLIENT_ID</code>
                    </li>
                    <li>
                      <code>SSO_CLIENT_SECRET</code>
                    </li>
                    <li>
                      <code>SSO_ISSUER_URL</code> (for OIDC provider)
                    </li>
                    <li>
                      <code>SSO_REDIRECT_URI</code>
                    </li>
                  </ul>
                </div>
              )}
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

        {/* Global Save Actions - Apply to all settings */}
        <div className="settings-global-actions">
          <button
            onClick={handleReset}
            className="settings-btn secondary"
            disabled={saving}
          >
            Reset All
          </button>
          <button
            onClick={handleSave}
            className="settings-btn primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
