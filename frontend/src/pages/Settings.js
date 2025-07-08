import React, { useState, useEffect } from 'react';
import { Header } from '../components/adapters';
import Container from '../components/layout/Container';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import DeleteAccountModal from '../components/auth/DeleteAccountModal';
import { useAuth } from '../contexts/AuthContext';
import { getVersionInfo } from '../services/systemService';
import frontendLogger from '../services/frontendLogger';
import '../styles/pages/Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(true);

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

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteAccountModalOpen}
        onClose={handleCloseDeleteAccountModal}
      />
    </Container>
  );
};

export default Settings;
