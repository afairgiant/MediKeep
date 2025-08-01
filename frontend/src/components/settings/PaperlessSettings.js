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
  const prevTokenRef = useRef();

  // Initialize connection status for saved settings
  useEffect(() => {
    const currentUrl = preferences?.paperless_url;
    
    // Check if URL actually changed (not just component re-render)
    const urlChanged = prevUrlRef.current !== undefined && prevUrlRef.current !== currentUrl;
    
    if (urlChanged) {
      // URL changed - reset connection status
      setConnectionStatus('disconnected');
      setServerInfo(null);
      
      frontendLogger.logInfo('Paperless URL changed, resetting connection status', {
        component: 'PaperlessSettings',
        oldUrl: prevUrlRef.current,
        newUrl: currentUrl
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
    
    // Only set to disconnected if we truly have no URL
    if (!currentUrl) {
      setConnectionStatus('disconnected');
      setServerInfo(null);
    }
  }, [preferences?.paperless_url, connectionStatus]);

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
      
      // If form credentials are empty, try to use saved credentials by getting them from the backend
      let testUrl = preferences.paperless_url;
      let testUsername = preferences.paperless_username;
      let testPassword = preferences.paperless_password;
      
      // If credentials are missing from form, we need to test with the saved configuration
      // The backend will use the saved encrypted credentials for this user
      if (!testUsername || !testPassword) {
        frontendLogger.logInfo('Using saved credentials for connection test', {
          component: 'PaperlessSettings',
          hasFormUsername: !!testUsername,
          hasFormPassword: !!testPassword
        });
        
        // Test with minimal data - backend will use saved credentials
        const result = await testPaperlessConnection(testUrl, '', '');
        
        if (result.status === 'connected') {
          setConnectionStatus('connected');
          setServerInfo({
            serverUrl: result.server_url,
            note: result.note
          });

          frontendLogger.logInfo('Paperless connection test successful with saved credentials', {
            component: 'PaperlessSettings',
            serverUrl: result.server_url
          });
        } else {
          setConnectionStatus('failed');
          setServerInfo(null);
        }
      } else {
        // Test with form credentials
        const result = await testPaperlessConnection(testUrl, testUsername, testPassword);

        if (result.status === 'connected') {
          setConnectionStatus('connected');
          setServerInfo({
            serverUrl: result.server_url,
            note: result.note
          });

          frontendLogger.logInfo('Paperless connection test successful with form credentials', {
            component: 'PaperlessSettings',
            serverUrl: result.server_url
          });
        } else {
          setConnectionStatus('failed');
          setServerInfo(null);
        }
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

    // If URL, username, or password changes, reset connection status
    if (updates.paperless_url !== undefined || updates.paperless_username !== undefined || updates.paperless_password !== undefined) {
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