import { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Text,
  Button,
  Select,
  Checkbox,
  Alert,
  Loader,
  Center,
  Stack,
  Grid,
  Paper,
  Title,
  Box,
  Container,
  Divider,
} from '@mantine/core';
import { DateInput } from '../adapters/DateInput';
import {
  IconDownload,
  IconFileExport,
  IconDatabase,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { exportService } from '../../services/exportService';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

const DataExport = () => {
  const { t } = useTranslation('reports');
  const { dateInputFormat, dateParser } = useDateFormat();
  const { unitSystem } = useUserPreferences();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [selectedScope, setSelectedScope] = useState('all');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [includeFiles, setIncludeFiles] = useState(false);
  const [bulkExport, setBulkExport] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [summaryData, formatsData] = await Promise.all([
        exportService.getSummary(),
        exportService.getSupportedFormats(),
      ]);

      setSummary(summaryData.data);
      setFormats(formatsData.formats);
      setScopes(formatsData.scopes);
      setError(null);
    } catch (err) {
      setError('Failed to load export options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        format: selectedFormat,
        scope: selectedScope,
        unit_system: unitSystem,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedFormat === 'pdf' && { include_files: includeFiles }),
      };
      await exportService.downloadExport(params);
      setSuccess(
        `Successfully exported ${selectedScope} data as ${selectedFormat.toUpperCase()}`
      );
    } catch (err) {
      setError(err.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = async () => {
    if (selectedScopes.length === 0) {
      setError('Please select at least one data type for bulk export');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = {
        scopes: selectedScopes,
        format: selectedFormat,
        unit_system: unitSystem,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      };
      await exportService.downloadBulkExport(params);
      setSuccess(
        `Successfully exported ${selectedScopes.length} data types as ${selectedFormat.toUpperCase()}`
      );
    } catch (err) {
      setError(err.message || 'Bulk export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = scopeValue => {
    setSelectedScopes(prev =>
      prev.includes(scopeValue)
        ? prev.filter(s => s !== scopeValue)
        : [...prev, scopeValue]
    );
  };

  if (loading && !summary) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Loading export options...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Card withBorder shadow="sm" radius="md" p="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="center">
            <Title order={2} fw={600}>
              <Group gap="sm">
                <IconFileExport size={24} />
                {t('dataExport.exportTitle')}
              </Group>
            </Title>
          </Group>

          {/* Alerts */}
          {error && (
            <Alert
              color="red"
              title="Error"
              withCloseButton
              onClose={() => setError(null)}
              style={{ whiteSpace: 'pre-line' }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              color="green"
              title="Success"
              withCloseButton
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          )}

          {/* Data Summary */}
          {summary && (
            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Group gap="sm">
                  <IconDatabase size={20} />
                  <Text fw={500} size="lg">
                    {t('dataExport.availableData')}
                  </Text>
                </Group>
                <Grid>
                  {Object.entries(summary.counts).map(([type, count]) => (
                    <Grid.Col key={type} span={{ base: 6, sm: 4, md: 2.4 }}>
                      <Paper withBorder p="sm" radius="sm" ta="center">
                        <Text fw={600} size="xl" c="blue">
                          {count}
                        </Text>
                        <Text size="sm" c="dimmed" tt="capitalize">
                          {type.replace('_', ' ')}
                        </Text>
                      </Paper>
                    </Grid.Col>
                  ))}
                </Grid>
              </Stack>
            </Paper>
          )}

          {/* Export Type Toggle */}
          <Group justify="center" gap="md">
            <Button
              variant={!bulkExport ? 'filled' : 'outline'}
              onClick={() => setBulkExport(false)}
              size="xs"
            >
              {t('dataExport.singleExport')}
            </Button>
            <Button
              variant={bulkExport ? 'filled' : 'outline'}
              onClick={() => setBulkExport(true)}
              size="xs"
            >
              {t('dataExport.bulkExport')}
            </Button>
          </Group>

          <Divider />

          {/* Export Options */}
          <Stack gap="lg">
            {/* Format Selection */}
            <Box>
              <Text fw={500} size="sm" mb="xs" c="inherit">
                {t('export.configuration.format.label')}
              </Text>
              <Select
                value={selectedFormat}
                onChange={setSelectedFormat}
                data={formats.map(f => ({ value: f.value, label: f.label }))}
                placeholder="Select format"
              />
              <Text size="xs" c="dimmed" mt="xs">
                {formats.find(f => f.value === selectedFormat)?.description}
              </Text>
            </Box>

            {/* Scope Selection */}
            {!bulkExport ? (
              <Box>
                <Text fw={500} size="sm" mb="xs" c="inherit">
                  {t('export.configuration.dataToExport.label')}
                </Text>
                <Select
                  value={selectedScope}
                  onChange={setSelectedScope}
                  data={scopes.map(s => ({
                    value: s.value,
                    label: s.label,
                  }))}
                  placeholder="Select data type"
                />
                <Text size="xs" c="dimmed" mt="xs">
                  {scopes.find(s => s.value === selectedScope)?.description}
                </Text>
              </Box>
            ) : (
              <Box>
                <Text fw={500} size="sm" mb="xs" c="inherit">
                  {t('export.configuration.bulkSelection.label')}
                </Text>
                <Grid>
                  {scopes
                    .filter(s => s.value !== 'all')
                    .map(scope => (
                      <Grid.Col key={scope.value} span={{ base: 12, sm: 6 }}>
                        <Checkbox
                          checked={selectedScopes.includes(scope.value)}
                          onChange={() => handleScopeToggle(scope.value)}
                          label={scope.label}
                        />
                      </Grid.Col>
                    ))}
                </Grid>
              </Box>
            )}

            {/* Date Range */}
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text fw={500} size="sm" mb="xs" c="inherit">
                  {t('export.configuration.dateRange.startDate')}
                </Text>
                <DateInput
                  value={startDate}
                  onChange={setStartDate}
                  placeholder={dateInputFormat}
                  valueFormat={dateInputFormat}
                  dateParser={dateParser}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text fw={500} size="sm" mb="xs" c="inherit">
                  {t('export.configuration.dateRange.endDate')}
                </Text>
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                  placeholder={dateInputFormat}
                  valueFormat={dateInputFormat}
                  dateParser={dateParser}
                  clearable
                />
              </Grid.Col>
            </Grid>

            {/* PDF Options */}
            {selectedFormat === 'pdf' && !bulkExport && (
              <Box>
                <Checkbox
                  checked={includeFiles}
                  onChange={event =>
                    setIncludeFiles(event.currentTarget.checked)
                  }
                  label="Include attached files in PDF export"
                />
                <Text size="xs" c="dimmed" mt="xs">
                  {t('dataExport.includeFilesNote')}
                </Text>
              </Box>
            )}

            {/* Export Buttons */}
            <Box>
              {!bulkExport ? (
                <Button
                  onClick={handleSingleExport}
                  loading={loading}
                  fullWidth
                  size="xs"
                  leftSection={<IconDownload size={16} />}
                >
                  {loading
                    ? 'Exporting...'
                    : `Export ${selectedScope} as ${selectedFormat.toUpperCase()}`}
                </Button>
              ) : (
                <Button
                  onClick={handleBulkExport}
                  loading={loading}
                  disabled={selectedScopes.length === 0}
                  fullWidth
                  size="xs"
                  leftSection={<IconDownload size={16} />}
                >
                  {loading
                    ? 'Exporting...'
                    : `Bulk Export ${selectedScopes.length} types as ${selectedFormat.toUpperCase()}`}
                </Button>
              )}
            </Box>
          </Stack>

          {/* Export Information */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Text fw={500} c="blue">
                {t('dataExport.exportInfo')}
              </Text>
              <Stack gap="xs">
                <Text size="sm" c="blue">
                  {'\u2022'} {t('dataExport.jsonDescription')}
                </Text>
                <Text size="sm" c="blue">
                  {'\u2022'} {t('dataExport.csvDescription')}
                </Text>
                <Text size="sm" c="blue">
                  {'\u2022'} {t('dataExport.pdfDescription')}
                </Text>
                <Text size="sm" c="blue">
                  {'\u2022'} {t('dataExport.dateFilterNote')}
                </Text>
                <Text size="sm" c="blue">
                  {'\u2022'} {t('dataExport.zipDescription')}
                </Text>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Card>
    </Container>
  );
};

export default DataExport;
