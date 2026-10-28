import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { adminApiService } from '../../services/api/adminApi';
import { notifyError, notifySuccess } from '../../utils/notifyTranslated';
import logger from '../../services/logger';

interface ResetTwoFactorModalProps {
  user: { id: number; username: string } | null;
  opened: boolean;
  onClose: () => void;
  /** Called after the reset succeeded, before the modal closes. */
  onReset: () => void;
}

/** Confirms turning off a user's two-factor authentication on their behalf. */
const ResetTwoFactorModal = ({
  user,
  opened,
  onClose,
  onReset,
}: ResetTwoFactorModalProps) => {
  const { t } = useTranslation(['admin', 'shared']);
  const [submitting, setSubmitting] = useState(false);

  const reset = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await adminApiService.resetUserTwoFactor(user.id);
      notifySuccess('notifications:toasts.security.twoFactorResetByAdmin', {
        interpolation: { username: user.username },
      });
      onReset();
      onClose();
    } catch (e) {
      logger.error('admin_two_factor_reset_failed', {
        component: 'ResetTwoFactorModal',
        error: (e as Error)?.message,
      });
      notifyError('notifications:toasts.security.twoFactorResetFailed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => !submitting && onClose()}
      title={t('users.resetTwoFactorModal.title')}
    >
      {user && (
        <Stack>
          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            {t('users.resetTwoFactorModal.body', { username: user.username })}
          </Alert>
          <Text size="sm" c="dimmed">
            {t('users.resetTwoFactorModal.hint')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={submitting}>
              {t('shared:fields.cancel')}
            </Button>
            <Button
              color="orange"
              loading={submitting}
              onClick={() => void reset()}
            >
              {t('users.resetTwoFactor')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};

export default ResetTwoFactorModal;
