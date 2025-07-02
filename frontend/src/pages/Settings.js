import React, { useState, useEffect } from 'react';
import { Header } from '../components/adapters';
import Container from '../components/layout/Container';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import { useAuth } from '../contexts/AuthContext';
import { getVersionInfo } from '../services/systemService';
import '../styles/pages/Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(true);

  const handleOpenPasswordModal = () => {
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        console.log('=== SETTINGS COMPONENT: Starting version fetch ===');
        setLoadingVersion(true);
        const version = await getVersionInfo();
        console.log('=== SETTINGS COMPONENT: Version info received ===');
        console.log('Version object:', JSON.stringify(version, null, 2));
        console.log('version.app_name:', version?.app_name);
        console.log('version.version:', version?.version);
        setVersionInfo(version);
        console.log('=== SETTINGS COMPONENT: State updated ===');
      } catch (error) {
        console.error('=== SETTINGS COMPONENT: Failed to load version ===');
        console.error('Error:', error);
        // Don't show error to user, just fail silently
      } finally {
        setLoadingVersion(false);
        console.log('=== SETTINGS COMPONENT: Loading complete ===');
      }
    };

    fetchVersionInfo();
  }, []);

  // Add debugging for render
  console.log('=== SETTINGS COMPONENT RENDER ===');
  console.log('loadingVersion:', loadingVersion);
  console.log('versionInfo:', versionInfo);
  if (versionInfo) {
    console.log('versionInfo.app_name:', versionInfo.app_name);
    console.log('versionInfo.version:', versionInfo.version);
  }

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

            {/* Debug info - remove this later */}
            {!loadingVersion && (
              <div
                className="settings-option"
                style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}
              >
                <div className="settings-option-info">
                  <div className="settings-option-title">Debug Info</div>
                  <div className="settings-option-description">
                    {versionInfo ? (
                      <pre
                        style={{
                          fontSize: '10px',
                          background: '#f5f5f5',
                          padding: '5px',
                          borderRadius: '3px',
                        }}
                      >
                        {JSON.stringify(versionInfo, null, 2)}
                      </pre>
                    ) : (
                      'No version info available'
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Placeholder for future settings */}
        <Card>
          <div className="settings-section">
            <h3 className="settings-section-title">Application Preferences</h3>
            <p className="settings-placeholder-text">
              Additional settings will be added here in future updates.
            </p>
          </div>
        </Card>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
      />
    </Container>
  );
};

export default Settings;
