import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Group, Skeleton, Text } from '@mantine/core';
import { Button } from '../ui';
import { useTwoFactorStatus } from '../../hooks/useTwoFactorStatus';
import {
  disableTwoFactor,
  regenerateBackupCodes,
} from '../../services/api/securityApi';
import { notifySuccess } from '../../utils/notifyTranslated';
import { LOW_BACKUP_CODES } from '../../constants/twoFactor';
import BackupCodesModal from './BackupCodesModal';
import ConfirmIdentityModal from './ConfirmIdentityModal';
import TrustedDevicesSetting from './TrustedDevicesSetting';

// Keeps the QR code library out of the main bundle until someone enrolls
const TwoFactorSetupModal = lazy(() => import('./TwoFactorSetupModal'));

type OpenModal = 'setup' | 'disable' | 'regenerate' | null;

interface TwoFactorSettingsProps {
  /** Changes whenever other sessions are signed out. */
  sessionsRevision?: number;
}

/** The two-factor row of the Settings Security card. */
const TwoFactorSettings = ({
  sessionsRevision = 0,
}: TwoFactorSettingsProps) => {
  const { t } = useTranslation('settings');
  const { status, loading, error, reload } = useTwoFactorStatus();
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const closeModal = () => setOpenModal(null);

  const showCodes = (codes: string[]) => {
    closeModal();
    setNewCodes(codes);
    void reload();
  };

  const handleEnabled = (codes: string[]) => {
    notifySuccess('notifications:toasts.security.twoFactorEnabled');
    showCodes(codes);
  };

  const handleDisable = async (password: string, code: string) => {
    await disableTwoFactor(password, code);
    closeModal();
    notifySuccess('notifications:toasts.security.twoFactorDisabled');
    void reload();
  };

  const handleRegenerate = async (password: string, code: string) => {
    const { backup_codes } = await regenerateBackupCodes(password, code);
    notifySuccess('notifications:toasts.security.backupCodesRegenerated');
    showCodes(backup_codes);
  };

  const description = () => {
    if (loading) return <Skeleton height={14} width="70%" />;
    if (error || !status) {
      return (
        <Group gap="xs">
          <Text size="sm" c="red">
            {t('security.twoFactor.loadFailed')}
          </Text>
          <Button variant="ghost" size="small" onClick={() => void reload()}>
            {t('security.twoFactor.retry')}
          </Button>
        </Group>
      );
    }
    if (status.totp_enabled) {
      const remaining = status.backup_codes_remaining;
      const low = remaining <= LOW_BACKUP_CODES;
      return (
        <>
          {t('security.twoFactor.enabledDescription')}{' '}
          <Text
            span
            size="sm"
            c={low ? 'orange' : undefined}
            fw={low ? 600 : undefined}
            data-testid="backup-codes-remaining"
          >
            {low
              ? t('security.twoFactor.lowCodes', { count: remaining })
              : t('security.twoFactor.codesRemaining', { count: remaining })}
          </Text>
        </>
      );
    }
    if (!status.enrollment_allowed && status.blocked_reason) {
      return t(`security.twoFactor.blocked.${status.blocked_reason}`, {
        defaultValue: t('security.twoFactor.blocked.unknown'),
      });
    }
    return t('security.twoFactor.description');
  };

  return (
    <>
      <div className="settings-option">
        <div className="settings-option-info">
          <div className="settings-option-title">
            <Group gap="xs">
              {t('security.twoFactor.title')}
              {status && (
                <Badge
                  size="sm"
                  variant="light"
                  color={status.totp_enabled ? 'green' : 'gray'}
                >
                  {status.totp_enabled
                    ? t('security.twoFactor.statusOn')
                    : t('security.twoFactor.statusOff')}
                </Badge>
              )}
            </Group>
          </div>
          <div className="settings-option-description">{description()}</div>
        </div>
        <div className="settings-option-control">
          {status?.totp_enabled ? (
            <Group gap="xs" justify="flex-end">
              <Button
                variant="secondary"
                onClick={() => setOpenModal('regenerate')}
              >
                {t('security.twoFactor.regenerate')}
              </Button>
              <Button variant="danger" onClick={() => setOpenModal('disable')}>
                {t('security.twoFactor.disable')}
              </Button>
            </Group>
          ) : (
            status?.enrollment_allowed && (
              <Button variant="secondary" onClick={() => setOpenModal('setup')}>
                {t('security.twoFactor.enable')}
              </Button>
            )
          )}
        </div>
      </div>
      {status?.totp_enabled && (
        <TrustedDevicesSetting sessionsRevision={sessionsRevision} />
      )}

      {openModal === 'setup' && (
        <Suspense fallback={null}>
          <TwoFactorSetupModal
            opened
            onClose={closeModal}
            onEnabled={handleEnabled}
          />
        </Suspense>
      )}
      <ConfirmIdentityModal
        opened={openModal === 'disable'}
        title={t('security.twoFactor.disableModal.title')}
        description={t('security.twoFactor.disableModal.description')}
        submitLabel={t('security.twoFactor.disable')}
        danger
        onClose={closeModal}
        onSubmit={handleDisable}
      />
      <ConfirmIdentityModal
        opened={openModal === 'regenerate'}
        title={t('security.twoFactor.regenerateModal.title')}
        description={t('security.twoFactor.regenerateModal.description')}
        submitLabel={t('security.twoFactor.regenerate')}
        onClose={closeModal}
        onSubmit={handleRegenerate}
      />
      <BackupCodesModal
        opened={newCodes !== null}
        codes={newCodes ?? []}
        onClose={() => setNewCodes(null)}
      />
    </>
  );
};

export default TwoFactorSettings;
