import logger from '../services/logger';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import {
  Container,
  Paper,
  Stack,
  Text,
  Title,
  Button,
  Group,
  Select,
  TextInput,
  Checkbox,
  Alert,
  Loader,
  Divider,
  Box,
  Input,
} from '@mantine/core';
import MedicalPageLoading from '../components/shared/MedicalPageLoading';
import {
  IconDownload,
  IconSettings,
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconArchive,
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { exportService } from '../services/exportService';

const ExportPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['reports', 'common', 'shared']);
  const { unitSystem } = useUserPreferences();

  // State management
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState({ formats: [], scopes: [] });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Export configuration
  const [exportConfig, setExportConfig] = useState({
    format: 'json',
    scope: 'patient',
    startDate: '',
    endDate: '',
    includeFiles: false,
    includePatientInfo: true,
  });

  // Bulk export state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState(['all']);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; loadInitialData is stable in component scope
  }, []);

  const loadInitialData = async (retryCount = 0) => {
    try {
      setSummaryLoading(true);
      setError(null); // Clear any previous errors

      const [summaryData, formatsData] = await Promise.all([
        exportService.getSummary(),
        exportService.getSupportedFormats(),
      ]);

      setSummary(summaryData.data);
      setFormats(formatsData);
    } catch (error) {
      // Check if this is an authentication error
      if (error.status === 401) {
        if (retryCount < 1) {
          // Try once more after a short delay in case of temporary token issues
          setTimeout(() => loadInitialData(retryCount + 1), 1000);
          return;
        }
        setError(t('export.errors.sessionExpired'));
      } else if (
        error.status === 400 &&
        error.message?.includes('No active patient')
      ) {
        // Handle missing active patient error
        setError(t('export.errors.noActivePatient'));
      } else {
        setError(
          t('export.errors.loadFailed', {
            message:
              error.message ||
              t('common:labels.pleaseTryAgain', 'Please try again.'),
          })
        );
      }
      logger.error('Export data loading failed:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSingleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate parameters
      const validation = exportService.validateExportParams(exportConfig);
      if (!validation.isValid) {
        setError(
          t('export.errors.validationFailed', {
            errors: validation.errors.join(', '),
          })
        );
        return;
      }

      const params = {
        format: exportConfig.format,
        scope: exportConfig.scope,
        include_files: exportConfig.includeFiles.toString(),
        include_patient_info: exportConfig.includePatientInfo.toString(),
        unit_system: unitSystem,
      };

      if (exportConfig.startDate) {
        params.start_date = exportConfig.startDate;
      }
      if (exportConfig.endDate) {
        params.end_date = exportConfig.endDate;
      }

      await exportService.downloadExport(params);
      setSuccess(
        t('export.success.exportComplete', {
          format: exportConfig.format.toUpperCase(),
        })
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      if (
        error.status === 400 &&
        error.message?.includes('No active patient')
      ) {
        setError(t('export.errors.noActivePatient'));
      } else if (error.status === 422) {
        setError(t('export.errors.invalidSettings'));
      } else if (error.status === 404) {
        setError(t('export.errors.noDataFound'));
      } else if (error.data && error.data.detail) {
        // Use the detailed error message from the backend if available
        setError(
          t('export.errors.exportFailed', { message: error.data.detail })
        );
      } else {
        setError(
          t('export.errors.exportFailed', {
            message:
              error.message ||
              t('common:labels.pleaseTryAgain', 'Please try again.'),
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = async () => {
    try {
      setLoading(true);
      setError(null);

      const scopes = selectedScopes.filter(scope => scope !== 'all');
      if (scopes.length === 0) {
        setError(t('export.errors.noDataType'));
        return;
      }

      const requestData = {
        scopes,
        format: exportConfig.format,
        start_date: exportConfig.startDate || undefined,
        end_date: exportConfig.endDate || undefined,
        include_patient_info: exportConfig.includePatientInfo,
        unit_system: unitSystem,
      };

      await exportService.downloadBulkExport(requestData);
      setSuccess(
        t('export.success.bulkExportComplete', { count: scopes.length })
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      if (
        error.status === 400 &&
        error.message?.includes('No active patient')
      ) {
        setError(t('export.errors.noActivePatient'));
      } else if (error.status === 422) {
        setError(t('export.errors.bulkInvalidSettings'));
      } else if (error.status === 404) {
        setError(t('export.errors.bulkNoDataFound'));
      } else if (error.data && error.data.detail) {
        // Use the detailed error message from the backend if available
        setError(
          t('export.errors.bulkExportFailed', { message: error.data.detail })
        );
      } else {
        setError(
          t('export.errors.bulkExportFailed', {
            message:
              error.message ||
              t('common:labels.pleaseTryAgain', 'Please try again.'),
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = scope => {
    if (scope === 'all') {
      setSelectedScopes(['all']);
      setExportConfig(prev => ({ ...prev, scope: 'all' }));
    } else {
      const newScopes = selectedScopes.includes(scope)
        ? selectedScopes.filter(s => s !== scope && s !== 'all')
        : [...selectedScopes.filter(s => s !== 'all'), scope];

      setSelectedScopes(newScopes);
      if (newScopes.length === 1) {
        setExportConfig(prev => ({ ...prev, scope: newScopes[0] }));
      }
    }
  };

  const handleSelectAllScopes = () => {
    const allScopeValues = (formats.scopes || [])
      .filter(scope => scope.value !== 'all')
      .map(scope => scope.value);
    setSelectedScopes(allScopeValues);
  };

  const handleClearScopeSelections = () => {
    setSelectedScopes([]);
  };

  const getRecordCount = scopeValue => {
    if (!summary || !summary.counts) return 0;
    return summary.counts[scopeValue] || 0;
  };

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  if (summaryLoading) {
    return (
      <MedicalPageLoading
        message={t('export.loading', 'Loading export options...')}
      />
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('export.title')} icon={t('export.icon')} />

      <Stack gap="lg">
        <Text size="lg" c="dimmed">
          {t('export.description')}
        </Text>

        {/* Alerts */}
        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title={t('shared:labels.error', 'Error')}
            color="red"
            variant="light"
            onClose={clearAlerts}
            withCloseButton
          >
            <Stack gap="xs">
              <Text>{error}</Text>
              {error.includes('session has expired') && (
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => window.location.reload()}
                  >
                    {t('export.buttons.refreshPage')}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => loadInitialData()}
                  >
                    {t('shared:labels.retry')}
                  </Button>
                </Group>
              )}
              {error.includes('No patient profile is currently selected') && (
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => navigate('/dashboard')}
                  >
                    {t('export.buttons.goToDashboard')}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => loadInitialData()}
                  >
                    {t('shared:labels.retry')}
                  </Button>
                </Group>
              )}
            </Stack>
          </Alert>
        )}

        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            title={t('shared:labels.success', 'Success')}
            color="green"
            variant="light"
            onClose={clearAlerts}
            withCloseButton
          >
            {success}
          </Alert>
        )}

        {/* Export Mode Toggle */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>{t('export.exportMode.title')}</Title>
          </Group>
          <Group gap="xs" mb="md">
            <Button
              variant={!bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(false)}
              leftSection={<IconDownload size={16} />}
            >
              {t('export.exportMode.singleExport')}
            </Button>
            <Button
              variant={bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(true)}
              leftSection={<IconArchive size={16} />}
            >
              {t('export.exportMode.bulkExport')}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {!bulkMode
              ? t('export.exportMode.singleDescription')
              : t('export.exportMode.bulkDescription')}
          </Text>
        </Paper>

        {/* Export Configuration */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>{t('export.configuration.title')}</Title>
          </Group>

          <Stack gap="lg">
            {/* Format Selection */}
            <Select
              label={t('export.configuration.format.label')}
              placeholder={t('export.configuration.format.placeholder')}
              value={exportConfig.format}
              onChange={value =>
                setExportConfig(prev => ({ ...prev, format: value }))
              }
              data={
                formats.formats?.map(format => ({
                  value: format.value,
                  label: `${format.label} - ${format.description}`,
                })) || []
              }
            />

            {/* Scope Selection */}
            {!bulkMode ? (
              <Select
                label={t('export.configuration.dataToExport.label')}
                placeholder={t('export.configuration.dataToExport.placeholder')}
                value={exportConfig.scope}
                onChange={value =>
                  setExportConfig(prev => ({ ...prev, scope: value }))
                }
                data={
                  formats.scopes
                    ?.filter(scope => scope.value !== 'all')
                    .map(scope => ({
                      value: scope.value,
                      label: `${scope.label} (${getRecordCount(scope.value)} records)`,
                    })) || []
                }
              />
            ) : (
              <Box data-testid="bulk-scope-selection">
                <Input.Label
                  mb="xs"
                  style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                >
                  {t('export.configuration.bulkSelection.label')}
                </Input.Label>
                <Group gap="xs" mb="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={handleSelectAllScopes}
                    disabled={
                      !formats.scopes?.length ||
                      formats.scopes
                        .filter(scope => scope.value !== 'all')
                        .every(scope => selectedScopes.includes(scope.value))
                    }
                  >
                    {t('builder.buttons.selectAll')}
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={handleClearScopeSelections}
                    disabled={
                      selectedScopes.filter(scope => scope !== 'all')
                        .length === 0
                    }
                  >
                    {t('builder.buttons.clearSelections')}
                  </Button>
                </Group>
                <Stack gap="xs">
                  {formats.scopes
                    ?.filter(scope => scope.value !== 'all')
                    .map(scope => (
                      <Checkbox
                        key={scope.value}
                        label={`${scope.label} (${getRecordCount(scope.value)})`}
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                      />
                    ))}
                </Stack>
              </Box>
            )}

            {/* Date Range */}
            <Group grow>
              <TextInput
                type="date"
                label={t('export.configuration.dateRange.startDate')}
                value={exportConfig.startDate}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
              />
              <TextInput
                type="date"
                label={t('export.configuration.dateRange.endDate')}
                value={exportConfig.endDate}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
              />
            </Group>

            {/* Include Files Option (PDF only) */}
            {exportConfig.format === 'pdf' && !bulkMode && (
              <Checkbox
                label={t('export.configuration.includeFiles')}
                checked={exportConfig.includeFiles}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    includeFiles: e.target.checked,
                  }))
                }
              />
            )}

            {/* Include Patient Info Option (PDF only) */}
            {exportConfig.format === 'pdf' && !bulkMode && (
              <Checkbox
                label={t('export.configuration.includePatientInfo.label')}
                description={t(
                  'export.configuration.includePatientInfo.description'
                )}
                checked={exportConfig.includePatientInfo}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    includePatientInfo: e.target.checked,
                  }))
                }
              />
            )}

            {/* Export Actions */}
            <Group justify="center" mt="xl">
              {!bulkMode ? (
                <Button
                  size="lg"
                  leftSection={
                    loading ? <Loader size="sm" /> : <IconDownload size={20} />
                  }
                  onClick={handleSingleExport}
                  disabled={loading}
                  loading={loading}
                >
                  {loading
                    ? t('export.buttons.exporting')
                    : t('export.buttons.exportAs', {
                        scope: exportConfig.scope,
                        format: exportConfig.format.toUpperCase(),
                      })}
                </Button>
              ) : (
                <Button
                  size="lg"
                  leftSection={
                    loading ? <Loader size="sm" /> : <IconArchive size={20} />
                  }
                  onClick={handleBulkExport}
                  disabled={loading || selectedScopes.length === 0}
                  loading={loading}
                >
                  {loading
                    ? t('export.buttons.creatingZip')
                    : t('export.buttons.bulkExport', {
                        count: selectedScopes.length,
                      })}
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Export Information */}
        <Paper shadow="sm" p="xl" radius="md" withBorder variant="outline">
          <Group mb="lg">
            <IconInfoCircle size={20} />
            <Title order={2}>{t('export.information.title')}</Title>
          </Group>
          <Stack gap="md">
            <Box>
              <Text fw={500} mb="xs">
                {t('export.information.json.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('export.information.json.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('export.information.csv.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('export.information.csv.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('export.information.pdf.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('export.information.pdf.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('export.information.bulk.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('export.information.bulk.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('export.information.fileAttachments.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('export.information.fileAttachments.description')}
              </Text>
            </Box>
            <Divider />
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
};

export default ExportPage;
