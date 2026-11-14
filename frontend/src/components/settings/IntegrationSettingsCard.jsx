import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Switch,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Alert,
} from '@mantine/core';

/**
 * IntegrationSettingsCard
 *
 * Shared template for external integration settings (Paperless-ngx, Papra, etc.).
 * Provides a consistent layout: enable toggle, URL, API token, test connection,
 * and connection status. Integration-specific sections are passed via render props.
 *
 * @param {Object} props
 * @param {string} props.name - Display name of the integration
 * @param {boolean} props.enabled - Whether the integration is enabled
 * @param {function} props.onEnabledChange - Callback when enable toggle changes
 * @param {string} props.url - Server URL value
 * @param {function} props.onUrlChange - Callback when URL changes
 * @param {string} [props.urlPlaceholder] - URL input placeholder text
 * @param {string} props.token - API token value (current form value)
 * @param {function} props.onTokenChange - Callback when token changes
 * @param {string} [props.tokenPlaceholder] - Token input placeholder text
 * @param {boolean} props.hasTokenSaved - Whether a token is saved server-side
 * @param {function} props.onTestConnection - Callback to trigger connection test
 * @param {boolean} props.testingConnection - Whether a test is in progress
 * @param {string|null} props.connectionStatus - 'success', 'error', or null
 * @param {string} [props.connectionMessage] - Message to show with connection status
 * @param {function} [props.validateUrl] - Custom URL validator, returns error string or null
 * @param {boolean} [props.showTokenField=true] - Whether to render the API token field (rendered after renderAuthExtras)
 * @param {function} [props.renderAuthExtras] - Render prop for extra auth fields, rendered above the token field
 * @param {function} [props.renderExtras] - Render prop for integration-specific sections
 * @param {boolean} [props.loading] - Whether a save operation is in progress
 */
const IntegrationSettingsCard = ({
  name,
  enabled,
  onEnabledChange,
  url,
  onUrlChange,
  urlPlaceholder,
  urlDescription,
  urlNote,
  token,
  onTokenChange,
  tokenPlaceholder,
  hasTokenSaved = false,
  onTestConnection,
  testingConnection = false,
  connectionStatus = null,
  connectionMessage = '',
  validateUrl,
  showTokenField = true,
  renderAuthExtras,
  renderExtras,
  loading = false,
}) => {
  const { t } = useTranslation('settings');
  const [showToken, setShowToken] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const defaultValidateUrl = value => {
    if (!value) return t('integration.urlRequired', 'URL is required');
    // HTTPS-vs-private is decided by the backend, which resolves the host from its own network.
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return t(
          'integration.urlBadScheme',
          'URL must start with http:// or https://'
        );
      }
    } catch {
      return t('integration.urlInvalid', 'Invalid URL format');
    }
    return null;
  };

  const doValidateUrl = validateUrl || defaultValidateUrl;

  const handleUrlChange = event => {
    const value = event.currentTarget.value.trim();
    setUrlError(doValidateUrl(value));
    onUrlChange(value);
  };

  const handleTokenChange = event => {
    const value = event.currentTarget.value.trim();
    if (value && value.length < 10) {
      setTokenError(t('integration.tokenTooShort', 'Token appears too short'));
    } else {
      setTokenError(null);
    }
    onTokenChange(value);
  };

  const handleTestConnection = () => {
    const uErr = doValidateUrl(url);
    if (uErr) {
      setUrlError(uErr);
      return;
    }
    // Token is optional if one is already saved, and is not checked at all
    // while the token field is hidden (e.g. username/password auth is selected)
    if (showTokenField && !token && !hasTokenSaved) {
      setTokenError(t('integration.tokenRequired', 'API token is required'));
      return;
    }
    setUrlError(null);
    setTokenError(null);
    onTestConnection();
  };

  const busy = loading || testingConnection;
  const disabled = !enabled || loading;
  const canTest = enabled && url && !busy;

  return (
    <Stack gap="md">
      <Switch
        label={t('integration.enable', {
          name,
          defaultValue: 'Enable {{name}} integration',
        })}
        checked={enabled}
        onChange={event => onEnabledChange(event.currentTarget.checked)}
        disabled={loading}
      />

      <TextInput
        label={t('integration.serverUrl', 'Server URL')}
        placeholder={
          urlPlaceholder ||
          `https://${name.toLowerCase().replace(/[^a-z]/g, '')}.example.com`
        }
        value={url}
        onChange={handleUrlChange}
        error={urlError}
        disabled={disabled || testingConnection}
        description={
          urlDescription ||
          t(
            'integration.defaultUrlDescription',
            'HTTP is allowed for local addresses, HTTPS required for external URLs'
          )
        }
      />

      {urlNote && (
        <Alert color="blue" variant="light">
          {urlNote}
        </Alert>
      )}

      {renderAuthExtras && renderAuthExtras({ disabled, testingConnection })}

      {showTokenField && (
        <PasswordInput
          label={t('integration.apiToken', 'API Token')}
          placeholder={
            hasTokenSaved && !token
              ? t(
                  'integration.tokenSavedPlaceholder',
                  'Token saved - leave blank to keep current'
                )
              : tokenPlaceholder ||
                t('integration.tokenPlaceholder', 'Enter your API token')
          }
          value={token}
          onChange={handleTokenChange}
          error={tokenError}
          disabled={disabled || testingConnection}
          visible={showToken}
          onVisibilityChange={setShowToken}
        />
      )}

      <Group justify="flex-start" gap="sm">
        <Button
          variant="default"
          onClick={handleTestConnection}
          loading={testingConnection}
          disabled={!canTest}
        >
          {testingConnection
            ? t('integration.testing', 'Testing...')
            : t('integration.testConnection', 'Test Connection')}
        </Button>
      </Group>

      {connectionStatus === 'success' && (
        <Alert color="green" variant="light">
          {connectionMessage ||
            t('integration.connectedTo', {
              name,
              defaultValue: 'Successfully connected to {{name}}',
            })}
        </Alert>
      )}

      {connectionStatus === 'error' && (
        <Alert color="red" variant="light">
          {connectionMessage ||
            t('integration.connectionFailedTo', {
              name,
              defaultValue:
                'Unable to connect to {{name}}. Check your URL and credentials.',
            })}
        </Alert>
      )}

      {renderExtras &&
        renderExtras({ disabled, testingConnection, connectionStatus })}
    </Stack>
  );
};

export default IntegrationSettingsCard;
