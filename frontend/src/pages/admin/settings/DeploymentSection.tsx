import { useTranslation } from 'react-i18next';
import { Code, List, Stack, Text } from '@mantine/core';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import type { SectionProps } from './useAdminSettings';

const DeploymentSection = ({ state }: SectionProps) => {
  const { t } = useTranslation('admin');

  const labels: Record<string, { label: string; description: string }> = {
    SSO_ONLY_MODE: {
      label: t('settings.sso.ssoOnly', 'SSO-Only Mode'),
      description: t(
        'settings.deployment.ssoOnlyDesc',
        'Kept out of the app so a broken identity provider can always be undone by editing compose.'
      ),
    },
    SSO_AUTO_REDIRECT: {
      label: t('settings.sso.autoRedirect', 'Auto-Redirect to Provider'),
      description: t(
        'settings.deployment.autoRedirectDesc',
        'Kept out of the app for the same reason as SSO-only mode.'
      ),
    },
    ALLOW_PRIVATE_INTEGRATION_URLS: {
      label: t(
        'settings.deployment.privateUrls',
        'Private integration addresses'
      ),
      description: t(
        'settings.deployment.privateUrlsDesc',
        'Whether Paperless and Papra may use LAN, loopback or Docker addresses.'
      ),
    },
    LOG_LEVEL: {
      label: t('settings.deployment.logLevel', 'Log level'),
      description: t(
        'settings.deployment.logLevelDesc',
        'How much detail the server writes to its logs.'
      ),
    },
  };

  return (
    <Stack gap="md">
      <SettingsGroup
        title={t(
          'settings.groups.deployment',
          'Change these in docker-compose.yml or .env, then restart'
        )}
      >
        {state.deployment.map(item => (
          <SettingRow
            key={item.name}
            label={labels[item.name]?.label ?? item.name}
            description={labels[item.name]?.description}
            control={
              <Code>
                {item.name}={String(item.value)}
              </Code>
            }
          />
        ))}
      </SettingsGroup>

      {!state.sso.enabled && (
        <SettingsGroup title={t('settings.sso.title', 'Single Sign-On (SSO)')}>
          <div className="setting-row">
            <Stack gap="xs" className="setting-row-extra">
              <Text size="sm">
                {t(
                  'settings.sso.ssoDisabledInfo',
                  'SSO is currently disabled. To enable SSO, configure the following environment variables and restart the application:'
                )}
              </Text>
              {/* eslint-disable i18next/no-literal-string -- environment variable names */}
              <List size="sm" spacing={4}>
                <List.Item>
                  <Code>SSO_ENABLED=true</Code>
                </List.Item>
                <List.Item>
                  <Code>SSO_PROVIDER_TYPE</Code> (google, github, or oidc)
                </List.Item>
                <List.Item>
                  <Code>SSO_CLIENT_ID</Code>
                </List.Item>
                <List.Item>
                  <Code>SSO_CLIENT_SECRET</Code>
                </List.Item>
                <List.Item>
                  <Code>SSO_ISSUER_URL</Code> (for OIDC provider)
                </List.Item>
                <List.Item>
                  <Code>SSO_REDIRECT_URI</Code>
                </List.Item>
              </List>
              {/* eslint-enable i18next/no-literal-string */}
            </Stack>
          </div>
        </SettingsGroup>
      )}
    </Stack>
  );
};

export default DeploymentSection;
