import React, { useState } from 'react';
import { Card, Button } from '../ui';
import frontendLogger from '../../services/frontendLogger';

/**
 * ConnectionConfigCard Component
 * 
 * Handles paperless-ngx server connection configuration including
 * URL input, API token input, and connection testing.
 */
const ConnectionConfigCard = ({ 
  preferences, 
  onUpdate, 
  connectionStatus, 
  onConnectionTest, 
  testingConnection = false,
  serverInfo = null
}) => {
  const [showToken, setShowToken] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  /**
   * Validate URL format
   */
  const validateUrl = (url) => {
    if (!url) return 'URL is required';
    
    // Basic URL format validation
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return 'Invalid URL format';
    }
    
    // Check if it's a local development URL
    const isLocal = (
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname.startsWith('192.168.') ||
      parsedUrl.hostname.startsWith('10.') ||
      (parsedUrl.hostname.startsWith('172.') && 
       parsedUrl.hostname.split('.').length >= 2 &&
       /^\d+$/.test(parsedUrl.hostname.split('.')[1]) &&
       16 <= parseInt(parsedUrl.hostname.split('.')[1]) <= 31)
    );
    
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
  const validateToken = (token) => {
    if (!token) return 'API token is required';
    
    // Basic validation - allow various token formats
    if (token.length < 10) {
      return 'API token seems too short';
    }
    
    return null;
  };

  /**
   * Handle URL input change
   */
  const handleUrlChange = (event) => {
    const value = event.target.value.trim();
    const error = validateUrl(value);
    
    setValidationErrors(prev => ({
      ...prev,
      url: error
    }));
    
    onUpdate({ paperless_url: value });
  };

  /**
   * Handle API token input change
   */
  const handleTokenChange = (event) => {
    const value = event.target.value.trim();
    const error = validateToken(value);
    
    setValidationErrors(prev => ({
      ...prev,
      token: error
    }));
    
    onUpdate({ paperless_api_token: value });
  };

  /**
   * Handle connection test with validation
   */
  const handleTestConnection = () => {
    const urlError = validateUrl(preferences.paperless_url);
    const tokenError = validateToken(preferences.paperless_api_token);
    
    if (urlError || tokenError) {
      setValidationErrors({
        url: urlError,
        token: tokenError
      });
      
      frontendLogger.logWarning('Connection test blocked by validation errors', {
        component: 'ConnectionConfigCard',
        urlError,
        tokenError
      });
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
          color: '#28a745'
        };
      case 'failed':
        return {
          className: 'connection-status-failed',
          icon: '✗',
          text: 'Connection Failed',
          color: '#dc3545'
        };
      case 'testing':
        return {
          className: 'connection-status-testing',
          icon: '⏳',
          text: 'Testing...',
          color: '#ffc107'
        };
      default:
        return {
          className: 'connection-status-disconnected',
          icon: '○',
          text: 'Not Connected',
          color: '#6c757d'
        };
    }
  };

  const statusInfo = getConnectionStatusInfo();
  // Can test if we have both URL and token
  const canTest = preferences.paperless_url && preferences.paperless_api_token && !testingConnection;

  return (
    <Card>
      <div className="paperless-connection-config">
        <div className="paperless-section-header">
          <div className="paperless-section-title">
            <span className="paperless-section-icon">🔗</span>
            <h3>Paperless-ngx Connection</h3>
          </div>
          
          <div className={`paperless-connection-status ${statusInfo.className}`}>
            <span className="connection-status-icon" style={{ color: statusInfo.color }}>
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
              The URL of your paperless-ngx instance (HTTP allowed for localhost, HTTPS required for external URLs)
            </div>
          </div>

          <div className="paperless-form-group">
            <label htmlFor="paperless-token" className="paperless-form-label">
              API Token *
            </label>
            <div className="paperless-token-input-group">
              <input
                id="paperless-token"
                type={showToken ? 'text' : 'password'}
                className={`paperless-form-input ${validationErrors.token ? 'error' : ''}`}
                placeholder="Enter your API token"
                value={preferences.paperless_api_token || ''}
                onChange={handleTokenChange}
                disabled={testingConnection}
              />
              <button
                type="button"
                className="paperless-token-toggle"
                onClick={() => setShowToken(!showToken)}
                disabled={testingConnection}
              >
                {showToken ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {validationErrors.token && (
              <div className="paperless-form-error">{validationErrors.token}</div>
            )}
            <div className="paperless-form-help">
              Generate this token in your paperless-ngx profile settings
            </div>
          </div>
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
          {connectionStatus === 'connected' && serverInfo && (
            <div className="paperless-server-info">
              <div className="server-info-item">
                <span className="server-info-label">✓ API v{serverInfo.apiVersion} Compatible</span>
              </div>
              {serverInfo.version && (
                <div className="server-info-item">
                  <span className="server-info-label">📡 Server: Paperless-ngx {serverInfo.version}</span>
                </div>
              )}
            </div>
          )}

          {connectionStatus === 'failed' && (
            <div className="paperless-connection-error">
              <div className="connection-error-message">
                Unable to connect to paperless-ngx. Please check your URL and API token.
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ConnectionConfigCard;