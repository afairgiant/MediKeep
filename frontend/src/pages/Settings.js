import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/layout/Header';
import Container from '../components/layout/Container';
import { Card, Button } from '../components/ui';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';
import { useAuth } from '../contexts/AuthContext';
import {
  checkPatientProfileCompletion,
  checkForPatientPlaceholderValues,
  getPatientProfileCompletionMessage,
} from '../utils/profileUtils';
import { useCurrentPatient } from '../hooks/useGlobalData';
import '../styles/pages/Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const { patient } = useCurrentPatient();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    username: '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Check if we should focus on profile (from navigation state)
  useEffect(() => {
    if (location.state?.focusProfile) {
      setIsEditingProfile(true);
      // Scroll to profile section
      setTimeout(() => {
        const profileSection = document.getElementById('profile-section');
        if (profileSection) {
          profileSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.state]);

  // Initialize profile data from user context
  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        username: user.username || '',
      });
    }
  }, [user]);

  const handleOpenPasswordModal = () => {
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    // Reset to original values
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        username: user.username || '',
      });
    }
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // For now, just simulate a successful save
      console.log('Saving profile:', profileData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // TODO: When backend API is ready, replace with actual API call:
      // const { updateUser } = useAuth(); // Move to component level
      // await apiService.updateUserProfile(profileData);
      // updateUser(profileData);

      setIsEditingProfile(false);
      // TODO: Show success message
    } catch (error) {
      console.error('Failed to save profile:', error);
      // TODO: Show error message to user
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!user) {
    return (
      <Container>
        <Header title="Settings" subtitle="Loading..." showBackButton={true} />
      </Container>
    );
  }

  // Only show patient completion status if patient data exists
  const showPatientCompletion = patient;
  const completion = showPatientCompletion
    ? checkPatientProfileCompletion(patient)
    : null;
  const placeholders = showPatientCompletion
    ? checkForPatientPlaceholderValues(patient)
    : null;
  const completionMessage = showPatientCompletion
    ? getPatientProfileCompletionMessage(patient)
    : null;

  return (
    <Container>
      <Header
        title="Settings"
        subtitle="Manage your application preferences and settings"
        showBackButton={true}
      />

      <div className="settings-content">
        {/* Patient Profile Completion Status - Only show if profile is incomplete */}
        {showPatientCompletion &&
          (!completion.isComplete || placeholders.hasPlaceholders) && (
            <Card className="profile-completion-status">
              <div className="completion-status-header">
                <h3>🏥 Medical Profile Completion</h3>
                <div className="completion-percentage">
                  {completion.completionPercentage}% Complete
                </div>
              </div>
              <p className="completion-status-message">{completionMessage}</p>
              <div className="completion-progress-bar">
                <div
                  className="completion-progress-fill"
                  style={{ width: `${completion.completionPercentage}%` }}
                />
              </div>
              {completion.missingFields.length > 0 && (
                <div className="missing-info">
                  <small>Missing: {completion.missingFields.join(', ')}</small>
                </div>
              )}
              <div className="completion-action">
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => navigate('/patients/me')}
                >
                  Complete Medical Profile
                </Button>
              </div>
            </Card>
          )}

        {/* Profile Information Section */}
        <Card id="profile-section">
          <div className="settings-section">
            <div className="section-header">
              <h3 className="settings-section-title">Profile Information</h3>
              {!isEditingProfile && (
                <Button variant="secondary" onClick={handleEditProfile}>
                  Edit Profile
                </Button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="profile-edit-form">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    value={profileData.fullName}
                    onChange={e =>
                      handleInputChange('fullName', e.target.value)
                    }
                    placeholder="Enter your full name"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={profileData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email address"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={profileData.username}
                    onChange={e =>
                      handleInputChange('username', e.target.value)
                    }
                    placeholder="Enter your username"
                    className="form-input"
                    disabled
                  />
                  <small className="form-help">
                    Username cannot be changed
                  </small>
                </div>

                <div className="form-actions">
                  <Button
                    variant="primary"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="profile-display">
                <div className="profile-field">
                  <div className="field-label">Full Name</div>
                  <div className="field-value">
                    {user.fullName || (
                      <span className="placeholder-text">Not set</span>
                    )}
                  </div>
                </div>

                <div className="profile-field">
                  <div className="field-label">Email Address</div>
                  <div className="field-value">
                    {user.email || (
                      <span className="placeholder-text">Not set</span>
                    )}
                  </div>
                </div>

                <div className="profile-field">
                  <div className="field-label">Username</div>
                  <div className="field-value">{user.username}</div>
                </div>

                <div className="profile-field">
                  <div className="field-label">Role</div>
                  <div className="field-value">
                    <span className="role-badge">{user.role || 'user'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

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
