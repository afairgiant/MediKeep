import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { ResponsiveModal } from '../adapters/ResponsiveModal';
import AuthErrorAlert from '../auth/AuthErrorAlert';
import { authErrorText, lastAttemptWarning } from '../../utils/authErrorCopy';

interface ConfirmIdentityModalProps {
  opened: boolean;
  title: string;
  description: string;
  submitLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** Throws on refusal; the modal shows the error and stays open. */
  onSubmit: (currentPassword: string, code: string) => Promise<void>;
}

/** Asks for the password plus an authenticator or backup code before a two-factor change. */
const ConfirmIdentityModal = ({
  opened,
  title,
  description,
  submitLabel,
  danger = false,
  onClose,
  onSubmit,
}: ConfirmIdentityModalProps) => {
  const { t } = useTranslation('settings');
  const { t: tAuth } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setPassword('');
    setCode('');
    setError('');
    setWarning(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password || !code.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    setWarning(null);
    try {
      await onSubmit(password, code.trim());
      setPassword('');
      setCode('');
    } catch (err) {
      setCode('');
      setError(authErrorText(tAuth, err, t('security.twoFactor.failed')));
      setWarning(lastAttemptWarning(tAuth, (err as { data?: unknown })?.data));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal opened={opened} onClose={close} title={title} size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm">{description}</Text>
          {error && <AuthErrorAlert message={error} warning={warning} />}
          <PasswordInput
            label={t('security.password.currentPassword')}
            value={password}
            onChange={e => setPassword(e.currentTarget.value)}
            autoComplete="current-password"
            autoFocus
            required
            disabled={submitting}
          />
          <TextInput
            label={t('security.twoFactor.confirmIdentity.codeLabel')}
            description={t('security.twoFactor.confirmIdentity.codeHelp')}
            value={code}
            onChange={e => setCode(e.currentTarget.value)}
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={32}
            required
            disabled={submitting}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={submitting}>
              {t('security.twoFactor.cancel')}
            </Button>
            <Button
              type="submit"
              color={danger ? 'red' : undefined}
              loading={submitting}
              disabled={!password || !code.trim()}
            >
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </ResponsiveModal>
  );
};

export default ConfirmIdentityModal;
