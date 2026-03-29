import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Select, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import IntegrationSettingsCard from './IntegrationSettingsCard';
import { testConnection, getOrganizations } from '../../services/api/papraApi.jsx';
import { PAPRA_SETTING_KEYS } from '../../constants/papraSettings.jsx';
import logger from '../../services/logger';

/**
 * PapraSettings Component
 *
 * Manages Papra integration settings using the shared
 * IntegrationSettingsCard template. Adds organization selector
 * as a Papra-specific extra after successful connection.
 */
const PapraSettings = ({ settings, onSettingChange, loading }) => {
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
  const isVerified = settings?.papra_connection_verified ?? false;
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
    if (!papraUrl || (!papraApiToken && !papraHasSavedToken)) return;

    setTestingConnection(true);
    setConnectionStatus(null);
    setConnectionMessage('');
    setOrganizations([]);

    try {
      const result = await testConnection({
        papra_url: papraUrl,
        papra_api_token: papraApiToken || '',
      });

      if (result && result.status === 'success') {
        setConnectionStatus('success');
        setConnectionMessage(t('settings.papra.connectionSuccess'));
        // Optimistically mark verified so StoragePreferencesCard unlocks immediately
        onSettingChange('papra_connection_verified', true);
        logger.info('papra_connection_test_success', { component: 'PapraSettings' });

        const orgList = result.organizations || [];
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

  const handleEnabledChange = (checked) => {
    onSettingChange(PAPRA_SETTING_KEYS.enabled, checked);
    // If disabling and currently the active backend, fall back to local
    if (!checked && settings?.default_storage_backend === 'papra') {
      onSettingChange('default_storage_backend', 'local');
    }
  };

  return (
    <IntegrationSettingsCard
      name="Papra"
      enabled={papraEnabled}
      onEnabledChange={handleEnabledChange}
      url={papraUrl}
      onUrlChange={(value) => onSettingChange(PAPRA_SETTING_KEYS.url, value)}
      urlPlaceholder={t('settings.papra.urlPlaceholder')}
      token={papraApiToken}
      onTokenChange={(value) => onSettingChange(PAPRA_SETTING_KEYS.apiToken, value)}
      tokenPlaceholder={t('settings.papra.apiTokenPlaceholder')}
      hasTokenSaved={papraHasSavedToken}
      onTestConnection={handleTestConnection}
      testingConnection={testingConnection}
      connectionStatus={connectionStatus}
      connectionMessage={connectionMessage}
      loading={loading}
      renderExtras={({ connectionStatus: status }) =>
        (hasConnection || status === 'success' || isVerified) && (
          <Select
            label={t('settings.papra.organization')}
            placeholder={t('settings.papra.organizationPlaceholder')}
            data={organizations}
            value={papraOrganizationId || null}
            onChange={(value) => onSettingChange(PAPRA_SETTING_KEYS.organizationId, value ?? '')}
            disabled={!papraEnabled}
          />
        )
      }
    />
  );
};

PapraSettings.propTypes = {
  settings: PropTypes.object.isRequired,
  onSettingChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

PapraSettings.defaultProps = {
  loading: false,
};

export default PapraSettings;
