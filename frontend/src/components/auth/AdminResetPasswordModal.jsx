import React, { useState } from 'react';
import {
  Modal,
  Button,
  Alert,
  PasswordInput,
  Stack,
  Group,
  Text,
  Paper,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { adminApiService } from '../../services/api/adminApi';
import logger from '../../services/logger';

const AdminResetPasswordModal = ({ isOpen, onClose, userId, username }) => {
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = () => {
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePasswordReset = async e => {
    e.preventDefault();

    setError('');
    setSuccessMessage('');

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

    const hasLetter = /[a-zA-Z]/.test(passwordData.newPassword);
    const hasNumber = /\d/.test(passwordData.newPassword);
    if (!hasLetter || !hasNumber) {
      setError('Password must contain at least one letter and one number');
      return;
    }

    try {
      setIsResetting(true);
      await adminApiService.adminResetPassword(userId, passwordData.newPassword);

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setError('');
      setSuccessMessage(`Password reset successfully for ${username}!`);

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      logger.error('password_reset_error', 'Error resetting password', {
        component: 'AdminResetPasswordModal',
        userId,
        error: err.message,
      });
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={`Reset Password for ${username}`}
      size="sm"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert color="green" variant="light">
            {successMessage}
          </Alert>
        )}

        <Paper
          p="sm"
          radius="sm"
          withBorder
          style={{ borderLeft: '4px solid var(--mantine-color-blue-5)' }}
        >
          <Text size="sm">
            <strong>User:</strong> {username} (ID: {userId})
          </Text>
          <Alert
            color="yellow"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            mt="xs"
            p="xs"
          >
            <Text size="xs">
              This will immediately reset the user&apos;s password. They will need to use the new password to log in.
            </Text>
          </Alert>
        </Paper>

        <form onSubmit={handlePasswordReset}>
          <Stack gap="md">
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.currentTarget.value }))}
              required
              minLength={6}
              disabled={isResetting}
              description="At least 6 characters with one letter and one number"
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.currentTarget.value }))}
              required
              disabled={isResetting}
            />

            <Group justify="flex-end" gap="sm" mt="xs">
              <Button
                variant="default"
                onClick={handleClose}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isResetting}
              >
                Reset Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  );
};

export default AdminResetPasswordModal;
