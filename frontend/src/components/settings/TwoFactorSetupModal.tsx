import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Code,
  CopyButton,
  Group,
  PasswordInput,
  PinInput,
  Stack,
  Text,
} from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { ResponsiveModal } from '../adapters/ResponsiveModal';
import {
  confirmTotpSetup,
  startTotpSetup,
  type TotpSetup,
} from '../../services/api/securityApi';
import { authErrorText } from '../../utils/authErrorCopy';
import { TOTP_LENGTH } from '../../constants/twoFactor';

interface TwoFactorSetupModalProps {
  opened: boolean;
  onClose: () => void;
  /** Two-factor is on; codes are the backup codes to show once. */
  onEnabled: (codes: string[]) => void;
}

const groupKey = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? '';

/** Password, then QR code and confirmation code. Nothing is turned on until the code is accepted. */
const TwoFactorSetupModal = ({
  opened,
  onClose,
  onEnabled,
}: TwoFactorSetupModalProps) => {
  const { t } = useTranslation('settings');
  const { t: tAuth } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPassword('');
    setSetup(null);
    setCode('');
    setError('');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const run = async (action: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setCode('');
      // The pending secret is gone, so the QR code on screen no longer works
      if (
        (e as { errorCode?: string })?.errorCode ===
        'two_factor_setup_not_started'
      ) {
        setSetup(null);
      }
      setError(authErrorText(tAuth, e, t('security.twoFactor.failed')));
    } finally {
      setSubmitting(false);
    }
  };

  const begin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password) return;
    void run(async () => {
      setSetup(await startTotpSetup(password));
      setPassword('');
    });
  };

  const confirm = (value: string) => {
    void run(async () => {
      const { backup_codes } = await confirmTotpSetup(value);
      reset();
      onEnabled(backup_codes);
    });
  };

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length === TOTP_LENGTH) confirm(code);
  };

  return (
    <ResponsiveModal
      opened={opened}
      onClose={close}
      title={t('security.twoFactor.setup.title')}
      size="md"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {!setup ? (
          <form onSubmit={begin}>
            <Stack gap="md">
              <Text size="sm">
                {t('security.twoFactor.setup.passwordStep')}
              </Text>
              <PasswordInput
                label={t('security.password.currentPassword')}
                value={password}
                onChange={e => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                autoFocus
                required
                disabled={submitting}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={close} disabled={submitting}>
                  {t('security.twoFactor.cancel')}
                </Button>
                <Button type="submit" loading={submitting} disabled={!password}>
                  {t('security.twoFactor.setup.continue')}
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <form onSubmit={handleConfirm}>
            <Stack gap="md">
              <Text size="sm">{t('security.twoFactor.setup.scanStep')}</Text>
              <Group justify="center">
                <div style={{ background: '#fff', padding: 12, lineHeight: 0 }}>
                  <QRCodeSVG
                    value={setup.otpauth_uri}
                    size={184}
                    title={t('security.twoFactor.setup.qrLabel')}
                  />
                </div>
              </Group>
              <div>
                <Text size="sm" c="dimmed">
                  {t('security.twoFactor.setup.manualKey')}
                </Text>
                <Group gap="xs" wrap="nowrap">
                  <Code
                    data-testid="totp-secret"
                    style={{ wordBreak: 'break-all' }}
                  >
                    {groupKey(setup.secret)}
                  </Code>
                  <CopyButton value={setup.secret}>
                    {({ copied, copy }) => (
                      <Button size="compact-xs" variant="subtle" onClick={copy}>
                        {copied
                          ? t('security.twoFactor.backupCodes.copied')
                          : t('security.twoFactor.backupCodes.copy')}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </div>
              <Text size="sm" id="totp-confirm-prompt">
                {t('security.twoFactor.setup.codeStep')}
              </Text>
              <Group justify="center">
                <PinInput
                  length={TOTP_LENGTH}
                  type="number"
                  oneTimeCode
                  value={code}
                  onChange={setCode}
                  onComplete={confirm}
                  disabled={submitting}
                  aria-label={tAuth('login.twoFactor.codeLabel')}
                  aria-describedby="totp-confirm-prompt"
                />
              </Group>
              <Group justify="flex-end">
                <Button variant="default" onClick={close} disabled={submitting}>
                  {t('security.twoFactor.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={code.length !== TOTP_LENGTH}
                >
                  {t('security.twoFactor.setup.confirm')}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </ResponsiveModal>
  );
};

export default TwoFactorSetupModal;
