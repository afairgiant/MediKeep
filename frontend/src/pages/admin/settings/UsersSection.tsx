import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconPlugConnected,
  IconX,
} from '@tabler/icons-react';
import { authService } from '../../../services/auth/simpleAuthService';
import { capitalizeFirst } from '../../../utils/dateFormatUtils';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import type { SectionProps } from './useAdminSettings';

interface FlagProps {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onColor: string;
}

const Flag = ({ label, on, onLabel, offLabel, onColor }: FlagProps) => (
  <Group gap={6} wrap="nowrap">
    <Text size="sm" c="dimmed">
      {label}
    </Text>
    <Badge variant="light" size="sm" color={on ? onColor : 'gray'}>
      {on ? onLabel : offLabel}
    </Badge>
  </Group>
);

const UsersSection = ({ state }: SectionProps) => {
  const { t } = useTranslation(['admin', 'shared']);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { settings, draft, sso } = state;
  if (!settings || !draft) return null;

  const key = 'allow_user_registration';
  const enabled = t('shared:labels.enabled', 'Enabled');
  const disabled = t('shared:labels.disabled', 'Disabled');
  const registrationDirty = state.dirtyKeys.includes(key);
  const sealedPreview =
    !!sso.sso_only && draft[key] === false && registrationDirty;

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await authService.testSSOConnection());
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stack gap="md">
      <SettingsGroup title={t('settings.groups.accounts', 'Accounts')}>
        <SettingRow
          label={t(
            'settings.userManagement.allowRegistration',
            'Allow new accounts from the login page'
          )}
          description={t(
            'settings.userManagement.allowRegistrationDesc',
            'When off, only an admin can create accounts.'
          )}
          state={settings[key]}
          dirty={registrationDirty}
          pendingReset={state.resets.has(key)}
          onReset={() => state.reset(key)}
          formatValue={value => (value ? enabled : disabled)}
          control={
            <Switch
              size="md"
              checked={draft[key] === true}
              onChange={event =>
                state.setValue(key, event.currentTarget.checked)
              }
              aria-label={t(
                'settings.userManagement.allowRegistration',
                'Allow new accounts from the login page'
              )}
            />
          }
        >
          {sealedPreview && (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertCircle size={16} />}
            >
              {t(
                'settings.userManagement.sealedPreview',
                'SSO-only mode is on, so with this off nobody can create their own account. An admin will have to create every account.'
              )}
            </Alert>
          )}
          {/* Server sends a code; the copy is ours, so it translates. */}
          {state.warnings.map(warning => (
            <Alert
              key={warning.code}
              color="yellow"
              variant="light"
              icon={<IconAlertCircle size={16} />}
              withCloseButton
              onClose={() => state.dismissWarning(warning.code)}
            >
              {t(`settings.warnings.${warning.code}`, warning.message)}
            </Alert>
          ))}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t('settings.sso.title', 'Single Sign-On (SSO)')}>
        {sso.enabled ? (
          <SettingRow
            label={
              capitalizeFirst(sso.provider_type ?? '') ||
              t('shared:labels.unknown', 'Unknown')
            }
            description={
              <Stack gap={6} mt={4}>
                <Group gap="md">
                  <Flag
                    label={t(
                      'settings.sso.ssoRegistration',
                      'SSO Registration'
                    )}
                    on={!!sso.registration_enabled}
                    onLabel={t('health.sso.allowed', 'Allowed')}
                    offLabel={t('health.sso.blocked', 'Blocked')}
                    onColor="green"
                  />
                  <Flag
                    label={t('settings.sso.ssoOnly', 'SSO-Only Mode')}
                    on={!!sso.sso_only}
                    onLabel={enabled}
                    offLabel={disabled}
                    onColor="orange"
                  />
                  <Flag
                    label={t(
                      'settings.sso.autoRedirect',
                      'Auto-Redirect to Provider'
                    )}
                    on={!!sso.auto_redirect}
                    onLabel={enabled}
                    offLabel={disabled}
                    onColor="orange"
                  />
                </Group>
                <span>
                  {t(
                    'settings.sso.envOnly',
                    'These are set by environment variable and cannot be changed here.'
                  )}
                </span>
              </Stack>
            }
            control={
              <Button
                variant="light"
                leftSection={<IconPlugConnected size={16} />}
                onClick={testConnection}
                loading={testing}
              >
                {t('settings.sso.testSsoConnection', 'Test SSO Connection')}
              </Button>
            }
          >
            {testResult && (
              <Alert
                color={testResult.success ? 'green' : 'red'}
                variant="light"
                icon={
                  testResult.success ? (
                    <IconCheck size={16} />
                  ) : (
                    <IconX size={16} />
                  )
                }
              >
                {testResult.message}
              </Alert>
            )}
          </SettingRow>
        ) : (
          <SettingRow
            label={t('settings.sso.off', 'Single sign-on is off')}
            description={
              <Anchor
                component={Link}
                to="/admin/settings/deployment"
                size="sm"
              >
                {t('settings.sso.howToEnable', 'How to turn it on')}
              </Anchor>
            }
            control={null}
          />
        )}
      </SettingsGroup>
    </Stack>
  );
};

export default UsersSection;
