import { useState } from 'react';
import {
  Switch,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Alert,
} from '@mantine/core';

const isLocalHostname = (hostname) => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
  if (hostname.startsWith('172.')) {
    const second = parseInt(hostname.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
};

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
 * @param {boolean} [props.hasAlternateAuth] - Whether alternate auth exists (e.g. username/password)
 * @param {function} props.onTestConnection - Callback to trigger connection test
 * @param {boolean} props.testingConnection - Whether a test is in progress
 * @param {string|null} props.connectionStatus - 'success', 'error', or null
 * @param {string} [props.connectionMessage] - Message to show with connection status
 * @param {function} [props.validateUrl] - Custom URL validator, returns error string or null
 * @param {function} [props.renderAuthExtras] - Render prop for extra auth fields
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
  token,
  onTokenChange,
  tokenPlaceholder,
  hasTokenSaved = false,
  hasAlternateAuth = false,
  onTestConnection,
  testingConnection = false,
  connectionStatus = null,
  connectionMessage = '',
  validateUrl,
  renderAuthExtras,
  renderExtras,
  loading = false,
}) => {
  const [showToken, setShowToken] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const defaultValidateUrl = (value) => {
    if (!value) return 'URL is required';
    try {
      const parsed = new URL(value);
      if (!isLocalHostname(parsed.hostname) && parsed.protocol !== 'https:') {
        return 'External URLs must use HTTPS';
      }
    } catch {
      return 'Invalid URL format';
    }
    return null;
  };

  const doValidateUrl = validateUrl || defaultValidateUrl;

  const handleUrlChange = (event) => {
    const value = event.currentTarget.value.trim();
    setUrlError(doValidateUrl(value));
    onUrlChange(value);
  };

  const handleTokenChange = (event) => {
    const value = event.currentTarget.value.trim();
    if (value && value.length < 10) {
      setTokenError('Token appears too short');
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
    // Token is optional if saved credentials or alternate auth (e.g. username/password) exists
    if (!token && !hasTokenSaved && !hasAlternateAuth) {
      setTokenError('API token is required');
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
        label={`Enable ${name} integration`}
        checked={enabled}
        onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        disabled={loading}
      />

      <TextInput
        label="Server URL"
        placeholder={urlPlaceholder || `https://${name.toLowerCase().replace(/[^a-z]/g, '')}.example.com`}
        value={url}
        onChange={handleUrlChange}
        error={urlError}
        disabled={disabled || testingConnection}
        description="HTTP is allowed for local addresses, HTTPS required for external URLs"
      />

      <PasswordInput
        label="API Token"
        placeholder={
          hasTokenSaved && !token
            ? 'Token saved - leave blank to keep current'
            : tokenPlaceholder || 'Enter your API token'
        }
        value={token}
        onChange={handleTokenChange}
        error={tokenError}
        disabled={disabled || testingConnection}
        visible={showToken}
        onVisibilityChange={setShowToken}
      />

      {renderAuthExtras && renderAuthExtras({ disabled, testingConnection })}

      <Group justify="flex-start" gap="sm">
        <Button
          variant="default"
          onClick={handleTestConnection}
          loading={testingConnection}
          disabled={!canTest}
        >
          {testingConnection ? 'Testing...' : 'Test Connection'}
        </Button>
      </Group>

      {connectionStatus === 'success' && (
        <Alert color="green" variant="light">
          {connectionMessage || `Successfully connected to ${name}`}
        </Alert>
      )}

      {connectionStatus === 'error' && (
        <Alert color="red" variant="light">
          {connectionMessage || `Unable to connect to ${name}. Check your URL and credentials.`}
        </Alert>
      )}

      {renderExtras && renderExtras({ disabled, testingConnection, connectionStatus })}
    </Stack>
  );
};

export default IntegrationSettingsCard;
