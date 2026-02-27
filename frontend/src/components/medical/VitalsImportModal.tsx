/**
 * VitalsImportModal - Multi-step modal for importing vitals from device CSV exports.
 *
 * Steps:
 * 1. Select device + upload CSV file
 * 2. Preview parsed data with duplicate detection
 * 3. Importing (progress)
 * 4. Complete (summary)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Select,
  FileInput,
  Table,
  Alert,
  Badge,
  Checkbox,
  Button,
  Stack,
  Group,
  Text,
  Loader,
  Center,
  Divider,
  Paper,
} from '@mantine/core';
import {
  IconFileImport,
  IconAlertTriangle,
  IconCheck,
  IconUpload,
  IconArrowLeft,
} from '@tabler/icons-react';
import { vitalsService } from '../../services/medical/vitalsService';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';

interface VitalsImportModalProps {
  opened: boolean;
  onClose: () => void;
  patientId: number | null;
  onImportComplete: () => void;
}

interface ImportDevice {
  key: string;
  name: string;
}

interface PreviewRow {
  recorded_date: string;
  blood_glucose: number | null;
  device_used: string | null;
  is_duplicate: boolean;
}

interface PreviewData {
  device_name: string;
  total_readings: number;
  preview_rows: PreviewRow[];
  duplicate_count: number;
  new_count: number;
  skipped_rows: number;
  errors: string[];
  warnings: string[];
  date_range_start: string | null;
  date_range_end: string | null;
}

interface ImportResult {
  imported_count: number;
  skipped_duplicates: number;
  errors: string[];
  total_processed: number;
}

type Step = 'select' | 'preview' | 'importing' | 'complete';

const VitalsImportModal: React.FC<VitalsImportModalProps> = ({
  opened,
  onClose,
  patientId,
  onImportComplete,
}) => {
  const { t } = useTranslation('common');
  const { formatDateTime, formatDate } = useDateFormat();

  // State
  const [step, setStep] = useState<Step>('select');
  const [devices, setDevices] = useState<ImportDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load devices when modal opens
  useEffect(() => {
    if (opened && devices.length === 0) {
      vitalsService
        .getImportDevices()
        .then((response: any) => {
          const deviceList = response?.devices ?? response ?? [];
          setDevices(deviceList);
        })
        .catch((err: any) => {
          logger.error('vitals_import_load_devices_failed', 'Failed to load import devices', {
            component: 'VitalsImportModal',
          });
        });
    }
  }, [opened, devices.length]);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      setStep('select');
      setSelectedDevice(null);
      setFile(null);
      setPreviewData(null);
      setImportResult(null);
      setSkipDuplicates(true);
      setLoading(false);
      setError(null);
    }
  }, [opened]);

  const handlePreview = useCallback(async () => {
    if (!selectedDevice) {
      setError(t('vitals.import.noDevice', 'Please select a device'));
      return;
    }
    if (!file) {
      setError(t('vitals.import.noFile', 'Please select a CSV file'));
      return;
    }
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await vitalsService.previewImport(patientId, selectedDevice, file);
      setPreviewData(result);
      setStep('preview');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        t('vitals.import.parsingFailed', 'Failed to parse CSV file');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, file, patientId, t]);

  const handleImport = useCallback(async () => {
    if (!selectedDevice || !file || !patientId) return;

    setStep('importing');
    setError(null);

    try {
      const result = await vitalsService.executeImport(
        patientId,
        selectedDevice,
        file,
        skipDuplicates
      );
      setImportResult(result);
      setStep('complete');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Import failed';
      setError(message);
      setStep('preview');
    }
  }, [selectedDevice, file, patientId, skipDuplicates]);

  const handleComplete = useCallback(() => {
    onImportComplete();
    onClose();
  }, [onImportComplete, onClose]);

  const deviceOptions = devices.map((d) => ({ value: d.key, label: d.name }));

  const renderSelectStep = () => (
    <Stack gap="md">
      <Select
        label={t('vitals.import.selectDevice', 'Select Device')}
        placeholder={t('vitals.import.selectDevicePlaceholder', 'Choose your device...')}
        data={deviceOptions}
        value={selectedDevice}
        onChange={setSelectedDevice}
        searchable
      />

      <FileInput
        label={t('vitals.import.uploadFile', 'Upload CSV File')}
        placeholder={t('vitals.import.uploadFile', 'Upload CSV File')}
        accept=".csv"
        value={file}
        onChange={setFile}
        leftSection={<IconUpload size={16} />}
      />

      {error && (
        <Alert variant="light" color="red" icon={<IconAlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {t('buttons.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handlePreview}
          loading={loading}
          leftSection={<IconFileImport size={16} />}
        >
          {t('vitals.import.preview', 'Preview')}
        </Button>
      </Group>
    </Stack>
  );

  const renderPreviewStep = () => {
    if (!previewData) return null;

    return (
      <Stack gap="md">
        {/* Summary stats */}
        <Paper p="md" withBorder>
          <Group grow>
            <Stack gap={2} align="center">
              <Text size="xl" fw={700}>
                {previewData.total_readings}
              </Text>
              <Text size="xs" c="dimmed">
                {t('vitals.import.totalReadings', 'Total Readings')}
              </Text>
            </Stack>
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="green">
                {previewData.new_count}
              </Text>
              <Text size="xs" c="dimmed">
                {t('vitals.import.newReadings', 'New Readings')}
              </Text>
            </Stack>
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="orange">
                {previewData.duplicate_count}
              </Text>
              <Text size="xs" c="dimmed">
                {t('vitals.import.duplicatesFound', 'Duplicates Found')}
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* Date range */}
        {previewData.date_range_start && previewData.date_range_end && (
          <Text size="sm" c="dimmed">
            {t('vitals.import.dateRange', 'Date Range')}:{' '}
            {formatDate(previewData.date_range_start)} -{' '}
            {formatDate(previewData.date_range_end)}
          </Text>
        )}

        {/* Duplicate warning */}
        {previewData.duplicate_count > 0 && (
          <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />}>
            <Stack gap="xs">
              <Text size="sm">
                {t('vitals.import.duplicateWarning', '{{count}} readings already exist in this date range. Check the box above to skip them.', {
                  count: previewData.duplicate_count,
                })}
              </Text>
              <Checkbox
                label={t('vitals.import.skipDuplicates', 'Skip duplicate readings')}
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.currentTarget.checked)}
              />
            </Stack>
          </Alert>
        )}

        {/* Warnings */}
        {previewData.warnings.length > 0 && (
          <Alert variant="light" color="yellow" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm" fw={500} mb="xs">
              {t('vitals.import.warnings', 'Warnings')} ({previewData.warnings.length})
            </Text>
            {previewData.warnings.slice(0, 5).map((w, i) => (
              <Text key={i} size="xs">
                {w}
              </Text>
            ))}
            {previewData.warnings.length > 5 && (
              <Text size="xs" c="dimmed" mt="xs">
                ...and {previewData.warnings.length - 5} more
              </Text>
            )}
          </Alert>
        )}

        {/* Preview table */}
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('vitals.table.date', 'Date')}</Table.Th>
              <Table.Th>{t('vitals.modal.bloodGlucose', 'Glucose')} (mg/dL)</Table.Th>
              <Table.Th>{t('labels.status', 'Status')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {previewData.preview_rows.map((row, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>
                  <Text size="sm">{formatDateTime(row.recorded_date)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {row.blood_glucose ?? 'N/A'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {row.is_duplicate ? (
                    <Badge color="orange" size="sm" variant="light">
                      {t('vitals.import.duplicate', 'Duplicate')}
                    </Badge>
                  ) : (
                    <Badge color="green" size="sm" variant="light">
                      {t('labels.new', 'New')}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {previewData.total_readings > 10 && (
          <Text size="xs" c="dimmed" ta="center">
            {t('pagination.showingRange', 'Showing {{start}} to {{end}} of {{total}} results', {
              start: 1,
              end: 10,
              total: previewData.total_readings,
            })}
          </Text>
        )}

        {error && (
          <Alert variant="light" color="red" icon={<IconAlertTriangle size={16} />}>
            {error}
          </Alert>
        )}

        <Divider />

        <Group justify="space-between">
          <Button
            variant="default"
            onClick={() => {
              setStep('select');
              setError(null);
            }}
            leftSection={<IconArrowLeft size={16} />}
          >
            {t('vitals.import.back', 'Back')}
          </Button>
          <Button onClick={handleImport} leftSection={<IconFileImport size={16} />}>
            {t('vitals.import.importButton', 'Import')}{' '}
            {skipDuplicates && previewData.duplicate_count > 0
              ? `(${previewData.new_count})`
              : `(${previewData.total_readings})`}
          </Button>
        </Group>
      </Stack>
    );
  };

  const renderImportingStep = () => (
    <Center py="xl">
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text>{t('vitals.import.importing', 'Importing vitals...')}</Text>
      </Stack>
    </Center>
  );

  const renderCompleteStep = () => {
    if (!importResult) return null;

    const message =
      importResult.skipped_duplicates > 0
        ? t('vitals.import.successWithSkipped', 'Imported {{imported}} readings ({{skipped}} duplicates skipped)', {
            imported: importResult.imported_count,
            skipped: importResult.skipped_duplicates,
          })
        : t('vitals.import.success', 'Successfully imported {{count}} readings', {
            count: importResult.imported_count,
          });

    return (
      <Stack gap="md" align="center" py="md">
        <IconCheck size={48} color="var(--mantine-color-green-6)" />
        <Text size="lg" fw={600}>
          {message}
        </Text>

        {importResult.errors.length > 0 && (
          <Alert variant="light" color="red" icon={<IconAlertTriangle size={16} />}>
            {importResult.errors.map((e, i) => (
              <Text key={i} size="sm">
                {e}
              </Text>
            ))}
          </Alert>
        )}

        <Button onClick={handleComplete}>{t('buttons.close', 'Close')}</Button>
      </Stack>
    );
  };

  const getTitle = () => {
    switch (step) {
      case 'select':
        return t('vitals.import.title', 'Import Vitals');
      case 'preview':
        return t('vitals.import.previewTitle', 'Import Preview');
      case 'importing':
        return t('vitals.import.importing', 'Importing vitals...');
      case 'complete':
        return t('vitals.import.title', 'Import Vitals');
      default:
        return t('vitals.import.title', 'Import Vitals');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={step === 'importing' ? () => {} : onClose}
      title={getTitle()}
      size="lg"
      centered
      closeOnClickOutside={step !== 'importing'}
      closeOnEscape={step !== 'importing'}
    >
      {step === 'select' && renderSelectStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'importing' && renderImportingStep()}
      {step === 'complete' && renderCompleteStep()}
    </Modal>
  );
};

export default VitalsImportModal;
