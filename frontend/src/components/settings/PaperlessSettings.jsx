import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Radio,
  Group,
  TextInput,
  PasswordInput,
  Switch,
  Text,
} from '@mantine/core';
import IntegrationSettingsCard from './IntegrationSettingsCard';
import {
  PAPERLESS_AUTH_METHODS,
  hasPaperlessCredentials,
  resolvePaperlessAuthMethod,
} from '../../constants/paperlessSettings';
import { testPaperlessConnection } from '../../services/api/paperlessApi.jsx';
import frontendLogger from '../../services/frontendLogger';

// The app theme makes TextInput labels bolder than Mantine's default, but
// PasswordInput (Password, API Token) is not themed. Username is a TextInput, so
// it is set back to the default weight to match the fields around it.
const DEFAULT_LABEL_WEIGHT = 500;

/**
 * PaperlessSettings Component
 *
 * Manages Paperless-ngx integration settings using the shared
 * IntegrationSettingsCard template. Adds auth method selection
 * (token vs username/password) and sync options as extras. The chosen method
 * is a saved preference (paperless_auth_method), so changing it is an unsaved
 * change like any other setting.
 */
const PaperlessSettings = ({
  preferences,
  onPreferencesUpdate,
  loading = false,
}) => {
  const { t } = useTranslation('settings');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const authMethod = resolvePaperlessAuthMethod(
    preferences?.paperless_auth_method
  );

  // Don't render until preferences are loaded
  if (!preferences || Object.keys(preferences).length === 0) {
    return (
      <Text c="dimmed">
        {t('paperlessConnection.loadingSettings', 'Loading settings...')}
      </Text>
    );
  }

  const handleUpdate = updates => {
    const updatedPrefs = { ...preferences, ...updates };

    // If disabling and currently the active backend, fall back to local
    if (
      updates.paperless_enabled === false &&
      preferences.default_storage_backend === 'paperless'
    ) {
      updatedPrefs.default_storage_backend = 'local';
    }

    onPreferencesUpdate(updatedPrefs);
  };

  const handleTestConnection = async () => {
    const url = preferences.paperless_url;
    if (!url) return;

    const connectionFailedMessage = t(
      'paperlessConnection.connectionError',
      'Unable to connect. Please check your URL and credentials.'
    );

    try {
      setTestingConnection(true);
      setConnectionStatus(null);
      setConnectionMessage('');

      const token =
        authMethod === 'token' ? preferences.paperless_api_token : '';
      const username =
        authMethod === 'basic_auth' ? preferences.paperless_username : '';
      const password =
        authMethod === 'basic_auth' ? preferences.paperless_password : '';
      const hasApiToken = token && token.trim();
      const hasCredentials = username && password;

      let result;
      if (hasApiToken) {
        frontendLogger.logInfo('Testing connection with API token', {
          component: 'PaperlessSettings',
        });
        result = await testPaperlessConnection(url, '', '', token, authMethod);
      } else if (hasCredentials) {
        frontendLogger.logInfo('Testing connection with username/password', {
          component: 'PaperlessSettings',
        });
        result = await testPaperlessConnection(
          url,
          username,
          password,
          '',
          authMethod
        );
      } else {
        frontendLogger.logInfo('Using saved credentials for connection test', {
          component: 'PaperlessSettings',
        });
        result = await testPaperlessConnection(url, '', '', '', authMethod);
      }

      if (result.status === 'connected') {
        setConnectionStatus('success');
        setConnectionMessage(
          t('paperlessConnection.connected', 'Connected to Paperless-ngx')
        );
        // Optimistically mark verified so StoragePreferencesCard unlocks immediately
        handleUpdate({ paperless_connection_verified: true });
        frontendLogger.logInfo('Paperless connection test successful', {
          component: 'PaperlessSettings',
          authMethod: result.auth_method,
        });
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message || connectionFailedMessage);
        frontendLogger.logWarning('Paperless connection test failed', {
          component: 'PaperlessSettings',
          error: result.message,
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error.message || connectionFailedMessage);
      frontendLogger.logError('Paperless connection test error', {
        component: 'PaperlessSettings',
        error: error.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const paperlessEnabled = preferences.paperless_enabled ?? false;
  const hasTokenSaved = preferences.paperless_has_token ?? false;
  const hasCredentialsSaved = preferences.paperless_has_credentials ?? false;
  const isVerified = preferences.paperless_connection_verified ?? false;

  return (
    <IntegrationSettingsCard
      name="Paperless-ngx"
      enabled={paperlessEnabled}
      onEnabledChange={checked => handleUpdate({ paperless_enabled: checked })}
      url={preferences.paperless_url || ''}
      onUrlChange={value => handleUpdate({ paperless_url: value })}
      urlPlaceholder="https://paperless.example.com"
      token={
        authMethod === 'token' ? preferences.paperless_api_token || '' : ''
      }
      onTokenChange={value => handleUpdate({ paperless_api_token: value })}
      hasTokenSaved={hasTokenSaved}
      showTokenField={authMethod === 'token'}
      onTestConnection={handleTestConnection}
      testingConnection={testingConnection}
      connectionStatus={connectionStatus}
      connectionMessage={connectionMessage}
      loading={loading}
      renderAuthExtras={({ disabled, testingConnection: testing }) => (
        <>
          <Radio.Group
            label={t('paperlessConnection.authMethod', 'Authentication Method')}
            description={t(
              'paperlessConnection.authMethodDescription',
              'API tokens are more secure. Generate one in your Paperless-ngx admin panel.'
            )}
            value={authMethod}
            onChange={value => handleUpdate({ paperless_auth_method: value })}
          >
            <Group mt="xs">
              {PAPERLESS_AUTH_METHODS.map(method => (
                <Radio
                  key={method.value}
                  value={method.value}
                  label={t(method.labelKey, method.defaultLabel)}
                  disabled={disabled || testing}
                />
              ))}
            </Group>
          </Radio.Group>

          {!hasPaperlessCredentials(preferences, authMethod) && (
            <Text size="xs" c="dimmed">
              {t(
                'paperlessConnection.noSavedCredentials',
                'No saved credentials for this method yet. Enter them below to use it.'
              )}
            </Text>
          )}

          {authMethod === 'basic_auth' && (
            <>
              <TextInput
                label={t('paperlessConnection.usernameLabel', 'Username')}
                styles={{ label: { fontWeight: DEFAULT_LABEL_WEIGHT } }}
                placeholder={t(
                  'paperlessConnection.usernamePlaceholder',
                  'Enter your username'
                )}
                value={preferences.paperless_username || ''}
                onChange={e =>
                  handleUpdate({
                    paperless_username: e.currentTarget.value.trim(),
                  })
                }
                disabled={disabled || testing}
              />
              <PasswordInput
                label={t('paperlessConnection.passwordLabel', 'Password')}
                placeholder={
                  hasCredentialsSaved && !preferences.paperless_password
                    ? t(
                        'paperlessConnection.passwordSavedPlaceholder',
                        'Password saved - leave blank to keep current'
                      )
                    : t(
                        'paperlessConnection.passwordPlaceholder',
                        'Enter your password'
                      )
                }
                value={preferences.paperless_password || ''}
                onChange={e =>
                  handleUpdate({ paperless_password: e.currentTarget.value })
                }
                disabled={disabled || testing}
              />
            </>
          )}
        </>
      )}
      renderExtras={({ connectionStatus: status }) =>
        (status === 'success' || isVerified) && (
          <>
            <Switch
              label={t(
                'paperlessConnection.autoSyncLabel',
                'Enable automatic sync status checking'
              )}
              description={t(
                'paperlessConnection.autoSyncDescription',
                'Automatically check if documents still exist in Paperless when pages load'
              )}
              checked={preferences.paperless_auto_sync ?? false}
              onChange={e =>
                handleUpdate({ paperless_auto_sync: e.currentTarget.checked })
              }
            />
            <Switch
              label={t(
                'paperlessConnection.syncTagsLabel',
                'Sync document tags and categories'
              )}
              description={t(
                'paperlessConnection.syncTagsDescription',
                'Keep document metadata synchronized with Paperless (Coming Soon)'
              )}
              checked={preferences.paperless_sync_tags ?? true}
              onChange={e =>
                handleUpdate({ paperless_sync_tags: e.currentTarget.checked })
              }
              disabled
              styles={{ track: { opacity: 0.5 } }}
            />
          </>
        )
      }
    />
  );
};

export default PaperlessSettings;
