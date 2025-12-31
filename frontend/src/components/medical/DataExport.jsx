import React, { useState, useEffect } from 'react';
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
  Badge,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconDownload,
  IconFileExport,
  IconDatabase,
} from '@tabler/icons-react';
import { exportService } from '../../services/exportService';

const DataExport = () => {
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
                Export Medical Records
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
                    Available Data
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
              Single Export
            </Button>
            <Button
              variant={bulkExport ? 'filled' : 'outline'}
              onClick={() => setBulkExport(true)}
              size="xs"
            >
              Bulk Export
            </Button>
          </Group>

          <Divider />

          {/* Export Options */}
          <Stack gap="lg">
            {/* Format Selection */}
            <Box>
              <Text fw={500} size="sm" mb="xs" c="inherit">
                Export Format
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
                  Data to Export
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
                  Select Data Types (Bulk Export)
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
                  Start Date (Optional)
                </Text>
                <DateInput
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Filter from date"
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text fw={500} size="sm" mb="xs" c="inherit">
                  End Date (Optional)
                </Text>
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Filter to date"
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
                  This may significantly increase export time and file size
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
                Export Information
              </Text>
              <Stack gap="xs">
                <Text size="sm" c="blue">
                  • JSON format provides complete machine-readable data
                </Text>
                <Text size="sm" c="blue">
                  • CSV format is ideal for spreadsheet applications
                </Text>
                <Text size="sm" c="blue">
                  • PDF format creates human-readable documents
                </Text>
                <Text size="sm" c="blue">
                  • Date filters apply to record dates where available
                </Text>
                <Text size="sm" c="blue">
                  • Bulk exports are packaged in ZIP files for convenience
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
