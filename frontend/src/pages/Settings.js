import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Container from '../components/layout/Container';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import '../styles/pages/Settings.css';

const Settings = () => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleOpenPasswordModal = () => {
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

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
