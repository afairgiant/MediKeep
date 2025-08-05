import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from '../ui';
import ConnectionConfigCard from './ConnectionConfigCard';
import StoragePreferencesCard from './StoragePreferencesCard';
import { testPaperlessConnection, updatePaperlessSettings } from '../../services/api/paperlessApi';
import frontendLogger from '../../services/frontendLogger';
import '../../styles/components/PaperlessSettings.css';

/**
 * PaperlessSettings Component
 * 
 * Main component for managing paperless-ngx integration settings.
 * Handles connection configuration, storage preferences, and testing.
 */
const PaperlessSettings = ({ 
  preferences, 
  onPreferencesUpdate, 
  loading = false,
  className = '' 
}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [testingConnection, setTestingConnection] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  
  // Track previous URL and token to detect actual changes
  const prevUrlRef = useRef();
  const prevApiTokenRef = useRef();

  // Initialize connection status for saved settings
  useEffect(() => {
    const currentUrl = preferences?.paperless_url;
    
    const currentApiToken = preferences?.paperless_api_token;
    
    // Check if URL or API token actually changed (not just component re-render)
    const urlChanged = prevUrlRef.current !== undefined && prevUrlRef.current !== currentUrl;
    const apiTokenChanged = prevApiTokenRef.current !== undefined && prevApiTokenRef.current !== currentApiToken;
    
    if (urlChanged || apiTokenChanged) {
      // URL or API token changed - reset connection status
      setConnectionStatus('disconnected');
      setServerInfo(null);
      
      frontendLogger.logInfo('Paperless URL or API token changed, resetting connection status', {
        component: 'PaperlessSettings',
        oldUrl: prevUrlRef.current,
        newUrl: currentUrl,
        tokenChanged: apiTokenChanged
      });
    } else if (currentUrl && connectionStatus === 'disconnected' && prevUrlRef.current === undefined) {
      // First load with saved URL - assume it was previously working
      setConnectionStatus('connected');
      setServerInfo({
        serverUrl: currentUrl,
        note: 'Previously saved connection'
      });
      
      frontendLogger.logInfo('Initialized with saved paperless settings', {
        component: 'PaperlessSettings',
        url: currentUrl
      });
    }
    
    // Update refs for next comparison
    prevUrlRef.current = currentUrl;
    prevApiTokenRef.current = currentApiToken;
    
    // Only set to disconnected if we truly have no URL
    if (!currentUrl) {
      setConnectionStatus('disconnected');
      setServerInfo(null);
    }
  }, [preferences?.paperless_url, preferences?.paperless_api_token, connectionStatus]);

  /**
   * Handle connection test
   */
  const handleConnectionTest = async () => {
    // Check if we have URL in preferences (either from form or saved)
    if (!preferences.paperless_url) {
      frontendLogger.logWarning('Connection test attempted without URL', {
        component: 'PaperlessSettings',
        hasUrl: !!preferences.paperless_url
      });
      return;
    }

    try {
      setTestingConnection(true);
      
      // Gather connection test parameters
      let testUrl = preferences.paperless_url;
      let testUsername = preferences.paperless_username;
      let testPassword = preferences.paperless_password;
      let testApiToken = preferences.paperless_api_token;
      
      // Determine authentication method and test accordingly
      const hasApiToken = testApiToken && testApiToken.trim();
      const hasCredentials = testUsername && testPassword;
      
      let result;
      
      if (hasApiToken) {
        // Test with API token
        frontendLogger.logInfo('Testing connection with API token', {
          component: 'PaperlessSettings',
          hasApiToken: true
        });
        
        result = await testPaperlessConnection(testUrl, '', '', testApiToken);
      } else if (hasCredentials) {
        // Test with username/password
        frontendLogger.logInfo('Testing connection with username/password', {
          component: 'PaperlessSettings',
          hasUsername: !!testUsername,
          hasPassword: !!testPassword
        });
        
        result = await testPaperlessConnection(testUrl, testUsername, testPassword);
      } else {
        // No form credentials provided - test with saved configuration
        frontendLogger.logInfo('Using saved credentials for connection test', {
          component: 'PaperlessSettings',
          hasFormData: false
        });
        
        result = await testPaperlessConnection(testUrl, '', '', '');
      }
      
      if (result.status === 'connected') {
        setConnectionStatus('connected');
        setServerInfo({
          serverUrl: result.server_url,
          note: result.note,
          auth_method: result.auth_method,
          used_saved_credentials: result.used_saved_credentials
        });

        frontendLogger.logInfo('Paperless connection test successful', {
          component: 'PaperlessSettings',
          serverUrl: result.server_url,
          authMethod: result.auth_method,
          usedSaved: result.used_saved_credentials
        });
      } else {
        setConnectionStatus('failed');
        setServerInfo(null);
        
        frontendLogger.logWarning('Paperless connection test failed', {
          component: 'PaperlessSettings',
          error: result.message || 'Unknown error'
        });
      }
      
    } catch (error) {
      setConnectionStatus('failed');
      setServerInfo(null);
      
      frontendLogger.logError('Paperless connection test failed', {
        component: 'PaperlessSettings',
        error: error.message,
        url: preferences.paperless_url
      });
    } finally {
      setTestingConnection(false);
    }
  };

  /**
   * Handle local preference updates
   */
  const handleLocalUpdate = (updates) => {
    const updatedPrefs = {
      ...preferences,
      ...updates
    };
    
    onPreferencesUpdate(updatedPrefs);

    // If URL, API token, username, or password changes, reset connection status
    if (updates.paperless_url !== undefined || 
        updates.paperless_api_token !== undefined || 
        updates.paperless_username !== undefined || 
        updates.paperless_password !== undefined) {
      setConnectionStatus('disconnected');
      setServerInfo(null);
    }
  };

  // Don't render until preferences are loaded
  if (!preferences || Object.keys(preferences).length === 0) {
    return (
      <div className={`paperless-settings ${className}`}>
        <div className="paperless-settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className={`paperless-settings ${className}`}>
      {/* Connection Configuration */}
      <ConnectionConfigCard
        preferences={preferences}
        onUpdate={handleLocalUpdate}
        connectionStatus={connectionStatus}
        onConnectionTest={handleConnectionTest}
        testingConnection={testingConnection}
        serverInfo={serverInfo}
      />

      {/* Storage Preferences - only show if connection is successful */}
      <StoragePreferencesCard
        preferences={preferences}
        onUpdate={handleLocalUpdate}
        connectionEnabled={connectionStatus === 'connected'}
      />

    </div>
  );
};

export default PaperlessSettings;