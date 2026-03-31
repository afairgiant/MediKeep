import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components';
import { Container, Collapse, UnstyledButton, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import DeleteAccountModal from '../components/auth/DeleteAccountModal';
import PaperlessSettings from '../components/settings/PaperlessSettings';
import PapraSettings from '../components/settings/PapraSettings';
import StoragePreferencesCard from '../components/settings/StoragePreferencesCard';
import NotificationSettings from '../components/settings/NotificationSettings';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { getVersionInfo } from '../services/systemService';
import { updateUserPreferences } from '../services/api/userPreferencesApi';
import { cleanupOutOfSyncFiles } from '../services/api/paperlessApi.jsx';
import frontendLogger from '../services/frontendLogger';
import { PAPERLESS_SETTING_KEYS, isPaperlessSetting } from '../constants/paperlessSettings';
import { isPapraSetting } from '../constants/papraSettings';
import { DEFAULT_DATE_FORMAT } from '../utils/constants';
import { notifySuccess, notifyError, notifyInfo } from '../utils/notifyTranslated';
import { timezoneService } from '../services/timezoneService';
import ReleaseNotesHistory from '../components/settings/ReleaseNotesHistory';
import '../styles/pages/Settings.css';

const SETTINGS_TABS = ['general', 'documents', 'notifications', 'about'];
const DEFAULT_SESSION_TIMEOUT = 30;

/**
 * Safely parses a session timeout value to an integer with a default fallback.
 */
function safeParseTimeout(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? DEFAULT_SESSION_TIMEOUT : parsed;
}

/**
 * Builds a preferences object with guaranteed default values for fields
 * that may be missing from the server response.
 */
function buildDefaultPreferences(prefs) {
  return {
    ...prefs,
    paperless_username: prefs.paperless_username || '',
    paperless_password: prefs.paperless_password || '',
    session_timeout_minutes: safeParseTimeout(prefs.session_timeout_minutes),
    date_format: prefs.date_format || DEFAULT_DATE_FORMAT,
  };
}

/**
 * Returns the keys from localPreferences that differ from serverPreferences,
 * optionally filtered by a predicate on the key name.
 */
function getChangedKeys(localPreferences, serverPreferences, keyFilter) {
  if (!serverPreferences || Object.keys(localPreferences).length === 0) {
    return [];
  }

  return Object.keys(localPreferences).filter(key => {
    if (keyFilter && !keyFilter(key)) return false;
    return localPreferences[key] !== serverPreferences[key];
  });
}

/**
 * Save/Reset action bar displayed when a tab has unsaved changes.
 */
function SaveResetBar({ visible, saving, onSave, onReset, t }) {
  if (!visible) return null;

  return (
    <Card>
      <div className="settings-actions">
        <div className="settings-actions-info">
          <div className="settings-changes-indicator">
            {t('settings.actions.unsavedChanges', 'You have unsaved changes')}
          </div>
        </div>

        <div className="settings-actions-buttons">
          <Button
            variant="secondary"
            onClick={onReset}
            disabled={saving}
          >
            {t('settings.actions.reset', 'Reset Changes')}
          </Button>

          <Button
            onClick={onSave}
            disabled={saving}
            loading={saving}
          >
            {saving ? t('settings.actions.saving', 'Saving...') : t('settings.actions.save', 'Save All Changes')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

const Settings = () => {
  const { t } = useTranslation(['common', 'notifications']);
  const { user, updateSessionTimeout } = useAuth();
  const {
    preferences: userPreferences,
    loading: loadingPreferences,
    updateLocalPreferences,
  } = useUserPreferences();
  const [activeTab, setActiveTab] = useState('general');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [localPreferences, setLocalPreferences] = useState({});
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [cleaningFiles, setCleaningFiles] = useState(false);
  const [paperlessOpen, { toggle: togglePaperless }] = useDisclosure(false);
  const [papraOpen, { toggle: togglePapra }] = useDisclosure(false);

  // Initialize local preferences when context loads
  useEffect(() => {
    if (userPreferences && Object.keys(userPreferences).length > 0) {
      setLocalPreferences(buildDefaultPreferences(userPreferences));
    }
  }, [userPreferences]);

  const isDocumentSetting = (key) => isPaperlessSetting(key) || isPapraSetting(key);

  const hasGeneralChanges = getChangedKeys(
    localPreferences, userPreferences, key => !isDocumentSetting(key)
  ).length > 0;

  const hasDocumentChanges = getChangedKeys(
    localPreferences, userPreferences, isDocumentSetting
  ).length > 0;

  // Connection-ready checks for storage backend selection.
  // Requires enabled + a verified connection (successful test persisted server-side).
  const paperlessConnectionReady = !!(
    localPreferences?.paperless_enabled &&
    localPreferences?.paperless_connection_verified
  );

  const papraConnectionReady = !!(
    localPreferences?.papra_enabled &&
    localPreferences?.papra_connection_verified
  );

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

  const handleDateFormatChange = newDateFormat => {
    setLocalPreferences(prev => ({
      ...prev,
      date_format: newDateFormat,
    }));

    frontendLogger.logInfo('Date format preference changed (not saved yet)', {
      newDateFormat,
      component: 'Settings',
    });
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);

      // Filter out unchanged fields to avoid validation issues
      const fieldsToUpdate = {};
      Object.keys(localPreferences).forEach(key => {
        let localValue = localPreferences[key];
        let serverValue = userPreferences?.[key];

        // Special handling for session_timeout_minutes to ensure proper type comparison
        if (key === 'session_timeout_minutes') {
          localValue = safeParseTimeout(localValue);
          serverValue = safeParseTimeout(serverValue);
        }

        if (localValue !== serverValue) {
          fieldsToUpdate[key] = key === 'session_timeout_minutes' ? localValue : localPreferences[key];
        }
      });

      // Debug logging for timeout changes
      if (fieldsToUpdate.session_timeout_minutes) {
        frontendLogger.logInfo('Timeout preference change detected', {
          localValue: localPreferences.session_timeout_minutes,
          serverValue: userPreferences?.session_timeout_minutes,
          newValue: fieldsToUpdate.session_timeout_minutes,
          component: 'Settings'
        });
      }

      // Only send the update if there are actual changes
      if (Object.keys(fieldsToUpdate).length === 0) {
        frontendLogger.logInfo('No changes to save', { component: 'Settings' });
        return userPreferences;
      }

      // Split fields into paperless, papra, and general settings
      const paperlessFields = {};
      const papraFields = {};
      const generalFields = {};

      Object.keys(fieldsToUpdate).forEach(key => {
        if (PAPERLESS_SETTING_KEYS.includes(key)) {
          paperlessFields[key] = fieldsToUpdate[key];
        } else if (isPapraSetting(key)) {
          papraFields[key] = fieldsToUpdate[key];
        } else {
          generalFields[key] = fieldsToUpdate[key];
        }
      });

      let updatedPreferences = {};

      // Update general preferences first
      if (Object.keys(generalFields).length > 0) {
        const generalResponse = await updateUserPreferences(generalFields);
        updatedPreferences = { ...updatedPreferences, ...generalResponse };

        // Update session timeout in AuthContext if it changed
        if (generalFields.session_timeout_minutes && generalResponse.session_timeout_minutes) {
          const { secureStorage } = await import('../utils/secureStorage');
          await secureStorage.setItem('sessionTimeoutMinutes', generalResponse.session_timeout_minutes.toString());

          frontendLogger.logInfo('Session timeout preference updated', {
            component: 'Settings',
            newTimeout: generalResponse.session_timeout_minutes
          });
        }
      }

      // Update paperless settings separately
      if (Object.keys(paperlessFields).length > 0) {
        const { updatePaperlessSettings } = await import('../services/api/paperlessApi.jsx');
        const paperlessResponse = await updatePaperlessSettings(paperlessFields);
        updatedPreferences = { ...updatedPreferences, ...paperlessResponse };
      }

      // Update papra settings separately
      if (Object.keys(papraFields).length > 0) {
        const { saveSettings } = await import('../services/api/papraApi.jsx');
        const papraResponse = await saveSettings(papraFields);
        updatedPreferences = { ...updatedPreferences, ...papraResponse };
      }

      // Update the context but preserve local form values for credentials and API token
      const updatedPreferencesWithLocalCredentials = {
        ...updatedPreferences,
        paperless_username: localPreferences.paperless_username || '',
        paperless_password: localPreferences.paperless_password || '',
        paperless_api_token: localPreferences.paperless_api_token || '',
        papra_api_token: localPreferences.papra_api_token || '',
      };

      updateLocalPreferences(updatedPreferencesWithLocalCredentials);

      // Update session timeout in AuthContext if it was changed
      if (fieldsToUpdate.session_timeout_minutes !== undefined) {
        updateSessionTimeout(fieldsToUpdate.session_timeout_minutes);
      }

      // Redact sensitive Paperless fields before logging
      const sensitiveKeys = ['paperless_password', 'paperless_username', 'paperless_api_token'];
      const redactedFieldsToUpdate = Object.fromEntries(
        Object.entries(fieldsToUpdate).map(([k, v]) =>
          sensitiveKeys.includes(k) ? [k, '[REDACTED]'] : [k, v]
        )
      );
      const redactedUpdatedPreferences = Object.fromEntries(
        Object.entries(updatedPreferences).map(([k, v]) =>
          sensitiveKeys.includes(k) ? [k, '[REDACTED]'] : [k, v]
        )
      );

      frontendLogger.logInfo('User preferences saved successfully', {
        updatedFields: Object.keys(fieldsToUpdate),
        fieldsToUpdate: redactedFieldsToUpdate,
        updatedPreferences: redactedUpdatedPreferences,
        component: 'Settings',
      });

      notifySuccess('notifications:toasts.settings.saved', { fallback: 'Settings saved successfully' });

      return updatedPreferences;
    } catch (error) {
      frontendLogger.logError('Failed to save user preferences', {
        error: error.message,
        component: 'Settings',
      });
      notifyError('notifications:toasts.settings.saveFailed', { fallback: 'Failed to save settings' });
      throw error;
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleResetPreferences = () => {
    setLocalPreferences(buildDefaultPreferences(userPreferences));
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
        notifySuccess('notifications:toasts.settings.cleanupComplete', { interpolation: { cleaned: totalCleaned, deleted: totalDeleted }, autoClose: 5000 });
      } else {
        notifyInfo('notifications:toasts.settings.noOutOfSync', { autoClose: 3000 });
      }

    } catch (error) {
      frontendLogger.logError('Failed to cleanup out-of-sync files', {
        error: error.message,
        component: 'Settings'
      });

      notifyError('notifications:toasts.settings.cleanupFailed', { autoClose: 5000 });
    } finally {
      setCleaningFiles(false);
    }
  };

  const handleSessionTimeoutBlur = (e) => {
    const parsed = parseInt(e.target.value, 10);
    const clamped = Number.isNaN(parsed) ? 5 : Math.max(5, Math.min(1440, parsed));

    setLocalPreferences(prev => ({
      ...prev,
      session_timeout_minutes: clamped,
    }));

    frontendLogger.logInfo('Session timeout preference changed (not saved yet)', {
      newTimeout: clamped,
      component: 'Settings',
    });
  };

  function renderVersionInfo() {
    if (loadingVersion) {
      return t('settings.system.version.loading', 'Loading version information...');
    }

    if (!versionInfo) {
      return t('settings.system.version.unavailable', 'Version information unavailable');
    }

    const appName = versionInfo.app_name || t('settings.system.version.unknownApp', 'Unknown App');
    const version = versionInfo.version || t('settings.system.version.unknownVersion', 'Unknown Version');

    return (
      <span>
        <strong>{appName}</strong> v{version}
      </span>
    );
  }

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
      } finally {
        setLoadingVersion(false);
      }
    };

    fetchVersionInfo();
  }, []);

  if (!user) {
    return (
      <Container size="xl" py="md">
        <PageHeader title={t('settings.title', 'Settings')} />
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('settings.title', 'Settings')} />

      <div className="settings-tabs" role="tablist">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab}
            role="tab"
            id={`settings-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`settings-tabpanel-${tab}`}
            className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`settings.tabs.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </div>

      {/* General Tab Content */}
      {activeTab === 'general' && (
      <div className="settings-content" role="tabpanel" id="settings-tabpanel-general" aria-labelledby="settings-tab-general">
        {/* Security Settings Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.security', 'Security')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.security.password.title', 'Password')}</div>
                <div className="settings-option-description">
                  {t('settings.security.password.description', 'Change your account password to keep your account secure')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button variant="secondary" onClick={() => setIsPasswordModalOpen(true)}>
                  {t('settings.security.password.button', 'Change Password')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Management Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.accountManagement', 'Account Management')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.account.deleteAccount.title', 'Delete Account')}</div>
                <div className="settings-option-description">
                  {t('settings.account.deleteAccount.description', 'Permanently delete your account and all associated medical data. This action cannot be undone.')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button variant="danger" onClick={() => setIsDeleteAccountModalOpen(true)}>
                  {t('settings.account.deleteAccount.button', 'Delete Account')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Application Preferences Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.preferences', 'Application Preferences')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.preferences.unitSystem.title', 'Unit System')}</div>
                <div className="settings-option-description">
                  {t('settings.preferences.unitSystem.description', 'Choose whether to display measurements in Imperial (pounds, feet, °F) or Metric (kilograms, centimeters, °C) units')}
                </div>
              </div>
              <div className="settings-option-control">
                {loadingPreferences ? (
                  <div className="settings-loading">{t('labels.loading', 'Loading...')}</div>
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
                        {t('settings.preferences.unitSystem.imperial', 'Imperial (lbs, feet, °F)')}
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
                        {t('settings.preferences.unitSystem.metric', 'Metric (kg, cm, °C)')}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Date Format Option */}
            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.preferences.dateFormat.title', 'Date Format')}</div>
                <div className="settings-option-description">
                  {t('settings.preferences.dateFormat.description', 'Choose how dates are displayed throughout the application')}
                </div>
              </div>
              <div className="settings-option-control">
                {loadingPreferences ? (
                  <div className="settings-loading">{t('labels.loading', 'Loading...')}</div>
                ) : (
                  <div className="settings-radio-group">
                    <label className="settings-radio-option">
                      <input
                        type="radio"
                        name="date-format"
                        value="mdy"
                        checked={localPreferences?.date_format === 'mdy' || !localPreferences?.date_format}
                        onChange={() => handleDateFormatChange('mdy')}
                        disabled={savingPreferences}
                      />
                      <span className="settings-radio-label">
                        {t('settings.preferences.dateFormat.mdy', 'MM/DD/YYYY (US)')}
                        <span className="settings-radio-example"> - e.g., 01/25/2026</span>
                      </span>
                    </label>

                    <label className="settings-radio-option">
                      <input
                        type="radio"
                        name="date-format"
                        value="dmy"
                        checked={localPreferences?.date_format === 'dmy'}
                        onChange={() => handleDateFormatChange('dmy')}
                        disabled={savingPreferences}
                      />
                      <span className="settings-radio-label">
                        {t('settings.preferences.dateFormat.dmy', 'DD/MM/YYYY (European)')}
                        <span className="settings-radio-example"> - e.g., 25/01/2026</span>
                      </span>
                    </label>

                    <label className="settings-radio-option">
                      <input
                        type="radio"
                        name="date-format"
                        value="ymd"
                        checked={localPreferences?.date_format === 'ymd'}
                        onChange={() => handleDateFormatChange('ymd')}
                        disabled={savingPreferences}
                      />
                      <span className="settings-radio-label">
                        {t('settings.preferences.dateFormat.ymd', 'YYYY-MM-DD (ISO)')}
                        <span className="settings-radio-example"> - e.g., 2026-01-25</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Session Timeout Option */}
            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.preferences.sessionTimeout.title', 'Session Timeout')}</div>
                <div className="settings-option-description">
                  {t('settings.preferences.sessionTimeout.description', 'Set the duration of inactivity before your session expires (in minutes)')}
                </div>
              </div>
              <div className="settings-option-control">
                {loadingPreferences ? (
                  <span className="settings-value-placeholder">{t('labels.loading', 'Loading...')}</span>
                ) : (
                  <div className="settings-timeout-control">
                    <input
                      type="text"
                      value={localPreferences?.session_timeout_minutes || 30}
                      onChange={(e) => {
                        setLocalPreferences(prev => ({
                          ...prev,
                          session_timeout_minutes: e.target.value,
                        }));
                      }}
                      onBlur={handleSessionTimeoutBlur}
                      placeholder="30"
                      disabled={savingPreferences}
                      className="settings-timeout-input"
                      style={{
                        width: '100px',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border-light)',
                        fontSize: '14px',
                        textAlign: 'right'
                      }}
                    />
                    <span style={{ marginLeft: '10px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                      {t('settings.preferences.sessionTimeout.range', 'minutes (5-1440)')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <SaveResetBar
          visible={hasGeneralChanges}
          saving={savingPreferences}
          onSave={handleSavePreferences}
          onReset={handleResetPreferences}
          t={t}
        />
      </div>
      )}

      {/* Documents Tab Content */}
      {activeTab === 'documents' && (
      <div className="settings-content" role="tabpanel" id="settings-tabpanel-documents" aria-labelledby="settings-tab-documents">
        {/* Storage Preferences - default backend selection + stats */}
        <StoragePreferencesCard
          preferences={localPreferences}
          onUpdate={(updates) => setLocalPreferences(prev => ({ ...prev, ...updates }))}
          connectionEnabled={paperlessConnectionReady}
          papraConnectionEnabled={papraConnectionReady}
        />

        {/* Paperless-ngx Connection Settings - Collapsible */}
        <Card>
          <UnstyledButton onClick={togglePaperless} w="100%" p="md">
            <Group justify="space-between">
              <Group gap="sm">
                {paperlessOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                <Text fw={600} size="md">Paperless-ngx</Text>
                {localPreferences?.paperless_enabled && (
                  <Text size="xs" c={localPreferences?.paperless_connection_verified ? 'green' : 'yellow'} fw={500}>
                    {localPreferences?.paperless_connection_verified ? 'Connected' : 'Enabled'}
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {t('settings.documents.paperlessDescription', 'Configure Paperless-ngx document management integration')}
              </Text>
            </Group>
          </UnstyledButton>
          <Collapse in={paperlessOpen}>
            <div style={{ padding: '0 var(--mantine-spacing-md) var(--mantine-spacing-md)' }}>
              <PaperlessSettings
                preferences={localPreferences}
                onPreferencesUpdate={newPrefs => setLocalPreferences(newPrefs)}
                loading={loadingPreferences}
              />
            </div>
          </Collapse>
        </Card>

        {/* Papra Connection Settings - Collapsible */}
        <Card>
          <UnstyledButton onClick={togglePapra} w="100%" p="md">
            <Group justify="space-between">
              <Group gap="sm">
                {papraOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                <Text fw={600} size="md">Papra</Text>
                {localPreferences?.papra_enabled && (
                  <Text size="xs" c={localPreferences?.papra_connection_verified ? 'green' : 'yellow'} fw={500}>
                    {localPreferences?.papra_connection_verified ? 'Connected' : 'Enabled'}
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {t('settings.papra.description')}
              </Text>
            </Group>
          </UnstyledButton>
          <Collapse in={papraOpen}>
            <div style={{ padding: '0 var(--mantine-spacing-md) var(--mantine-spacing-md)' }}>
              <PapraSettings
                settings={localPreferences}
                onSettingChange={(key, value) => setLocalPreferences(prev => ({ ...prev, [key]: value }))}
                loading={savingPreferences}
              />
            </div>
          </Collapse>
        </Card>

        {/* File Cleanup */}
        <Card>
          <div className="settings-section">
            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.documents.cleanup.title', 'File Cleanup')}</div>
                <div className="settings-option-description">
                  {t('settings.documents.cleanup.description', 'Clean up out-of-sync files and resolve document storage inconsistencies. This will reset failed uploads, clear orphaned tasks, and fix database sync issues.')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button
                  variant="secondary"
                  onClick={handleCleanupFiles}
                  disabled={cleaningFiles || loadingPreferences}
                  loading={cleaningFiles}
                >
                  {cleaningFiles ? t('settings.documents.cleanup.cleaning', 'Cleaning...') : t('settings.documents.cleanup.button', 'Cleanup Files')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <SaveResetBar
          visible={hasDocumentChanges}
          saving={savingPreferences}
          onSave={handleSavePreferences}
          onReset={handleResetPreferences}
          t={t}
        />
      </div>
      )}

      {/* Notifications Tab Content */}
      {activeTab === 'notifications' && (
        <div className="settings-content" role="tabpanel" id="settings-tabpanel-notifications" aria-labelledby="settings-tab-notifications">
          <NotificationSettings />
        </div>
      )}

      {/* About Tab Content */}
      {activeTab === 'about' && (
      <div className="settings-content" role="tabpanel" id="settings-tabpanel-about" aria-labelledby="settings-tab-about">
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.systemInfo', 'System Information')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.system.version.title', 'Application Version')}</div>
                <div className="settings-option-description">
                  {renderVersionInfo()}
                </div>
              </div>
            </div>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.system.timezone.title', 'Timezone')}</div>
                <div className="settings-option-description">
                  {timezoneService.getTimezone()}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Getting Help Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.gettingHelp', 'Getting Help')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.help.documentation.title', 'Documentation')}</div>
                <div className="settings-option-description">
                  {t('settings.help.documentation.description', 'Browse the wiki for guides, setup instructions, and feature documentation.')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button
                  variant="secondary"
                  onClick={() => window.open('https://github.com/afairgiant/MediKeep/wiki', '_blank', 'noopener,noreferrer')}
                >
                  {t('settings.help.documentation.title', 'Documentation')}
                </Button>
              </div>
            </div>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-title">{t('settings.help.issues.title', 'Report an Issue')}</div>
                <div className="settings-option-description">
                  {t('settings.help.issues.description', 'Found a bug or have a feature request? Open an issue on GitHub.')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button
                  variant="secondary"
                  onClick={() => window.open('https://github.com/afairgiant/MediKeep/issues', '_blank', 'noopener,noreferrer')}
                >
                  {t('settings.help.issues.title', 'Report an Issue')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Support MediKeep Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.supportMediKeep', 'Support MediKeep')}</h3>

            <div className="settings-option">
              <div className="settings-option-info">
                <div className="settings-option-description">
                  {t('settings.sponsor.description', 'MediKeep is free and open source. If you find it useful, consider sponsoring the project to help fund development and keep it going.')}
                </div>
              </div>
              <div className="settings-option-control">
                <Button
                  onClick={() => window.open('https://github.com/sponsors/afairgiant', '_blank', 'noopener,noreferrer')}
                >
                  {t('settings.sponsor.button', 'Sponsor on GitHub')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Release Notes Section */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.sections.releaseNotes', 'Release Notes')}</h3>
            <ReleaseNotesHistory />
          </div>
        </Card>
      </div>
      )}

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
      />
    </Container>
  );
};

export default Settings;
