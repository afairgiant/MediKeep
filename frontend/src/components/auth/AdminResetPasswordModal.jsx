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
import { useTranslation } from 'react-i18next';
import { adminApiService } from '../../services/api/adminApi';
import logger from '../../services/logger';

const AdminResetPasswordModal = ({ isOpen, onClose, userId, username }) => {
  const { t } = useTranslation(['admin', 'auth', 'common', 'shared']);
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
      setError(t('users.passwordModal.bothFieldsRequired'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('users.passwordModal.passwordsDoNotMatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError(t('admin:createUser.validation.passwordMinLength'));
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(passwordData.newPassword);
    const hasNumber = /\d/.test(passwordData.newPassword);
    if (!hasLetter || !hasNumber) {
      setError(t('admin:createUser.validation.passwordRequirements'));
      return;
    }

    try {
      setIsResetting(true);
      await adminApiService.adminResetPassword(
        userId,
        passwordData.newPassword
      );

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setError('');
      setSuccessMessage(t('users.passwordModal.resetSuccess', { username }));

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
      title={t('users.passwordModal.title', { username })}
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
            {t('users.passwordModal.userInfo', { username, userId })}
          </Text>
          <Alert
            color="yellow"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            mt="xs"
            p="xs"
          >
            <Text size="xs">{t('users.passwordModal.immediateReset')}</Text>
          </Alert>
        </Paper>

        <form onSubmit={handlePasswordReset}>
          <Stack gap="md">
            <PasswordInput
              label={t('users.passwordModal.newPassword')}
              placeholder={t('users.passwordModal.enterNewPassword')}
              value={passwordData.newPassword}
              onChange={e =>
                setPasswordData(prev => ({
                  ...prev,
                  newPassword: e.currentTarget.value,
                }))
              }
              required
              minLength={6}
              disabled={isResetting}
              description={t('users.passwordModal.passwordDescription')}
            />

            <PasswordInput
              label={t('settings:security.password.confirmPassword')}
              placeholder={t('users.passwordModal.confirmPlaceholder')}
              value={passwordData.confirmPassword}
              onChange={e =>
                setPasswordData(prev => ({
                  ...prev,
                  confirmPassword: e.currentTarget.value,
                }))
              }
              required
              disabled={isResetting}
            />

            <Group justify="flex-end" gap="sm" mt="xs">
              <Button
                variant="default"
                onClick={handleClose}
                disabled={isResetting}
              >
                {t('shared:fields.cancel')}
              </Button>
              <Button type="submit" loading={isResetting}>
                {t('shared:labels.resetPassword')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  );
};

export default AdminResetPasswordModal;
