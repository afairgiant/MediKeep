import React, { useState, useEffect } from 'react';
import { Header } from '../components/adapters';
import Container from '../components/layout/Container';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import DeleteAccountModal from '../components/auth/DeleteAccountModal';
import PaperlessSettings from '../components/settings/PaperlessSettings';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { getVersionInfo } from '../services/systemService';
import { updateUserPreferences } from '../services/api/userPreferencesApi';
import { cleanupOutOfSyncFiles } from '../services/api/paperlessApi';
import frontendLogger from '../services/frontendLogger';
import { PAPERLESS_SETTING_KEYS, isPaperlessSetting } from '../constants/paperlessSettings';
import { toast } from 'react-toastify';
import '../styles/pages/Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const {
    preferences: userPreferences,
    loading: loadingPreferences,
    updateLocalPreferences,
  } = useUserPreferences();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [localPreferences, setLocalPreferences] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [cleaningFiles, setCleaningFiles] = useState(false);

  const handleOpenPasswordModal = () => {
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  const handleOpenDeleteAccountModal = () => {
    setIsDeleteAccountModalOpen(true);
  };

  const handleCloseDeleteAccountModal = () => {
    setIsDeleteAccountModalOpen(false);
  };

  // Initialize local preferences when context loads
  useEffect(() => {
    if (userPreferences && Object.keys(userPreferences).length > 0) {
      setLocalPreferences({ 
        ...userPreferences,
        // Ensure new fields have default values if they're missing
        paperless_username: userPreferences.paperless_username || '',
        paperless_password: userPreferences.paperless_password || ''
      });
    }
  }, [userPreferences]);

  // Check for changes
  useEffect(() => {
    if (!userPreferences || Object.keys(localPreferences).length === 0) {
      setHasChanges(false);
      return;
    }

    const hasChanged = Object.keys(localPreferences).some(key => {
      return localPreferences[key] !== userPreferences[key];
    });
    setHasChanges(hasChanged);
  }, [localPreferences, userPreferences]);

  const handleUnitSystemChange = newUnitSystem => {
    setLocalPreferences(prev => ({
      ...prev,
      unit_system: newUnitSystem,
    }));

    frontendLogger.logInfo('Unit system preference changed (not saved yet)', {
      newUnitSystem,
      component: 'Settings',
    });
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);

      // Filter out unchanged fields to avoid validation issues
      const fieldsToUpdate = {};
      Object.keys(localPreferences).forEach(key => {
        if (localPreferences[key] !== userPreferences?.[key]) {
          fieldsToUpdate[key] = localPreferences[key];
        }
      });

      // Only send the update if there are actual changes
      if (Object.keys(fieldsToUpdate).length === 0) {
        frontendLogger.logInfo('No changes to save', { component: 'Settings' });
        return userPreferences;
      }

      // Check if we're updating paperless settings
      const hasPaperlessSettings = PAPERLESS_SETTING_KEYS.some(key => key in fieldsToUpdate);
      
      let updatedPreferences;
      if (hasPaperlessSettings) {
        // Use paperless-specific API for paperless settings (handles encryption)
        const { updatePaperlessSettings } = await import('../services/api/paperlessApi');
        updatedPreferences = await updatePaperlessSettings(fieldsToUpdate);
      } else {
        // Use general user preferences API for other settings
        updatedPreferences = await updateUserPreferences(fieldsToUpdate);
      }

      // Update the context but preserve local form values for credentials
      const updatedPreferencesWithLocalCredentials = {
        ...updatedPreferences,
        // Preserve local credential values that weren't returned by API for security
        paperless_username: localPreferences.paperless_username || '',
        paperless_password: localPreferences.paperless_password || ''
      };
      updateLocalPreferences(updatedPreferencesWithLocalCredentials);

      frontendLogger.logInfo('User preferences saved successfully', {
        updatedFields: Object.keys(fieldsToUpdate),
        component: 'Settings',
      });

      return updatedPreferences;
    } catch (error) {
      frontendLogger.logError('Failed to save user preferences', {
        error: error.message,
        component: 'Settings',
      });
      throw error;
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleResetPreferences = () => {
    setLocalPreferences({ 
      ...userPreferences,
      // Ensure new fields have default values if they're missing
      paperless_username: userPreferences.paperless_username || '',
      paperless_password: userPreferences.paperless_password || ''
    });
    frontendLogger.logInfo('User preferences reset to original values', {
      component: 'Settings',
    });
  };

  const handleCleanupFiles = async () => {
    try {
      setCleaningFiles(true);
      
      frontendLogger.logInfo('Starting cleanup of out-of-sync files', {
        component: 'Settings'
      });
      
      const results = await cleanupOutOfSyncFiles();
      
      frontendLogger.logInfo('File cleanup completed', {
        results,
        component: 'Settings'
      });
      
      const totalCleaned = results.files_cleaned || 0;
      const totalDeleted = results.files_deleted || 0;
      
      if (totalCleaned > 0 || totalDeleted > 0) {
        toast.success(
          `Cleanup completed: ${totalCleaned} files cleaned, ${totalDeleted} files deleted`, 
          { autoClose: 5000 }
        );
      } else {
        toast.info('No out-of-sync files found to clean up', { autoClose: 3000 });
      }
      
    } catch (error) {
      frontendLogger.logError('Failed to cleanup out-of-sync files', {
        error: error.message,
        component: 'Settings'
      });
      
      toast.error('Failed to cleanup files. Please try again later.', { autoClose: 5000 });
    } finally {
      setCleaningFiles(false);
    }
  };

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        setLoadingVersion(true);
        const version = await getVersionInfo();
        setVersionInfo(version);
      } catch (error) {
        frontendLogger.logError('Failed to load version information', {
          error: error.message,
          component: 'Settings',
        });
        // Don't show error to user, just fail silently
      } finally {
        setLoadingVersion(false);
      }
    };

    fetchVersionInfo();
  }, []);

  if (!user) {
    return (
      <Container>
        <Header title="Settings" subtitle="Loading..." showBackButton={true} />
      </Container>
    );
  }

  return (
    <Container>
      <Header
        title="Settings"
        subtitle="Manage your application preferences and settings"
        showBackButton={true}
      />

      <div className="settings-content">
        {/* Security Settings Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">Security</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">Password</div>
                <div className="settings-option-description">
                  Change your account password to keep your account secure
                </div>
              </div>
              <div className="settings-option-control">
                <Button variant="secondary" onClick={handleOpenPasswordModal}>
                  Change Password
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Management Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">Account Management</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">Delete Account</div>
                <div className="settings-option-description">
                  Permanently delete your account and all associated medical
                  data. This action cannot be undone.
                </div>
              </div>
              <div className="settings-option-control">
                <Button variant="danger" onClick={handleOpenDeleteAccountModal}>
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* System Information Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">System Information</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">Application Version</div>
                <div className="settings-option-description">
                  {loadingVersion ? (
                    'Loading version information...'
                  ) : versionInfo &&
                    versionInfo.app_name &&
                    versionInfo.version ? (
                    <span>
                      <strong>{versionInfo.app_name}</strong> v
                      {versionInfo.version}
                    </span>
                  ) : versionInfo ? (
                    <span>
                      <strong>{versionInfo.app_name || 'Unknown App'}</strong> v
                      {versionInfo.version || 'Unknown Version'}
                    </span>
                  ) : (
                    'Version information unavailable'
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Application Preferences Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">Application Preferences</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">Unit System</div>
                <div className="settings-option-description">
                  Choose whether to display measurements in Imperial (pounds,
                  feet, °F) or Metric (kilograms, centimeters, °C) units
                </div>
              </div>
              <div className="settings-option-control">
                {loadingPreferences ? (
                  <div className="settings-loading">Loading...</div>
                ) : (
                  <div className="settings-radio-group">
                    <label className="settings-radio-option">
                      <input
                        type="radio"
                        name="unit-system"
                        value="imperial"
                        checked={localPreferences?.unit_system === 'imperial'}
                        onChange={() => handleUnitSystemChange('imperial')}
                        disabled={savingPreferences}
                      />
                      <span className="settings-radio-label">
                        Imperial (lbs, feet, °F)
                      </span>
                    </label>

                    <label className="settings-radio-option">
                      <input
                        type="radio"
                        name="unit-system"
                        value="metric"
                        checked={localPreferences?.unit_system === 'metric'}
                        onChange={() => handleUnitSystemChange('metric')}
                        disabled={savingPreferences}
                      />
                      <span className="settings-radio-label">
                        Metric (kg, cm, °C)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Document Storage Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">Document Storage</h3>
            <div className="settings-section-description">
              Configure how your medical documents are stored and managed
            </div>

            <PaperlessSettings
              preferences={localPreferences}
              onPreferencesUpdate={newPrefs => setLocalPreferences(newPrefs)}
              loading={loadingPreferences}
            />

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">File Cleanup</div>
                <div className="settings-option-description">
                  Clean up out-of-sync files and resolve document storage inconsistencies. 
                  This will reset failed uploads, clear orphaned tasks, and fix database sync issues.
                </div>
              </div>
              <div className="settings-option-control">
                <Button
                  variant="secondary"
                  onClick={handleCleanupFiles}
                  disabled={cleaningFiles || loadingPreferences}
                  loading={cleaningFiles}
                >
                  {cleaningFiles ? 'Cleaning...' : 'Cleanup Files'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Unified Save/Reset Actions */}
        {hasChanges && (
          <Card>
            <div className="settings-actions">
              <div className="settings-actions-info">
                <div className="settings-changes-indicator">
                  You have unsaved changes
                </div>
              </div>

              <div className="settings-actions-buttons">
                <Button
                  variant="secondary"
                  onClick={handleResetPreferences}
                  disabled={savingPreferences}
                >
                  Reset Changes
                </Button>

                <Button
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  loading={savingPreferences}
                >
                  {savingPreferences ? 'Saving...' : 'Save All Changes'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteAccountModalOpen}
        onClose={handleCloseDeleteAccountModal}
      />
    </Container>
  );
};

export default Settings;
