import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import frontendLogger from '../../services/frontendLogger';

/**
 * ConnectionConfigCard Component
 *
 * Handles paperless-ngx server connection configuration including
 * URL input, API token authentication, username/password authentication,
 * and connection testing. API token authentication takes priority over
 * username/password when both are provided.
 */
const ConnectionConfigCard = ({
  preferences,
  onUpdate,
  connectionStatus,
  onConnectionTest,
  testingConnection = false,
  serverInfo = null,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [authMethod, setAuthMethod] = useState('token'); // 'token' or 'credentials'
  const [validationErrors, setValidationErrors] = useState({});

  // Set initial auth method based on existing data
  useEffect(() => {
    const hasApiToken =
      preferences?.paperless_api_token &&
      preferences.paperless_api_token.trim();
    const hasCredentials =
      preferences?.paperless_username && preferences?.paperless_password;

    if (hasApiToken) {
      setAuthMethod('token');
    } else if (hasCredentials) {
      setAuthMethod('credentials');
    }
    // If neither, keep default 'token' method
  }, [
    preferences?.paperless_api_token,
    preferences?.paperless_username,
    preferences?.paperless_password,
  ]);

  /**
   * Validate URL format
   */
  const validateUrl = url => {
    if (!url) return 'URL is required';

    // Basic URL format validation
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return 'Invalid URL format';
    }

    // Check if it's a local development URL
    const isLocal =
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname.startsWith('192.168.') ||
      parsedUrl.hostname.startsWith('10.') ||
      (parsedUrl.hostname.startsWith('172.') &&
        parsedUrl.hostname.split('.').length >= 2 &&
        /^\d+$/.test(parsedUrl.hostname.split('.')[1]) &&
        16 <= parseInt(parsedUrl.hostname.split('.')[1]) <= 31);

    // For external URLs, require HTTPS for security
    if (!isLocal && !url.startsWith('https://')) {
      return 'External URLs must use HTTPS for security';
    }

    // Allow HTTP for local development
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'URL must start with http:// or https://';
    }

    return null;
  };

  /**
   * Validate API token format
   */
  const validateApiToken = token => {
    if (!token) return 'API token is required';

    if (token.length < 10) {
      return 'API token too short';
    }

    return null;
  };

  /**
   * Validate username format
   */
  const validateUsername = username => {
    if (!username) return 'Username is required';

    if (username.length < 2) {
      return 'Username too short';
    }

    return null;
  };

  /**
   * Validate password format
   */
  const validatePassword = password => {
    if (!password) return 'Password is required';

    if (password.length < 3) {
      return 'Password too short';
    }

    return null;
  };

  /**
   * Handle URL input change
   */
  const handleUrlChange = event => {
    const value = event.target.value.trim();
    const error = validateUrl(value);

    setValidationErrors(prev => ({
      ...prev,
      url: error,
    }));

    onUpdate({ paperless_url: value });
  };

  /**
   * Handle API token input change
   */
  const handleApiTokenChange = event => {
    const value = event.target.value.trim();
    const error = authMethod === 'token' ? validateApiToken(value) : null;

    setValidationErrors(prev => ({
      ...prev,
      apiToken: error,
    }));

    onUpdate({ paperless_api_token: value });
  };

  /**
   * Handle username input change
   */
  const handleUsernameChange = event => {
    const value = event.target.value.trim();
    const error = authMethod === 'credentials' ? validateUsername(value) : null;

    setValidationErrors(prev => ({
      ...prev,
      username: error,
    }));

    onUpdate({ paperless_username: value });
  };

  /**
   * Handle password input change
   */
  const handlePasswordChange = event => {
    const value = event.target.value;
    const error = authMethod === 'credentials' ? validatePassword(value) : null;

    setValidationErrors(prev => ({
      ...prev,
      password: error,
    }));

    onUpdate({ paperless_password: value });
  };

  /**
   * Handle authentication method change
   */
  const handleAuthMethodChange = method => {
    setAuthMethod(method);
    // Clear validation errors when switching methods
    setValidationErrors({});
  };

  /**
   * Handle connection test with validation
   */
  const handleTestConnection = () => {
    const urlError = validateUrl(preferences.paperless_url);

    let apiTokenError = null;
    let usernameError = null;
    let passwordError = null;

    // Determine which authentication method to use based on available data
    const hasApiToken =
      preferences.paperless_api_token && preferences.paperless_api_token.trim();
    const hasCredentials =
      preferences.paperless_username && preferences.paperless_password;

    if (hasApiToken) {
      // Using API token authentication
      apiTokenError = validateApiToken(preferences.paperless_api_token);
    } else if (hasCredentials) {
      // Using username/password authentication
      usernameError = validateUsername(preferences.paperless_username);
      passwordError = validatePassword(preferences.paperless_password);
    } else {
      // No authentication method provided - may use saved credentials
      frontendLogger.logInfo(
        'No credentials provided in form, will attempt to use saved credentials',
        {
          component: 'ConnectionConfigCard',
        }
      );
    }

    if (urlError || apiTokenError || usernameError || passwordError) {
      setValidationErrors({
        url: urlError,
        apiToken: apiTokenError,
        username: usernameError,
        password: passwordError,
      });

      frontendLogger.logWarning(
        'Connection test blocked by validation errors',
        {
          component: 'ConnectionConfigCard',
          urlError,
          apiTokenError,
          usernameError,
          passwordError,
        }
      );
      return;
    }

    // Clear validation errors
    setValidationErrors({});
    onConnectionTest();
  };

  /**
   * Get connection status display info
   */
  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          className: 'connection-status-connected',
          icon: '✓',
          text: 'Connected',
          color: '#28a745',
        };
      case 'failed':
        return {
          className: 'connection-status-failed',
          icon: '✗',
          text: 'Connection Failed',
          color: '#dc3545',
        };
      case 'testing':
        return {
          className: 'connection-status-testing',
          icon: '⏳',
          text: 'Testing...',
          color: '#ffc107',
        };
      default:
        return {
          className: 'connection-status-disconnected',
          icon: '○',
          text: 'Not Connected',
          color: '#6c757d',
        };
    }
  };

  const statusInfo = getConnectionStatusInfo();
  // Can test if we have URL (credentials can be saved or provided)
  const canTest = preferences.paperless_url && !testingConnection;

  return (
    <Card>
      <div className="paperless-connection-config">
        <div className="paperless-section-header">
          <div className="paperless-section-title">
            <span className="paperless-section-icon">🔗</span>
            <h3>Paperless-ngx Connection</h3>
          </div>

          <div
            className={`paperless-connection-status ${statusInfo.className}`}
          >
            <span
              className="connection-status-icon"
              style={{ color: statusInfo.color }}
            >
              {statusInfo.icon}
            </span>
            <span className="connection-status-text">{statusInfo.text}</span>
          </div>
        </div>

        <div className="paperless-form-section">
          <div className="paperless-form-group">
            <label htmlFor="paperless-url" className="paperless-form-label">
              Server URL *
            </label>
            <input
              id="paperless-url"
              type="url"
              className={`paperless-form-input ${validationErrors.url ? 'error' : ''}`}
              placeholder="https://paperless.example.com"
              value={preferences.paperless_url || ''}
              onChange={handleUrlChange}
              disabled={testingConnection}
            />
            {validationErrors.url && (
              <div className="paperless-form-error">{validationErrors.url}</div>
            )}
            <div className="paperless-form-help">
              The URL of your paperless-ngx instance (HTTP allowed for
              localhost, HTTPS required for external URLs)
            </div>
          </div>

          {/* Authentication Method Selector */}
          <div className="paperless-form-group">
            <label className="paperless-form-label">
              Authentication Method
            </label>
            <div className="paperless-auth-method-selector">
              <div className="paperless-radio-group">
                <label className="paperless-radio-option">
                  <input
                    type="radio"
                    name="auth-method"
                    value="token"
                    checked={authMethod === 'token'}
                    onChange={() => handleAuthMethodChange('token')}
                    disabled={testingConnection}
                  />
                  <span>API Token (Recommended)</span>
                </label>
                <label className="paperless-radio-option">
                  <input
                    type="radio"
                    name="auth-method"
                    value="credentials"
                    checked={authMethod === 'credentials'}
                    onChange={() => handleAuthMethodChange('credentials')}
                    disabled={testingConnection}
                  />
                  <span>Username & Password</span>
                </label>
              </div>
            </div>
            <div className="paperless-form-help">
              API tokens are more secure and don't expire. Generate one in your
              Paperless-ngx admin panel.
            </div>
          </div>

          {/* API Token Field */}
          {authMethod === 'token' && (
            <div className="paperless-form-group">
              <label
                htmlFor="paperless-api-token"
                className="paperless-form-label"
              >
                API Token *
              </label>
              <div className="paperless-token-input-group">
                <input
                  id="paperless-api-token"
                  type={showApiToken ? 'text' : 'password'}
                  className={`paperless-form-input ${validationErrors.apiToken ? 'error' : ''}`}
                  placeholder="Enter your API token"
                  value={preferences.paperless_api_token || ''}
                  onChange={handleApiTokenChange}
                  disabled={testingConnection}
                />
                <button
                  type="button"
                  className="paperless-token-toggle"
                  onClick={() => setShowApiToken(!showApiToken)}
                  disabled={testingConnection}
                >
                  {showApiToken ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {validationErrors.apiToken && (
                <div className="paperless-form-error">
                  {validationErrors.apiToken}
                </div>
              )}
              <div className="paperless-form-help">
                Your paperless-ngx API token (found in Profile → Tokens or
                generate a new one)
              </div>
            </div>
          )}

          {/* Username & Password Fields */}
          {authMethod === 'credentials' && (
            <>
              <div className="paperless-form-group">
                <label
                  htmlFor="paperless-username"
                  className="paperless-form-label"
                >
                  Username *
                </label>
                <input
                  id="paperless-username"
                  type="text"
                  className={`paperless-form-input ${validationErrors.username ? 'error' : ''}`}
                  placeholder="Enter your username"
                  value={preferences.paperless_username || ''}
                  onChange={handleUsernameChange}
                  disabled={testingConnection}
                />
                {validationErrors.username && (
                  <div className="paperless-form-error">
                    {validationErrors.username}
                  </div>
                )}
                <div className="paperless-form-help">
                  Your paperless-ngx username
                </div>
              </div>

              <div className="paperless-form-group">
                <label
                  htmlFor="paperless-password"
                  className="paperless-form-label"
                >
                  Password *
                </label>
                <div className="paperless-token-input-group">
                  <input
                    id="paperless-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`paperless-form-input ${validationErrors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    value={preferences.paperless_password || ''}
                    onChange={handlePasswordChange}
                    disabled={testingConnection}
                  />
                  <button
                    type="button"
                    className="paperless-token-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={testingConnection}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {validationErrors.password && (
                  <div className="paperless-form-error">
                    {validationErrors.password}
                  </div>
                )}
                <div className="paperless-form-help">
                  Your paperless-ngx password
                </div>
              </div>
            </>
          )}
        </div>

        <div className="paperless-connection-actions">
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={!canTest}
            loading={testingConnection}
          >
            {testingConnection ? 'Testing Connection...' : 'Test Connection'}
          </Button>

          {/* Server Information */}
          {connectionStatus === 'connected' && (
            <div className="paperless-server-info">
              <div className="server-info-item">
                <span className="server-info-label">
                  ✓ Connection successful
                </span>
              </div>
              {serverInfo?.auth_method && (
                <div className="server-info-item">
                  <span className="server-info-label">
                    Authentication:{' '}
                    {serverInfo.auth_method === 'token'
                      ? 'API Token'
                      : 'Username/Password'}
                  </span>
                </div>
              )}
              {serverInfo?.used_saved_credentials && (
                <div className="server-info-item">
                  <span className="server-info-label">
                    Using saved credentials
                  </span>
                </div>
              )}
            </div>
          )}

          {connectionStatus === 'failed' && (
            <div className="paperless-connection-error">
              <div className="connection-error-message">
                Unable to connect to paperless-ngx. Please check your URL and
                authentication credentials.
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ConnectionConfigCard;
