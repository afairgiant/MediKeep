import logger from '../../services/logger';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui';
import { Button, Alert } from '../ui';
import { apiService } from '../../services/api';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation(['auth', 'common', 'shared']);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handlePasswordInputChange = e => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePasswordChange = async e => {
    e.preventDefault();

    // Reset messages
    setError('');
    setSuccessMessage('');

    // Validation
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setError(t('changePassword.allFieldsRequired'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('settings:security.password.forceChange.errors.passwordsMustMatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError(t('settings:security.password.forceChange.errors.passwordTooShort'));
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setError(t('settings:security.password.forceChange.errors.passwordMustDiffer'));
      return;
    }

    try {
      setIsChangingPassword(true);
      await apiService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setSuccessMessage(t('changePassword.success'));
      resetForm();

      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      logger.error('Error changing password:', error);
      setError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('changePassword.title')}
      size="small"
      className="change-password-modal"
    >
      <div className="change-password-content">
        {error && <Alert type="error">{error}</Alert>}
        {successMessage && <Alert type="success">{successMessage}</Alert>}

        <form onSubmit={handlePasswordChange} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">{t('settings:security.password.currentPassword')}</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordInputChange}
              required
              className="form-input"
              disabled={isChangingPassword}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">{t('settings:security.password.newPassword')}</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handlePasswordInputChange}
              required
              className="form-input"
              minLength="6"
              disabled={isChangingPassword}
            />
            <small className="form-help">
              {t('changePassword.passwordHelp')}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('settings:security.password.confirmPassword')}</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handlePasswordInputChange}
              required
              className="form-input"
              disabled={isChangingPassword}
            />
          </div>

          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isChangingPassword}
            >
              {t('shared:fields.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isChangingPassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? t('settings:security.password.forceChange.submitting') : t('settings:security.password.button')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
