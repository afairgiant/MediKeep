import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button as MantineButton, Group, Stack, Text } from '@mantine/core';
import { Button } from '../ui';
import { ResponsiveModal } from '../adapters/ResponsiveModal';
import { revokeOtherSessions } from '../../services/api/securityApi';
import { notifyError, notifySuccess } from '../../utils/notifyTranslated';
import logger from '../../services/logger';

interface OtherSessionsSettingProps {
  onSignedOut?: () => void;
}

/** The "sign out other devices" row of the Settings Security card. */
const OtherSessionsSetting = ({ onSignedOut }: OtherSessionsSettingProps) => {
  const { t } = useTranslation('settings');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const signOutOthers = async () => {
    setSubmitting(true);
    try {
      await revokeOtherSessions();
      setConfirming(false);
      onSignedOut?.();
      notifySuccess('notifications:toasts.security.otherSessionsSignedOut');
    } catch (e) {
      logger.error('revoke_other_sessions_failed', {
        component: 'OtherSessionsSetting',
        error: (e as Error)?.message,
      });
      notifyError('notifications:toasts.security.otherSessionsFailed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="settings-option">
        <div className="settings-option-info">
          <div className="settings-option-title">
            {t('security.sessions.title')}
          </div>
          <div className="settings-option-description">
            {t('security.sessions.description')}
          </div>
        </div>
        <div className="settings-option-control">
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {t('security.sessions.button')}
          </Button>
        </div>
      </div>

      <ResponsiveModal
        opened={confirming}
        onClose={() => !submitting && setConfirming(false)}
        title={t('security.sessions.confirmTitle')}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{t('security.sessions.confirmBody')}</Text>
          <Group justify="flex-end">
            <MantineButton
              variant="default"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              {t('security.twoFactor.cancel')}
            </MantineButton>
            <MantineButton
              color="red"
              loading={submitting}
              onClick={() => void signOutOthers()}
            >
              {t('security.sessions.button')}
            </MantineButton>
          </Group>
        </Stack>
      </ResponsiveModal>
    </>
  );
};

export default OtherSessionsSetting;
