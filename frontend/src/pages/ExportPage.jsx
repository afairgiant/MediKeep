import logger from '../services/logger';

import React, { useState, useEffect } from 'react';
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
  Grid,
  Card,
  Badge,
  Divider,
  ActionIcon,
  Box,
  Collapse,
} from '@mantine/core';
import MedicalPageLoading from '../components/shared/MedicalPageLoading';
import {
  IconDownload,
  IconChartBar,
  IconSettings,
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconArchive,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { exportService } from '../services/exportService';

const ExportPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();

  // State management
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState({ formats: [], scopes: [] });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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
        setError(t('exportPage.errors.sessionExpired'));
      } else if (error.status === 400 && error.message?.includes('No active patient')) {
        // Handle missing active patient error
        setError(t('exportPage.errors.noActivePatient'));
      } else {
        setError(
          t('exportPage.errors.loadFailed', { message: error.message || t('labels.pleaseTryAgain', 'Please try again.') })
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
        setError(t('exportPage.errors.validationFailed', { errors: validation.errors.join(', ') }));
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
        t('exportPage.success.exportComplete', { format: exportConfig.format.toUpperCase() })
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      if (error.status === 400 && error.message?.includes('No active patient')) {
        setError(t('exportPage.errors.noActivePatient'));
      } else if (error.status === 422) {
        setError(t('exportPage.errors.invalidSettings'));
      } else if (error.status === 404) {
        setError(t('exportPage.errors.noDataFound'));
      } else if (error.data && error.data.detail) {
        // Use the detailed error message from the backend if available
        setError(t('exportPage.errors.exportFailed', { message: error.data.detail }));
      } else {
        setError(t('exportPage.errors.exportFailed', { message: error.message || t('labels.pleaseTryAgain', 'Please try again.') }));
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
        setError(t('exportPage.errors.noDataType'));
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
        t('exportPage.success.bulkExportComplete', { count: scopes.length })
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      if (error.status === 400 && error.message?.includes('No active patient')) {
        setError(t('exportPage.errors.noActivePatient'));
      } else if (error.status === 422) {
        setError(t('exportPage.errors.bulkInvalidSettings'));
      } else if (error.status === 404) {
        setError(t('exportPage.errors.bulkNoDataFound'));
      } else if (error.data && error.data.detail) {
        // Use the detailed error message from the backend if available
        setError(t('exportPage.errors.bulkExportFailed', { message: error.data.detail }));
      } else {
        setError(t('exportPage.errors.bulkExportFailed', { message: error.message || t('labels.pleaseTryAgain', 'Please try again.') }));
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

  const getRecordCount = scopeValue => {
    if (!summary || !summary.counts) return 0;
    return summary.counts[scopeValue] || 0;
  };

  // Translate scope labels from backend
  const translateScopeLabel = (scopeValue) => {
    // Try to get translation, fallback to original label if translation doesn't exist
    const translationKey = `exportPage.scopes.${scopeValue}`;
    return t(translationKey);
  };

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  if (summaryLoading) {
    return <MedicalPageLoading message={t('exportPage.loading', 'Loading export options...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('exportPage.title')} icon={t('exportPage.icon')} />

      <Stack gap="lg">
        <Text size="lg" c="dimmed">
          {t('exportPage.description')}
        </Text>

        {/* Alerts */}
        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title={t('labels.error', 'Error')}
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
                    {t('exportPage.buttons.refreshPage')}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => loadInitialData()}
                  >
                    {t('exportPage.buttons.retry')}
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
                    {t('exportPage.buttons.goToDashboard')}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => loadInitialData()}
                  >
                    {t('exportPage.buttons.retry')}
                  </Button>
                </Group>
              )}
            </Stack>
          </Alert>
        )}

        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            title={t('labels.success', 'Success')}
            color="green"
            variant="light"
            onClose={clearAlerts}
            withCloseButton
          >
            {success}
          </Alert>
        )}

        {/* Data Summary - Compact Version */}
        <Paper shadow="sm" p={{ base: 'md', sm: 'xl' }} radius="md" withBorder>
          <Group justify="space-between" mb={{ base: 'xs', sm: 'lg' }}>
            <Group gap="xs">
              <IconChartBar size={20} />
              <Title order={{ base: 3, sm: 2 }}>{t('exportPage.availableData.title')}</Title>
            </Group>
            <ActionIcon
              variant="subtle"
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              size={{ base: 'sm', sm: 'md' }}
            >
              {summaryExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
            </ActionIcon>
          </Group>
          
          {/* Mobile: Show compact inline summary */}
          <Box hiddenFrom="sm">
            <Group gap="xs" wrap="wrap">
              {formats.scopes
                ?.filter(scope => scope.value !== 'all')
                .slice(0, summaryExpanded ? undefined : 3)
                .map(scope => (
                  <Badge
                    key={scope.value}
                    size="lg"
                    variant="light"
                    leftSection={
                      <Text size="sm" fw={700}>
                        {getRecordCount(scope.value)}
                      </Text>
                    }
                  >
                    {translateScopeLabel(scope.value)}
                  </Badge>
                ))}
              {!summaryExpanded && formats.scopes?.filter(scope => scope.value !== 'all').length > 3 && (
                <Text size="xs" c="dimmed">
                  {t('exportPage.availableData.moreItems', { count: formats.scopes.filter(scope => scope.value !== 'all').length - 3 })}
                </Text>
              )}
            </Group>
          </Box>

          {/* Desktop: Show full grid or collapsed summary */}
          <Box visibleFrom="sm">
            <Collapse in={summaryExpanded}>
              <Grid>
                {formats.scopes
                  ?.filter(scope => scope.value !== 'all')
                  .map(scope => (
                    <Grid.Col
                      key={scope.value}
                      span={{ base: 12, xs: 6, sm: 4, md: 3 }}
                    >
                      <Card withBorder p="md" radius="md">
                        <Stack align="center" gap="xs">
                          <Text size="xl" fw={700} c="primary">
                            {getRecordCount(scope.value)}
                          </Text>
                          <Text size="sm" ta="center" c="dimmed">
                            {translateScopeLabel(scope.value)}
                          </Text>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
              </Grid>
            </Collapse>
            {!summaryExpanded && (
              <Group gap="sm" wrap="wrap">
                {formats.scopes
                  ?.filter(scope => scope.value !== 'all')
                  .map(scope => (
                    <Badge
                      key={scope.value}
                      size="lg"
                      variant="light"
                      leftSection={
                        <Text size="sm" fw={700}>
                          {getRecordCount(scope.value)}
                        </Text>
                      }
                    >
                      {translateScopeLabel(scope.value)}
                    </Badge>
                  ))}
              </Group>
            )}
          </Box>
        </Paper>

        {/* Export Mode Toggle */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>{t('exportPage.exportMode.title')}</Title>
          </Group>
          <Group gap="xs" mb="md">
            <Button
              variant={!bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(false)}
              leftSection={<IconDownload size={16} />}
            >
              {t('exportPage.exportMode.singleExport')}
            </Button>
            <Button
              variant={bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(true)}
              leftSection={<IconArchive size={16} />}
            >
              {t('exportPage.exportMode.bulkExport')}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {!bulkMode
              ? t('exportPage.exportMode.singleDescription')
              : t('exportPage.exportMode.bulkDescription')}
          </Text>
        </Paper>

        {/* Export Configuration */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>{t('exportPage.configuration.title')}</Title>
          </Group>

          <Stack gap="lg">
            {/* Format Selection */}
            <Select
              label={t('exportPage.configuration.format.label')}
              placeholder={t('exportPage.configuration.format.placeholder')}
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
                label={t('exportPage.configuration.dataToExport.label')}
                placeholder={t('exportPage.configuration.dataToExport.placeholder')}
                value={exportConfig.scope}
                onChange={value =>
                  setExportConfig(prev => ({ ...prev, scope: value }))
                }
                data={
                  formats.scopes
                    ?.filter(scope => scope.value !== 'all')
                    .map(scope => ({
                      value: scope.value,
                      label: `${translateScopeLabel(scope.value)} (${getRecordCount(scope.value)} records)`,
                    })) || []
                }
              />
            ) : (
              <Box>
                <Text fw={500} size="sm" mb="xs">
                  {t('exportPage.configuration.bulkSelection.label')}
                </Text>
                <Stack gap="xs">
                  {formats.scopes
                    ?.filter(scope => scope.value !== 'all')
                    .map(scope => (
                      <Checkbox
                        key={scope.value}
                        label={`${translateScopeLabel(scope.value)} (${getRecordCount(scope.value)})`}
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
                label={t('exportPage.configuration.dateRange.startDate')}
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
                label={t('exportPage.configuration.dateRange.endDate')}
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
                label={t('exportPage.configuration.includeFiles')}
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
                label={t('exportPage.configuration.includePatientInfo.label')}
                description={t('exportPage.configuration.includePatientInfo.description')}
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
                    ? t('exportPage.buttons.exporting')
                    : t('exportPage.buttons.exportAs', { scope: exportConfig.scope, format: exportConfig.format.toUpperCase() })}
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
                    ? t('exportPage.buttons.creatingZip')
                    : t('exportPage.buttons.bulkExport', { count: selectedScopes.length })}
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Export Information */}
        <Paper shadow="sm" p="xl" radius="md" withBorder variant="outline">
          <Group mb="lg">
            <IconInfoCircle size={20} />
            <Title order={2}>{t('exportPage.information.title')}</Title>
          </Group>
          <Stack gap="md">
            <Box>
              <Text fw={500} mb="xs">
                {t('exportPage.information.json.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('exportPage.information.json.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('exportPage.information.csv.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('exportPage.information.csv.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('exportPage.information.pdf.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('exportPage.information.pdf.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('exportPage.information.bulk.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('exportPage.information.bulk.description')}
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                {t('exportPage.information.fileAttachments.title')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('exportPage.information.fileAttachments.description')}
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
