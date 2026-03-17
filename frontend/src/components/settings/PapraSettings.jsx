import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  TextInput,
  PasswordInput,
  Switch,
  Button,
  Select,
  Group,
  Stack,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { testConnection, getOrganizations } from '../../services/api/papraApi.jsx';
import { PAPRA_SETTING_KEYS } from '../../constants/papraSettings.jsx';
import logger from '../../services/logger';

/**
 * PapraSettings Component
 *
 * Settings card for configuring the Papra document management integration.
 * Supports enabling/disabling the integration, URL and token configuration,
 * connection testing, and organization selection.
 *
 * Usage:
 *   <PapraSettings
 *     settings={settings}
 *     onSettingChange={(key, value) => handleChange(key, value)}
 *     onSave={() => handleSave()}
 *     loading={isSaving}
 *   />
 */
const PapraSettings = ({ settings, onSettingChange, onSave, loading }) => {
  const { t } = useTranslation('common');

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [organizations, setOrganizations] = useState([]);

  const papraEnabled = settings?.[PAPRA_SETTING_KEYS.enabled] ?? false;
  const papraUrl = settings?.[PAPRA_SETTING_KEYS.url] ?? '';
  const papraApiToken = settings?.[PAPRA_SETTING_KEYS.apiToken] ?? '';
  const papraOrganizationId = settings?.[PAPRA_SETTING_KEYS.organizationId] ?? '';
  const papraHasSavedToken = settings?.papra_has_token ?? false;
  const hasConnection = papraEnabled && papraUrl && papraHasSavedToken;
  const orgsLoadedRef = useRef(false);

  const mapOrganizations = (orgList) =>
    orgList
      .map((org) => ({
        value: String(org.id || org.Id || org.ID || org.organizationId || ''),
        label: org.name || org.Name || org.displayName || org.title || String(org.id || ''),
      }))
      .filter((org) => org.value);

  // Load organizations on mount if there's a saved connection
  useEffect(() => {
    if (!hasConnection || orgsLoadedRef.current) return;
    orgsLoadedRef.current = true;

    const loadOrgs = async () => {
      try {
        const orgsResult = await getOrganizations();
        const orgList = Array.isArray(orgsResult)
          ? orgsResult
          : (orgsResult?.organizations ?? []);
        setOrganizations(mapOrganizations(orgList));
      } catch (err) {
        logger.warn('papra_organizations_load_failed', {
          component: 'PapraSettings',
          error: err.message,
        });
      }
    };

    loadOrgs();
  }, [hasConnection]);

  const handleTestConnection = async () => {
    if (!papraUrl || (!papraApiToken && !papraHasSavedToken)) {
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);
    setConnectionMessage('');
    setOrganizations([]);

    try {
      // Send token if available in form, otherwise backend uses saved credentials
      const result = await testConnection({
        papra_url: papraUrl,
        papra_api_token: papraApiToken || '',
      });

      if (result && result.status === 'success') {
        setConnectionStatus('success');
        setConnectionMessage(t('settings.papra.connectionSuccess'));

        logger.info('papra_connection_test_success', {
          component: 'PapraSettings',
        });

        const orgList = result.organizations || [];
        logger.info('papra_organizations_received', {
          component: 'PapraSettings',
          count: orgList.length,
        });
        setOrganizations(mapOrganizations(orgList));
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result?.message || t('settings.papra.connectionFailed'));

        logger.warn('papra_connection_test_failed', {
          component: 'PapraSettings',
          message: result?.message,
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error.message || t('settings.papra.connectionFailed'));

      logger.error('papra_connection_test_error', {
        component: 'PapraSettings',
        error: error.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const canTestConnection = Boolean(papraUrl && (papraApiToken || papraHasSavedToken));

  return (
    <div style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        <Switch
          label={t('settings.papra.enabled')}
          checked={papraEnabled}
          onChange={(event) =>
            onSettingChange(PAPRA_SETTING_KEYS.enabled, event.currentTarget.checked)
          }
        />

        <TextInput
          label={t('settings.papra.url')}
          placeholder={t('settings.papra.urlPlaceholder')}
          value={papraUrl}
          onChange={(event) =>
            onSettingChange(PAPRA_SETTING_KEYS.url, event.currentTarget.value)
          }
          disabled={!papraEnabled}
        />

        <PasswordInput
          label={t('settings.papra.apiToken')}
          placeholder={papraHasSavedToken && !papraApiToken
            ? 'Token saved - leave blank to keep current'
            : t('settings.papra.apiTokenPlaceholder')}
          value={papraApiToken}
          onChange={(event) =>
            onSettingChange(PAPRA_SETTING_KEYS.apiToken, event.currentTarget.value)
          }
          disabled={!papraEnabled}
        />

        {(hasConnection || connectionStatus === 'success') && (
          <Select
            label={t('settings.papra.organization')}
            placeholder={t('settings.papra.organizationPlaceholder')}
            data={organizations}
            value={papraOrganizationId || null}
            onChange={(value) =>
              onSettingChange(PAPRA_SETTING_KEYS.organizationId, value ?? '')
            }
            disabled={!papraEnabled}
          />
        )}

        {connectionStatus === 'success' && (
          <Alert color="green" variant="light">
            {connectionMessage}
          </Alert>
        )}

        {connectionStatus === 'error' && (
          <Alert color="red" variant="light">
            {connectionMessage}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={handleTestConnection}
            loading={testingConnection}
            disabled={!papraEnabled || !canTestConnection}
          >
            {t('settings.papra.testConnection')}
          </Button>

          <Button onClick={onSave} loading={loading} disabled={!papraEnabled}>
            {t('common.save', 'Save')}
          </Button>
        </Group>
      </Stack>
    </div>
  );
};

PapraSettings.propTypes = {
  /** Current settings object keyed by backend setting names */
  settings: PropTypes.object.isRequired,
  /** Callback invoked when a single setting value changes */
  onSettingChange: PropTypes.func.isRequired,
  /** Callback invoked when the user requests a save */
  onSave: PropTypes.func.isRequired,
  /** Whether a save operation is in progress */
  loading: PropTypes.bool,
};

PapraSettings.defaultProps = {
  loading: false,
};

export default PapraSettings;
