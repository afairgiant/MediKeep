import logger from '../../services/logger';

import React, { useState } from 'react';
import { Modal } from '../ui';
import { Button, Alert } from '../ui';
import { adminApiService } from '../../services/api/adminApi';

const AdminResetPasswordModal = ({ isOpen, onClose, userId, username }) => {
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = e => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setPasswordData({
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

  const handlePasswordReset = async e => {
    e.preventDefault();

    // Reset messages
    setError('');
    setSuccessMessage('');

    // Validation
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Check if password contains at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(passwordData.newPassword);
    const hasNumber = /\d/.test(passwordData.newPassword);
    if (!hasLetter || !hasNumber) {
      setError('Password must contain at least one letter and one number');
      return;
    }

    try {
      setIsResetting(true);
      await adminApiService.adminResetPassword(
        userId,
        passwordData.newPassword
      );

      setSuccessMessage(`Password reset successfully for ${username}!`);
      resetForm();

      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      logger.error('Error resetting password:', error);
      setError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reset Password for ${username}`}
      size="small"
      className="admin-reset-password-modal"
    >
      <div className="reset-password-content">
        {error && <Alert type="error">{error}</Alert>}
        {successMessage && <Alert type="success">{successMessage}</Alert>}

        <div className="user-info">
          <p>
            <strong>User:</strong> {username} (ID: {userId})
          </p>
          <p className="warning-text">
            ⚠️ This will immediately reset the user's password. They will need
            to use the new password to log in.
          </p>
        </div>

        <form onSubmit={handlePasswordReset} className="password-form">
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handleInputChange}
              required
              className="form-input"
              minLength="6"
              disabled={isResetting}
              placeholder="Enter new password"
            />
            <small className="form-help">
              Password must be at least 6 characters with at least one letter
              and one number
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handleInputChange}
              required
              className="form-input"
              disabled={isResetting}
              placeholder="Confirm new password"
            />
          </div>

          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isResetting}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>

      <style>{`
        .reset-password-content {
          padding: 0;
        }

        .user-info {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 0.375rem;
          margin-bottom: 1.5rem;
          border-left: 4px solid #667eea;
        }

        .user-info p {
          margin: 0.5rem 0;
          font-size: 0.9rem;
        }

        .warning-text {
          color: #d97706;
          font-weight: 500;
          font-size: 0.85rem !important;
        }

        .password-form {
          width: 100%;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e9ecef;
          border-radius: 0.375rem;
          font-size: 0.95rem;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-input:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-help {
          display: block;
          font-size: 0.8rem;
          color: #666;
          margin-top: 0.25rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #f1f3f5;
        }

        @media (max-width: 480px) {
          .form-actions {
            flex-direction: column;
            gap: 0.5rem;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </Modal>
  );
};

export default AdminResetPasswordModal;
