import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Anchor,
  Button,
  Group,
  PinInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { authErrorCopy } from '../../utils/authErrorCopy';
import { TOTP_LENGTH } from '../../constants/twoFactor';
import type {
  TwoFactorLoginResult,
  TwoFactorMethod,
} from '../../contexts/AuthContext';

interface TwoFactorChallengeProps {
  methods: TwoFactorMethod[];
  onVerify: (
    code: string,
    method: TwoFactorMethod
  ) => Promise<TwoFactorLoginResult>;
  /** The ticket is gone; the user must enter their password again. */
  onExpired: () => void;
  onCancel: () => void;
}

/** Second step of a password sign-in: an authenticator code or a backup code. */
const TwoFactorChallenge = ({
  methods,
  onVerify,
  onExpired,
  onCancel,
}: TwoFactorChallengeProps) => {
  const { t } = useTranslation('auth');
  const [method, setMethod] = useState<TwoFactorMethod>(
    methods.includes('totp') ? 'totp' : 'backup_code'
  );
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code: string | null;
  } | null>(null);

  const canSwitch = methods.includes('totp') && methods.includes('backup_code');
  const ready =
    method === 'totp'
      ? code.length === TOTP_LENGTH
      : code.replace(/[\s-]/g, '').length > 0;

  const switchMethod = (next: TwoFactorMethod) => {
    setMethod(next);
    setCode('');
    setError(null);
  };

  const submit = async (value: string) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onVerify(value, method);
      if (result.success) return;
      if (result.errorCode === 'mfa_ticket_invalid') {
        onExpired();
        return;
      }
      setCode('');
      // The server cannot read the authenticator secret, so only a backup code works
      if (result.errorCode === 'mfa_secret_unavailable') {
        setMethod('backup_code');
      }
      // Without a code the message is a raw network or browser error
      setError({
        message:
          (result.errorCode && result.error) || t('login.twoFactor.failed'),
        code: result.errorCode || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ready) void submit(code);
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby="two-factor-title">
      <Stack gap="md">
        <div>
          <Text id="two-factor-title" fw={600} size="lg">
            {t('login.twoFactor.title')}
          </Text>
          <Text size="sm" c="dimmed" id="two-factor-prompt">
            {method === 'totp'
              ? t('login.twoFactor.totpPrompt')
              : t('login.twoFactor.backupPrompt')}
          </Text>
        </div>

        {error && (
          <Alert color="red" role="alert" data-testid="two-factor-error">
            {authErrorCopy(t, error.code, error.message)}
          </Alert>
        )}

        {method === 'totp' ? (
          <Group justify="center">
            <PinInput
              length={TOTP_LENGTH}
              type="number"
              oneTimeCode
              autoFocus
              value={code}
              onChange={setCode}
              onComplete={value => void submit(value)}
              disabled={submitting}
              aria-label={t('login.twoFactor.codeLabel')}
              aria-describedby="two-factor-prompt"
            />
          </Group>
        ) : (
          <TextInput
            label={t('login.twoFactor.backupCodeLabel')}
            value={code}
            onChange={e => setCode(e.currentTarget.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            disabled={submitting}
            maxLength={32}
            aria-describedby="two-factor-prompt"
          />
        )}

        <Button type="submit" fullWidth loading={submitting} disabled={!ready}>
          {t('login.twoFactor.verify')}
        </Button>

        <Group justify="space-between">
          {canSwitch ? (
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() =>
                switchMethod(method === 'totp' ? 'backup_code' : 'totp')
              }
              disabled={submitting}
            >
              {method === 'totp'
                ? t('login.twoFactor.useBackupCode')
                : t('login.twoFactor.useAuthenticator')}
            </Anchor>
          ) : (
            <span />
          )}
          <Anchor
            component="button"
            type="button"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            {t('login.twoFactor.back')}
          </Anchor>
        </Group>
      </Stack>
    </form>
  );
};

export default TwoFactorChallenge;
