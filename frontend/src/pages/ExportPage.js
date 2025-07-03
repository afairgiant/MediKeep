import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Center,
} from '@mantine/core';
import {
  IconDownload,
  IconFileExport,
  IconChartBar,
  IconSettings,
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconArchive,
  IconLock,
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { exportService } from '../services/exportService';

const ExportPage = () => {
  const navigate = useNavigate();

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
  }, []);

  const loadInitialData = async () => {
    try {
      setSummaryLoading(true);
      const [summaryData, formatsData] = await Promise.all([
        exportService.getSummary(),
        exportService.getSupportedFormats(),
      ]);

      setSummary(summaryData.data);
      setFormats(formatsData);
    } catch (error) {
      setError('Failed to load export data. Please try again.');
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
        setError(validation.errors.join(', '));
        return;
      }

      const params = {
        format: exportConfig.format,
        scope: exportConfig.scope,
        include_files: exportConfig.includeFiles.toString(),
        include_patient_info: exportConfig.includePatientInfo.toString(),
      };

      if (exportConfig.startDate) {
        params.start_date = exportConfig.startDate;
      }
      if (exportConfig.endDate) {
        params.end_date = exportConfig.endDate;
      }

      await exportService.downloadExport(params);
      setSuccess(
        `Export completed successfully! Your ${exportConfig.format.toUpperCase()} file has been downloaded.`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(`Export failed: ${error.message}`);
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
        setError('Please select at least one data type for bulk export');
        return;
      }

      const requestData = {
        scopes,
        format: exportConfig.format,
        start_date: exportConfig.startDate || undefined,
        end_date: exportConfig.endDate || undefined,
        include_patient_info: exportConfig.includePatientInfo,
      };

      await exportService.downloadBulkExport(requestData);
      setSuccess(
        `Bulk export completed successfully! Your ZIP file containing ${scopes.length} data types has been downloaded.`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(`Bulk export failed: ${error.message}`);
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

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  if (summaryLoading) {
    return (
      <Container size="xl" py="xl">
        <Center style={{ minHeight: '400px' }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg" c="dimmed">
              Loading export options...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <PageHeader
        title="Export Medical Records"
        icon={<IconFileExport size={24} />}
        backButtonText="← Back to Dashboard"
        backButtonPath="/dashboard"
        variant="medical"
      />

      <Stack gap="xl" mt="xl">
        <Text size="lg" c="dimmed">
          Download your medical data in various formats for backup or sharing
          with healthcare providers
        </Text>

        {/* Alerts */}
        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Error"
            color="red"
            variant="light"
            onClose={clearAlerts}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            title="Success"
            color="green"
            variant="light"
            onClose={clearAlerts}
            withCloseButton
          >
            {success}
          </Alert>
        )}

        {/* Data Summary */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconChartBar size={20} />
            <Title order={2}>Available Data Summary</Title>
          </Group>
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
                        {scope.label}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
          </Grid>
        </Paper>

        {/* Export Mode Toggle */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>Export Mode</Title>
          </Group>
          <Group gap="xs" mb="md">
            <Button
              variant={!bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(false)}
              leftSection={<IconDownload size={16} />}
            >
              Single Export
            </Button>
            <Button
              variant={bulkMode ? 'filled' : 'outline'}
              onClick={() => setBulkMode(true)}
              leftSection={<IconArchive size={16} />}
            >
              Bulk Export
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {!bulkMode
              ? 'Export a single data type in your chosen format'
              : 'Export multiple data types together in a ZIP file'}
          </Text>
        </Paper>

        {/* Export Configuration */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group mb="lg">
            <IconSettings size={20} />
            <Title order={2}>Export Configuration</Title>
          </Group>

          <Stack gap="lg">
            {/* Format Selection */}
            <Select
              label="Export Format"
              placeholder="Select format"
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
                label="Data to Export"
                placeholder="Select data type"
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
              <Box>
                <Text fw={500} size="sm" mb="xs">
                  Select Data Types for Bulk Export
                </Text>
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
                label="Start Date (Optional)"
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
                label="End Date (Optional)"
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
                label="Include file attachments (creates ZIP file)"
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
                label="Include patient information (name, demographics, etc.)"
                description="Uncheck to exclude personal patient details for privacy"
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
                    ? 'Exporting...'
                    : `Export ${exportConfig.scope} as ${exportConfig.format.toUpperCase()}`}
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
                    ? 'Creating ZIP...'
                    : `Bulk Export ${selectedScopes.length} types as ZIP`}
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Export Information */}
        <Paper shadow="sm" p="xl" radius="md" withBorder variant="outline">
          <Group mb="lg">
            <IconInfoCircle size={20} />
            <Title order={2}>Export Information</Title>
          </Group>
          <Stack gap="md">
            <Box>
              <Text fw={500} mb="xs">
                JSON Format:
              </Text>
              <Text size="sm" c="dimmed">
                Machine-readable structured data format, ideal for importing
                into other systems or applications.
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                CSV Format:
              </Text>
              <Text size="sm" c="dimmed">
                Comma-separated values suitable for spreadsheet applications
                like Excel or Google Sheets.
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                PDF Format:
              </Text>
              <Text size="sm" c="dimmed">
                Human-readable document format perfect for printing or sharing
                with healthcare providers.
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                Bulk Export:
              </Text>
              <Text size="sm" c="dimmed">
                Creates a ZIP file containing multiple data types in your chosen
                format for comprehensive data backup.
              </Text>
            </Box>
            <Box>
              <Text fw={500} mb="xs">
                File Attachments:
              </Text>
              <Text size="sm" c="dimmed">
                When available for PDF exports, lab result files can be included
                in a ZIP archive.
              </Text>
            </Box>
            <Divider />
            <Group>
              <IconLock size={16} />
              <Text size="sm" c="dimmed">
                All exports are secured through user authentication. Data is
                transmitted securely and only accessible to authorized users.
                Your medical data privacy is our top priority.
              </Text>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
};

export default ExportPage;
