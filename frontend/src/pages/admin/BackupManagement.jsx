import logger from '../../services/logger';

import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminData } from '../../hooks/useAdminData';
import { useBackupNotifications } from '../../hooks/useBackupNotifications';
import { adminApiService } from '../../services/api/adminApi';
import { downloadBlob, exportTimestamp } from '../../utils/downloadUtils';
import { useDateFormat } from '../../hooks/useDateFormat';
import {
  Card,
  Tabs,
  Table,
  Paper,
  ScrollArea,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Modal,
  Alert,
  NumberInput,
  Select,
  List,
  ThemeIcon,
  SimpleGrid,
  Center,
  Loader,
  LoadingOverlay,
  TextInput,
  FileButton,
  Divider,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  IconDeviceFloppy,
  IconSettings,
  IconDatabase,
  IconDatabaseExport,
  IconFiles,
  IconUpload,
  IconDotsVertical,
  IconEraser,
  IconTrash,
  IconDownload,
  IconShieldCheck,
  IconRefresh,
  IconRestore,
  IconEye,
  IconAlertTriangle,
  IconAlertCircle,
  IconShield,
  IconInbox,
  IconBolt,
  IconClipboardList,
  IconCalendarEvent,
  IconClock,
  IconCheck,
} from '@tabler/icons-react';
import './BackupManagement.css';

// Default retention settings constants
const DEFAULT_RETENTION_SETTINGS = {
  BACKUP_RETENTION_DAYS: 7,
  BACKUP_MIN_COUNT: 5,
  BACKUP_MAX_COUNT: 50,
};

// Minimum allowed values for each setting
const MIN_VALUES = {
  backup_retention_days: 1,
  backup_min_count: 1,
  backup_max_count: 5,
};

const getTypeColor = (type) => ({ database: 'blue', files: 'orange', full: 'cyan' }[type] || 'gray');
const getStatusColor = (status) => ({
  created: 'green', uploaded: 'blue', verified: 'indigo', failed: 'red',
  missing: 'red', corrupted: 'red', size_mismatch: 'yellow', checksum_failed: 'yellow',
}[status] || 'gray');

const BackupManagement = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { formatDateTime } = useDateFormat();
  const [creating, setCreating] = useState({});
  const [restoring, setRestoring] = useState({});
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const uploadResetRef = useRef(null);

  // Tab management
  const [activeTab, setActiveTab] = useState('backups');
  const [pendingTab, setPendingTab] = useState(null);

  // Modal disclosures
  const [unsavedOpened, { open: openUnsaved, close: closeUnsaved }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [cleanupOpened, { open: openCleanup, close: closeCleanup }] = useDisclosure(false);
  const [restoreOpened, { open: openRestore, close: closeRestore }] = useDisclosure(false);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);

  // Modal state
  const [backupToDelete, setBackupToDelete] = useState(null);
  const [cleanupConfirmText, setCleanupConfirmText] = useState('');
  const [backupToRestore, setBackupToRestore] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Retention settings state
  const [retentionSettings, setRetentionSettings] = useState({
    backup_retention_days: DEFAULT_RETENTION_SETTINGS.BACKUP_RETENTION_DAYS,
    backup_min_count: DEFAULT_RETENTION_SETTINGS.BACKUP_MIN_COUNT,
    backup_max_count: DEFAULT_RETENTION_SETTINGS.BACKUP_MAX_COUNT,
  });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Auto-backup schedule state
  const [scheduleSettings, setScheduleSettings] = useState({
    preset: 'disabled',
    time_of_day: '02:00',
    day_of_week: 'sun',
    enabled: false,
    last_run_at: null,
    last_run_status: null,
    last_run_error: null,
    next_run_at: null,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Enhanced notification system
  const { showSuccess, showError, showLoading, hideLoading, showWarning } = useBackupNotifications();

  // Backup Management with auto-refresh
  const {
    data: backupData,
    loading,
    error,
    refreshData,
    executeAction: rawExecuteAction,
  } = useAdminData({
    entityName: 'Backup Management',
    apiMethodsConfig: {
      load: signal => adminApiService.getBackups(signal),
      createDatabaseBackup: (description, signal) =>
        adminApiService.createDatabaseBackup(description, signal),
      createFilesBackup: (description, signal) =>
        adminApiService.createFilesBackup(description, signal),
      createFullBackup: (description, signal) =>
        adminApiService.createFullBackup(description, signal),
      uploadBackup: (file, signal) =>
        adminApiService.uploadBackup(file, signal),
      downloadBackup: (backupId, signal) =>
        adminApiService.downloadBackup(backupId, signal),
      verifyBackup: (backupId, signal) =>
        adminApiService.verifyBackup(backupId, signal),
      deleteBackup: (backupId, signal) =>
        adminApiService.deleteBackup(backupId, signal),
      cleanupBackups: signal => adminApiService.cleanupBackups(signal),
      cleanupAllOldData: signal => adminApiService.cleanupAllOldData(signal),
      restoreBackup: (data, signal) =>
        adminApiService.executeRestore(
          data.backupId,
          data.confirmationToken,
          signal
        ),
    },
  });

  // Wrap executeAction to suppress default success messages
  const executeAction = async (actionName, actionData = null) => {
    try {
      return await rawExecuteAction(actionName, actionData);
    } catch (err) {
      throw err;
    }
  };

  const backups = backupData?.backups || [];

  const handleExportBackups = async () => {
    setExporting(true);
    try {
      const blob = await adminApiService.exportBackups();
      downloadBlob(blob, `backup_history_export_${exportTimestamp()}.csv`);
    } catch (err) {
      logger.error('backup_export_error', 'Failed to export backup history', {
        component: 'BackupManagement', error: err.message,
      });
      showError('exportBackups', err);
    } finally {
      setExporting(false);
    }
  };

  // Detect unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    if (!originalSettings) return false;

    return (
      retentionSettings.backup_retention_days !== originalSettings.backup_retention_days ||
      retentionSettings.backup_min_count !== originalSettings.backup_min_count ||
      retentionSettings.backup_max_count !== originalSettings.backup_max_count
    );
  }, [retentionSettings, originalSettings]);

  // Handle tab change with unsaved changes warning
  const handleTabChange = (newTab) => {
    if (activeTab === 'settings' && hasUnsavedChanges) {
      setPendingTab(newTab);
      openUnsaved();
      return;
    }
    setActiveTab(newTab);
  };

  const handleConfirmTabSwitch = () => {
    if (hasUnsavedChanges && originalSettings) {
      setRetentionSettings(originalSettings);
    }
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    closeUnsaved();
  };

  // Load retention settings and schedule on mount
  React.useEffect(() => {
    loadRetentionSettings();
    loadScheduleSettings();
  }, []);

  const loadRetentionSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await adminApiService.getRetentionSettings();

      const loadedSettings = {
        backup_retention_days: data.backup_retention_days || DEFAULT_RETENTION_SETTINGS.BACKUP_RETENTION_DAYS,
        backup_min_count: data.backup_min_count || DEFAULT_RETENTION_SETTINGS.BACKUP_MIN_COUNT,
        backup_max_count: data.backup_max_count || DEFAULT_RETENTION_SETTINGS.BACKUP_MAX_COUNT,
      };

      setRetentionSettings(loadedSettings);
      setOriginalSettings(loadedSettings);

      logger.info('Retention settings loaded successfully', {
        component: 'BackupManagement',
      });
    } catch (err) {
      logger.error('Failed to load retention settings', {
        component: 'BackupManagement',
        error: err.message,
      });
      showError('loadRetentionSettings', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadScheduleSettings = async () => {
    try {
      const data = await adminApiService.getAutoBackupSchedule();
      setScheduleSettings(data);
    } catch (err) {
      logger.error('Failed to load auto-backup schedule', {
        component: 'BackupManagement',
        error: err.message,
      });
    }
  };

  const handleSaveSchedule = async () => {
    try {
      setScheduleSaving(true);

      const payload = {
        preset: scheduleSettings.preset,
        time_of_day: scheduleSettings.time_of_day,
      };
      if (scheduleSettings.preset === 'weekly') {
        payload.day_of_week = scheduleSettings.day_of_week;
      }

      const loadingId = showLoading('updateSchedule');
      const response = await adminApiService.updateAutoBackupSchedule(payload);
      hideLoading(loadingId);
      showSuccess('updateSchedule', response);

      if (response.schedule) {
        setScheduleSettings(prev => ({ ...prev, ...response.schedule }));
      }
    } catch (err) {
      logger.error('Failed to save auto-backup schedule', {
        component: 'BackupManagement',
        error: err.message,
      });
      showError('updateSchedule', err);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSettingsInputChange = (field, value) => {
    if (value === '') {
      setRetentionSettings(prev => ({
        ...prev,
        [field]: '',
      }));
      return;
    }

    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;

    if (!Number.isNaN(numericValue) && numericValue >= 1) {
      setRetentionSettings(prev => ({
        ...prev,
        [field]: numericValue,
      }));
    }
  };

  const handleSettingsBlur = (field) => {
    const min = MIN_VALUES[field] || 1;
    if (retentionSettings[field] === '' || retentionSettings[field] < min) {
      setRetentionSettings(prev => ({
        ...prev,
        [field]: min,
      }));
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true);

      const validSettings = {
        backup_retention_days: retentionSettings.backup_retention_days || DEFAULT_RETENTION_SETTINGS.BACKUP_RETENTION_DAYS,
        backup_min_count: retentionSettings.backup_min_count || DEFAULT_RETENTION_SETTINGS.BACKUP_MIN_COUNT,
        backup_max_count: retentionSettings.backup_max_count || DEFAULT_RETENTION_SETTINGS.BACKUP_MAX_COUNT,
      };

      setRetentionSettings(validSettings);

      const loadingId = showLoading('updateRetentionSettings');

      const response = await adminApiService.updateRetentionSettings(validSettings);

      hideLoading(loadingId);
      showSuccess('updateRetentionSettings', response);

      if (response.current_settings) {
        const confirmedSettings = {
          backup_retention_days: response.current_settings.backup_retention_days,
          backup_min_count: response.current_settings.backup_min_count,
          backup_max_count: response.current_settings.backup_max_count,
        };
        setRetentionSettings(confirmedSettings);
        setOriginalSettings(confirmedSettings);
      }

      logger.info('Retention settings updated successfully', {
        component: 'BackupManagement',
        settings: validSettings,
      });

      await refreshData();
    } catch (err) {
      logger.error('Failed to save retention settings', {
        component: 'BackupManagement',
        error: err.message,
      });
      showError('updateRetentionSettings', err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCreateBackup = async type => {
    setCreating(prev => ({ ...prev, [type]: true }));

    const actionName = type === 'database' ? 'createDatabaseBackup'
                    : type === 'files' ? 'createFilesBackup'
                    : 'createFullBackup';

    const loadingId = showLoading(actionName);

    try {
      const description = `Manual ${type} backup created on ${formatDateTime(new Date().toISOString())}`;

      let result;
      if (type === 'database') {
        result = await executeAction('createDatabaseBackup', description);
      } else if (type === 'files') {
        result = await executeAction('createFilesBackup', description);
      } else if (type === 'full') {
        result = await executeAction('createFullBackup', description);
      }

      hideLoading(loadingId);
      if (result) {
        showSuccess(actionName, result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError(actionName, err);
      logger.error(`${actionName} failed:`, err);
    } finally {
      setCreating(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleUploadBackup = async (file) => {
    if (!file) return;

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.sql') && !filename.endsWith('.zip')) {
      showWarning(t('backup.operations.invalidFileType', 'Invalid File Type'), t('backup.operations.invalidFileTypeDesc', 'Please select a .sql or .zip backup file.'));
      return;
    }

    setUploading(true);
    const loadingId = showLoading('uploadBackup');

    try {
      const result = await executeAction('uploadBackup', file);

      hideLoading(loadingId);
      if (result) {
        showSuccess('uploadBackup', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('uploadBackup', err);
      logger.error('Upload backup failed:', err);
    } finally {
      setUploading(false);
      uploadResetRef.current?.();
    }
  };

  const handleDownloadBackup = async (backupId, filename) => {
    const loadingId = showLoading('downloadBackup');

    try {
      const blob = await executeAction('downloadBackup', backupId);

      hideLoading(loadingId);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess('downloadBackup');
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('downloadBackup', err);
      logger.error('Download failed:', err);
    }
  };

  const handleVerifyBackup = async backupId => {
    const loadingId = showLoading('verifyBackup');

    try {
      const result = await executeAction('verifyBackup', backupId);

      hideLoading(loadingId);
      if (result) {
        showSuccess('verifyBackup', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('verifyBackup', err);
      logger.error('Verify backup failed:', err);
    }
  };

  const handleDeleteClick = (backupId, filename) => {
    setBackupToDelete({ id: backupId, filename });
    openDelete();
  };

  const handleConfirmDelete = async () => {
    if (!backupToDelete) return;

    const loadingId = showLoading('deleteBackup');

    try {
      const result = await executeAction('deleteBackup', backupToDelete.id);

      hideLoading(loadingId);
      if (result) {
        showSuccess('deleteBackup', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('deleteBackup', err);
      logger.error('Delete backup failed:', err);
    } finally {
      closeDelete();
      setBackupToDelete(null);
    }
  };

  const handleCleanupBackups = async () => {
    const loadingId = showLoading('cleanupBackups');

    try {
      const result = await executeAction('cleanupBackups');

      hideLoading(loadingId);
      if (result) {
        showSuccess('cleanupBackups', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('cleanupBackups', err);
      logger.error('Cleanup backups failed:', err);
    }
  };

  const handleOpenCleanupModal = () => {
    setCleanupConfirmText('');
    openCleanup();
  };

  const handleConfirmCompleteCleanup = async () => {
    const loadingId = showLoading('cleanupAllOldData');

    try {
      const result = await executeAction('cleanupAllOldData');

      hideLoading(loadingId);
      if (result) {
        showSuccess('cleanupAllOldData', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('cleanupAllOldData', err);
      logger.error('Complete cleanup failed:', err);
    } finally {
      closeCleanup();
      setCleanupConfirmText('');
    }
  };

  const handleRestoreClick = (backupId, backupType) => {
    setBackupToRestore({ id: backupId, type: backupType });
    openRestore();
  };

  const handleConfirmRestore = async () => {
    if (!backupToRestore) return;

    setRestoring(prev => ({ ...prev, [backupToRestore.id]: true }));
    const loadingId = showLoading('restoreBackup');

    try {
      const tokenResponse = await adminApiService.getConfirmationToken(backupToRestore.id);

      const result = await executeAction('restoreBackup', {
        backupId: backupToRestore.id,
        confirmationToken: tokenResponse.confirmation_token,
      });

      hideLoading(loadingId);
      if (result) {
        showSuccess('restoreBackup', result);
        await refreshData();
      }
    } catch (err) {
      hideLoading(loadingId);
      showError('restoreBackup', err);
      logger.error('Restore failed:', err);
    } finally {
      setRestoring(prev => ({ ...prev, [backupToRestore.id]: false }));
      closeRestore();
      setBackupToRestore(null);
    }
  };

  const handlePreviewRestore = async (backupId) => {
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    openPreview();

    try {
      const data = await adminApiService.previewRestore(backupId);
      setPreviewData(data);
    } catch (err) {
      setPreviewError(err.message || 'Failed to load restore preview');
      logger.error('Preview restore failed:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewToRestore = () => {
    if (!previewData) return;
    closePreview();
    setBackupToRestore({ id: previewData.backup_id, type: previewData.backup_type });
    openRestore();
  };

  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const schedulePresetData = useMemo(() => [
    { value: 'disabled', label: t('backup.schedule.presets.disabled', 'Disabled') },
    { value: 'every_6_hours', label: t('backup.schedule.presets.every6Hours', 'Every 6 hours') },
    { value: 'every_12_hours', label: t('backup.schedule.presets.every12Hours', 'Every 12 hours') },
    { value: 'daily', label: t('backup.schedule.presets.daily', 'Daily') },
    { value: 'weekly', label: t('backup.schedule.presets.weekly', 'Weekly') },
  ], [t]);

  const dayOfWeekData = useMemo(() => [
    { value: 'mon', label: t('backup.schedule.days.mon', 'Monday') },
    { value: 'tue', label: t('backup.schedule.days.tue', 'Tuesday') },
    { value: 'wed', label: t('backup.schedule.days.wed', 'Wednesday') },
    { value: 'thu', label: t('backup.schedule.days.thu', 'Thursday') },
    { value: 'fri', label: t('backup.schedule.days.fri', 'Friday') },
    { value: 'sat', label: t('backup.schedule.days.sat', 'Saturday') },
    { value: 'sun', label: t('backup.schedule.days.sun', 'Sunday') },
  ], [t]);

  if (loading && !backupData) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">{t('backup.loading', 'Loading backup management...')}</Text>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  if (error && !backupData) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center" gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title={t('common:labels.error', 'Error')}>
              {error}
            </Alert>
            <Button onClick={() => refreshData()}>{t('common:buttons.retry', 'Retry')}</Button>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="backup-management">
        {/* Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group justify="space-between">
            <Group>
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconDeviceFloppy size={24} />
              </ThemeIcon>
              <div>
                <Title order={2}>{t('backup.title', 'Backup Management')}</Title>
                <Text c="dimmed" size="sm">{t('backup.subtitle', 'Create and manage system backups')}</Text>
              </div>
            </Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={refreshData}
              loading={loading}
              variant="light"
            >
              {t('common:buttons.refresh', 'Refresh')}
            </Button>
          </Group>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List mb="xl">
            <Tabs.Tab value="backups" leftSection={<IconDeviceFloppy size={16} />}>
              {t('backup.tabs.backups', 'Backups')}
            </Tabs.Tab>
            <Tabs.Tab
              value="settings"
              leftSection={<IconSettings size={16} />}
              rightSection={
                hasUnsavedChanges
                  ? <Badge size="xs" color="yellow" variant="filled">{t('backup.unsavedBadge', 'Unsaved')}</Badge>
                  : null
              }
            >
              {t('backup.tabs.settings', 'Settings')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Backups Panel */}
          <Tabs.Panel value="backups">
            {/* Backup Operations */}
            <Card shadow="sm" p="lg" mb="xl" withBorder>
              <Group mb="md">
                <ThemeIcon size="lg" variant="light" color="violet">
                  <IconBolt size={20} />
                </ThemeIcon>
                <Text fw={600} size="lg">{t('backup.operations.title', 'Backup Operations')}</Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                {/* Full Backup */}
                <Card withBorder p="md">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="cyan">
                      <IconDatabaseExport size={24} />
                    </ThemeIcon>
                    <Text fw={500} ta="center">{t('backup.operations.fullBackup', 'Full System Backup')}</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t('backup.operations.fullBackupDesc', 'Complete backup (database + files)')}
                    </Text>
                    <Button
                      fullWidth
                      loading={creating.full}
                      onClick={() => handleCreateBackup('full')}
                      leftSection={<IconDatabaseExport size={16} />}
                    >
                      {t('backup.operations.createFullBackup', 'Create Full Backup')}
                    </Button>
                  </Stack>
                </Card>

                {/* Upload */}
                <Card withBorder p="md">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="blue">
                      <IconUpload size={24} />
                    </ThemeIcon>
                    <Text fw={500} ta="center">{t('backup.operations.uploadBackup', 'Upload Backup')}</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t('backup.operations.uploadBackupDesc', 'Upload an external backup file (.sql or .zip)')}
                    </Text>
                    <FileButton
                      resetRef={uploadResetRef}
                      onChange={handleUploadBackup}
                      accept=".sql,.zip"
                    >
                      {(props) => (
                        <Button
                          {...props}
                          fullWidth
                          variant="light"
                          loading={uploading}
                          leftSection={<IconUpload size={16} />}
                        >
                          {t('backup.operations.chooseFile', 'Choose Backup File')}
                        </Button>
                      )}
                    </FileButton>
                  </Stack>
                </Card>

                {/* Advanced */}
                <Card withBorder p="md">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconDotsVertical size={24} />
                    </ThemeIcon>
                    <Text fw={500} ta="center">{t('backup.operations.advancedOptions', 'Advanced Options')}</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t('backup.operations.advancedOptionsDesc', 'Additional backup and cleanup operations')}
                    </Text>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <Button
                          fullWidth
                          variant="light"
                          leftSection={<IconDotsVertical size={16} />}
                        >
                          {t('backup.operations.moreOptions', 'More Options')}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconDatabase size={16} />}
                          onClick={() => handleCreateBackup('database')}
                          disabled={creating.database}
                        >
                          {creating.database ? t('backup.operations.creating', 'Creating...') : t('backup.operations.databaseOnly', 'Database Only')}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconFiles size={16} />}
                          onClick={() => handleCreateBackup('files')}
                          disabled={creating.files}
                        >
                          {creating.files ? t('backup.operations.creating', 'Creating...') : t('backup.operations.filesOnly', 'Files Only')}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<IconEraser size={16} />}
                          onClick={handleCleanupBackups}
                          disabled={loading}
                        >
                          {t('backup.operations.cleanupOld', 'Cleanup Old Backups')}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={handleOpenCleanupModal}
                          disabled={loading}
                        >
                          {t('backup.operations.completeCleanup', 'Complete Cleanup')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Stack>
                </Card>
              </SimpleGrid>
            </Card>

            {/* Existing Backups Table */}
            <Card shadow="sm" p="lg" mb="xl" withBorder pos="relative">
              <LoadingOverlay visible={loading && !!backupData} />
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconClipboardList size={20} />
                  </ThemeIcon>
                  <Text fw={600} size="lg">{t('backup.existingBackups.title', 'Existing Backups')}</Text>
                </Group>
                <Group gap="sm">
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    onClick={handleExportBackups}
                    loading={exporting}
                    disabled={backups.length === 0}
                  >
                    {t('backup.existingBackups.exportCsv', 'Export CSV')}
                  </Button>
                  <Text size="sm" c="dimmed">{t('backup.existingBackups.count', '{{count}} backups', { count: backups.length })}</Text>
                </Group>
              </Group>

              {backups.length === 0 ? (
                <Center py="xl">
                  <Stack align="center">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconInbox size={24} />
                    </ThemeIcon>
                    <Text c="dimmed">{t('backup.existingBackups.noBackups', 'No backups found')}</Text>
                  </Stack>
                </Center>
              ) : (
                <Paper withBorder>
                  <ScrollArea>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.type', 'Type')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.filename', 'Filename')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.size', 'Size')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.status', 'Status')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.created', 'Created')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.fileExists', 'File Exists')}</Table.Th>
                          <Table.Th>{t('backup.existingBackups.tableHeaders.actions', 'Actions')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {backups.map(backup => (
                          <Table.Tr key={backup.id}>
                            <Table.Td>
                              <Badge variant="light" color={getTypeColor(backup.backup_type)}>
                                {backup.backup_type}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {backup.filename}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{backup.size_bytes ? formatFileSize(backup.size_bytes) : t('backup.existingBackups.unknown', 'Unknown')}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color={getStatusColor(backup.status)}>
                                {backup.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatDateTime(backup.created_at)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={backup.file_exists ? 'green' : 'red'} variant="light">
                                {backup.file_exists ? t('common:labels.yes', 'Yes') : t('common:labels.no', 'No')}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                {backup.file_exists && (
                                  <Tooltip label={t('backup.existingBackups.download', 'Download')}>
                                    <ActionIcon
                                      variant="subtle"
                                      color="green"
                                      onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                                      aria-label={t('backup.existingBackups.download', 'Download')}
                                    >
                                      <IconDownload size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label={t('backup.existingBackups.verify', 'Verify')}>
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => handleVerifyBackup(backup.id)}
                                    aria-label={t('backup.existingBackups.verify', 'Verify')}
                                  >
                                    <IconShieldCheck size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                {backup.file_exists && (
                                  <Tooltip label={t('backup.existingBackups.previewRestore', 'Preview restore')}>
                                    <ActionIcon
                                      variant="subtle"
                                      color="cyan"
                                      onClick={() => handlePreviewRestore(backup.id)}
                                      aria-label={t('backup.existingBackups.previewRestore', 'Preview restore')}
                                    >
                                      <IconEye size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label={t('common:buttons.delete', 'Delete')}>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteClick(backup.id, backup.filename)}
                                    aria-label={t('common:buttons.delete', 'Delete')}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                {backup.file_exists && (
                                  <Tooltip label={t('backup.existingBackups.restore', 'Restore')}>
                                    <ActionIcon
                                      variant="subtle"
                                      color="orange"
                                      onClick={() => handleRestoreClick(backup.id, backup.backup_type)}
                                      disabled={restoring[backup.id]}
                                      aria-label={t('backup.existingBackups.restore', 'Restore')}
                                    >
                                      <IconRestore size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Paper>
              )}
            </Card>
          </Tabs.Panel>

          {/* Settings Panel */}
          <Tabs.Panel value="settings">
            <Stack gap="lg">
              {/* Auto-Backup Schedule */}
              <Card shadow="sm" p="lg" withBorder>
                <Group mb="md">
                  <ThemeIcon size="lg" variant="light" color="violet">
                    <IconCalendarEvent size={20} />
                  </ThemeIcon>
                  <Text fw={600} size="lg">
                    {t('backup.schedule.title', 'Auto-Backup Schedule')}
                  </Text>
                  <Badge
                    variant="light"
                    color={scheduleSettings.enabled ? 'green' : 'gray'}
                  >
                    {scheduleSettings.enabled ? t('backup.schedule.active', 'Active') : t('backup.schedule.disabled', 'Disabled')}
                  </Badge>
                </Group>

                <Stack>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={500}>{t('backup.schedule.frequency', 'Backup Frequency')}</Text>
                      <Text size="sm" c="dimmed">
                        {t('backup.schedule.frequencyDesc', 'Schedule automatic full backups (database + files)')}
                      </Text>
                    </Stack>
                    <Select
                      w={200}
                      value={scheduleSettings.preset}
                      onChange={value =>
                        setScheduleSettings(prev => ({
                          ...prev,
                          preset: value,
                          enabled: value !== 'disabled',
                        }))
                      }
                      data={schedulePresetData}
                    />
                  </Group>

                  {(scheduleSettings.preset === 'daily' ||
                    scheduleSettings.preset === 'weekly') && (
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text fw={500}>{t('backup.schedule.timeOfDay', 'Time of Day')}</Text>
                        <Text size="sm" c="dimmed">
                          {t('backup.schedule.timeOfDayDesc', 'When should the backup run? (24-hour format)')}
                        </Text>
                      </Stack>
                      <TimeInput
                        w={160}
                        value={scheduleSettings.time_of_day}
                        onChange={event =>
                          setScheduleSettings(prev => ({
                            ...prev,
                            time_of_day: event.target.value,
                          }))
                        }
                        leftSection={<IconClock size={16} />}
                      />
                    </Group>
                  )}

                  {scheduleSettings.preset === 'weekly' && (
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text fw={500}>{t('backup.schedule.dayOfWeek', 'Day of Week')}</Text>
                        <Text size="sm" c="dimmed">
                          {t('backup.schedule.dayOfWeekDesc', 'Which day should the weekly backup run?')}
                        </Text>
                      </Stack>
                      <Select
                        w={160}
                        value={scheduleSettings.day_of_week}
                        onChange={value =>
                          setScheduleSettings(prev => ({
                            ...prev,
                            day_of_week: value,
                          }))
                        }
                        data={dayOfWeekData}
                        leftSection={<IconCalendarEvent size={16} />}
                      />
                    </Group>
                  )}

                  {scheduleSettings.next_run_at && scheduleSettings.enabled && (
                    <Group justify="space-between">
                      <Text fw={500}>{t('backup.schedule.nextScheduledRun', 'Next Scheduled Run')}</Text>
                      <Text size="sm" c="dimmed">
                        {new Date(scheduleSettings.next_run_at).toLocaleString()}
                      </Text>
                    </Group>
                  )}

                  {scheduleSettings.last_run_at && (
                    <Alert
                      variant="light"
                      color={
                        scheduleSettings.last_run_status === 'success' ? 'green' : 'red'
                      }
                      icon={
                        scheduleSettings.last_run_status === 'success' ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconAlertCircle size={16} />
                        )
                      }
                    >
                      <Text size="sm">
                        {t('backup.schedule.lastBackup', 'Last backup:')}{' '}
                        {new Date(scheduleSettings.last_run_at).toLocaleString()}
                        {' \u2014 '}
                        {scheduleSettings.last_run_status === 'success'
                          ? t('backup.schedule.completedSuccessfully', 'Completed successfully')
                          : t('backup.schedule.failed', 'Failed: {{error}}', { error: scheduleSettings.last_run_error || t('backup.schedule.unknownError', 'Unknown error') })}
                      </Text>
                    </Alert>
                  )}

                  <Group justify="flex-end">
                    <Button
                      variant="light"
                      leftSection={<IconDeviceFloppy size={16} />}
                      onClick={handleSaveSchedule}
                      loading={scheduleSaving}
                    >
                      {t('backup.schedule.saveSchedule', 'Save Schedule')}
                    </Button>
                  </Group>
                </Stack>
              </Card>

              <RetentionSettings
                settings={retentionSettings}
                loading={settingsLoading}
                saving={settingsSaving}
                backupCount={backups.length}
                onInputChange={handleSettingsInputChange}
                onBlur={handleSettingsBlur}
                onSave={handleSaveSettings}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Modal 1: Unsaved Settings Warning */}
        <Modal
          opened={unsavedOpened}
          onClose={closeUnsaved}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-yellow-6)" />
              <Text fw={600}>{t('backup.modals.unsavedChanges', 'Unsaved Changes')}</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
              {t('backup.modals.unsavedWarning', 'You have unsaved changes in your retention settings. Leaving this tab will discard your changes.')}
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={closeUnsaved}>
                {t('backup.modals.stayOnSettings', 'Stay on Settings')}
              </Button>
              <Button color="yellow" onClick={handleConfirmTabSwitch}>
                {t('backup.modals.discardChanges', 'Discard Changes')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal 2: Delete Backup */}
        <Modal
          opened={deleteOpened}
          onClose={() => { closeDelete(); setBackupToDelete(null); }}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text fw={600}>{t('backup.modals.deleteBackup', 'Delete Backup')}</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                {t('backup.modals.deleteConfirm', 'Are you sure you want to delete backup "{{filename}}"?', { filename: backupToDelete?.filename })}
              </Text>
              <Text size="sm">{t('backup.modals.cannotBeUndone', 'This action cannot be undone.')}</Text>
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeDelete(); setBackupToDelete(null); }}>
                {t('common:buttons.cancel', 'Cancel')}
              </Button>
              <Button color="red" onClick={handleConfirmDelete}>
                {t('common:buttons.delete', 'Delete')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal 3: Complete Cleanup (type-to-confirm) */}
        <Modal
          opened={cleanupOpened}
          onClose={() => { closeCleanup(); setCleanupConfirmText(''); }}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text fw={600}>{t('backup.modals.completeCleanup', 'Complete System Cleanup')}</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                {t('backup.modals.cleanupWarning', 'This will permanently remove:')}
              </Text>
              <List size="sm">
                <List.Item>{t('backup.modals.cleanupItems.oldBackups', 'Old backup files')}</List.Item>
                <List.Item>{t('backup.modals.cleanupItems.orphanedFiles', 'Orphaned files')}</List.Item>
                <List.Item>{t('backup.modals.cleanupItems.trashFiles', 'Trash files')}</List.Item>
              </List>
            </Alert>
            <TextInput
              label={<Text size="sm" dangerouslySetInnerHTML={{ __html: t('backup.modals.typeCleanupToConfirm', 'Type <strong>CLEANUP</strong> to confirm') }} />}
              placeholder="CLEANUP"
              value={cleanupConfirmText}
              onChange={(e) => setCleanupConfirmText(e.currentTarget.value)}
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeCleanup(); setCleanupConfirmText(''); }}>
                {t('common:buttons.cancel', 'Cancel')}
              </Button>
              <Button
                color="red"
                onClick={handleConfirmCompleteCleanup}
                disabled={cleanupConfirmText !== 'CLEANUP'}
              >
                {t('backup.modals.executeCleanup', 'Execute Cleanup')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal 4: Restore Backup */}
        <Modal
          opened={restoreOpened}
          onClose={() => { closeRestore(); setBackupToRestore(null); }}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text fw={600}>{t('backup.modals.restoreFromBackup', 'Restore from Backup')}</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                {t('backup.modals.restoreWarning', 'This will restore from backup and REPLACE current data!')}
              </Text>
              <Text size="sm">
                {t('backup.modals.restoreSafetyNote', 'A safety backup will be created automatically before the restore process begins.')}
              </Text>
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeRestore(); setBackupToRestore(null); }}>
                {t('common:buttons.cancel', 'Cancel')}
              </Button>
              <Button
                color="red"
                onClick={handleConfirmRestore}
                loading={backupToRestore && restoring[backupToRestore.id]}
              >
                {t('backup.modals.restoreNow', 'Restore Now')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal 5: Restore Preview */}
        <Modal
          opened={previewOpened}
          onClose={closePreview}
          title={
            <Group gap="xs">
              <IconEye size={20} color="var(--mantine-color-blue-6)" />
              <Text fw={600}>{t('backup.modals.restorePreview', 'Restore Preview')}</Text>
            </Group>
          }
          centered
          size="lg"
        >
          {previewLoading && (
            <Center py="xl">
              <Stack align="center">
                <Loader size="lg" />
                <Text c="dimmed" size="sm">{t('backup.modals.analyzingBackup', 'Analyzing backup contents...')}</Text>
              </Stack>
            </Center>
          )}

          {previewError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {previewError}
            </Alert>
          )}

          {previewData && !previewLoading && (
            <Stack gap="md">
              {/* Backup Details */}
              <Paper withBorder p="md">
                <Text fw={500} mb="sm">{t('backup.preview.backupDetails', 'Backup Details')}</Text>
                <Group gap="lg" wrap="wrap">
                  <div>
                    <Text size="xs" c="dimmed">{t('backup.preview.type', 'Type')}</Text>
                    <Badge variant="light" color={getTypeColor(previewData.backup_type)}>
                      {previewData.backup_type}
                    </Badge>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">{t('backup.preview.created', 'Created')}</Text>
                    <Text size="sm">{formatDateTime(previewData.backup_created)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">{t('backup.preview.size', 'Size')}</Text>
                    <Text size="sm">{formatFileSize(previewData.backup_size)}</Text>
                  </div>
                  {previewData.backup_description && (
                    <div>
                      <Text size="xs" c="dimmed">{t('backup.preview.description', 'Description')}</Text>
                      <Text size="sm">{previewData.backup_description}</Text>
                    </div>
                  )}
                </Group>
              </Paper>

              {/* Warnings */}
              {previewData.warnings?.length > 0 && (
                <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
                  <Text fw={500} mb="xs">{t('backup.preview.warnings', 'Warnings')}</Text>
                  <List size="sm">
                    {previewData.warnings.map((warning, idx) => (
                      <List.Item key={idx}>{warning}</List.Item>
                    ))}
                  </List>
                </Alert>
              )}

              {/* Affected Data */}
              <Paper withBorder p="md">
                <Text fw={500} mb="sm">{t('backup.preview.affectedData', 'Affected Data')}</Text>
                <RestorePreviewAffectedData
                  backupType={previewData.backup_type}
                  affectedData={previewData.affected_data}
                  formatFileSize={formatFileSize}
                />
              </Paper>

              <Divider />
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={closePreview}>
                  {t('common:buttons.close', 'Close')}
                </Button>
                <Button color="red" onClick={handlePreviewToRestore}>
                  {t('backup.modals.proceedWithRestore', 'Proceed with Restore')}
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
};

// Inline sub-component for restore preview affected data display
const RestorePreviewAffectedData = ({ backupType, affectedData, formatFileSize }) => {
  const { t } = useTranslation('admin');

  if (!affectedData || affectedData.error) {
    return (
      <Text size="sm" c="dimmed">
        {affectedData?.error || t('backup.preview.noAffectedData', 'No affected data information available')}
      </Text>
    );
  }

  if (backupType === 'database') {
    return (
      <Stack gap="sm">
        {affectedData.restore_method && (
          <div>
            <Text size="xs" c="dimmed">{t('backup.preview.restoreMethod', 'Restore Method')}</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.current_database && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.currentDatabase', 'Current Database')}</Text>
            <Text size="sm">
              {affectedData.current_database.total_records != null
                ? t('backup.preview.totalRecords', '{{count}} total records', { count: affectedData.current_database.total_records })
                : t('backup.preview.noStatistics', 'No statistics available')}
            </Text>
          </div>
        )}
        {affectedData.backup_content && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.backupContent', 'Backup Content')}</Text>
            <Text size="sm">
              {affectedData.backup_content.total_statements != null
                ? t('backup.preview.sqlStatements', '{{count}} SQL statements', { count: affectedData.backup_content.total_statements })
                : t('backup.preview.analysisNotAvailable', 'Backup analysis not available')}
            </Text>
          </div>
        )}
      </Stack>
    );
  }

  if (backupType === 'files') {
    return (
      <Stack gap="sm">
        {affectedData.restore_method && (
          <div>
            <Text size="xs" c="dimmed">{t('backup.preview.restoreMethod', 'Restore Method')}</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.backup_files && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.backupFiles', 'Backup Files')}</Text>
            <Text size="sm">
              {t('backup.preview.filesCount', '{{count}} files ({{size}})', { count: affectedData.backup_files.total_files, size: formatFileSize(affectedData.backup_files.total_size) })}
            </Text>
            {affectedData.backup_files.sample_files?.length > 0 && (
              <List size="xs" mt="xs">
                {affectedData.backup_files.sample_files.slice(0, 5).map((file, idx) => (
                  <List.Item key={idx}>{file.filename}</List.Item>
                ))}
                {affectedData.backup_files.sample_files.length > 5 && (
                  <List.Item>{t('backup.preview.andMore', '...and {{count}} more', { count: affectedData.backup_files.total_files - 5 })}</List.Item>
                )}
              </List>
            )}
          </div>
        )}
        {affectedData.current_files && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.currentFiles', 'Current Files')}</Text>
            <Text size="sm">{t('backup.preview.filesOnly', '{{count}} files', { count: affectedData.current_files.total_files })}</Text>
          </div>
        )}
      </Stack>
    );
  }

  if (backupType === 'full') {
    return (
      <Stack gap="sm">
        {affectedData.restore_method && (
          <div>
            <Text size="xs" c="dimmed">{t('backup.preview.restoreMethod', 'Restore Method')}</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.backup_components && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.components', 'Components')}</Text>
            <Group gap="xs">
              {affectedData.backup_components.map((comp, idx) => (
                <Badge key={idx} variant="light" size="sm">{comp}</Badge>
              ))}
            </Group>
          </div>
        )}
        {affectedData.backup_manifest && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.manifest', 'Manifest')}</Text>
            <Text size="sm">
              {t('backup.preview.createdAt', 'Created: {{date}}', { date: affectedData.backup_manifest.created_at || t('backup.existingBackups.unknown', 'Unknown') })}
            </Text>
          </div>
        )}
        {affectedData.backup_files_count != null && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.backupFiles', 'Backup Files')}</Text>
            <Text size="sm">
              {t('backup.preview.filesCount', '{{count}} files ({{size}})', { count: affectedData.backup_files_count, size: formatFileSize(affectedData.backup_files_size || 0) })}
            </Text>
          </div>
        )}
        {affectedData.current_database && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.currentDatabase', 'Current Database')}</Text>
            <Text size="sm">
              {affectedData.current_database.total_records != null
                ? t('backup.preview.totalRecords', '{{count}} total records', { count: affectedData.current_database.total_records })
                : t('backup.preview.noStatistics', 'No statistics available')}
            </Text>
          </div>
        )}
        {affectedData.current_files_count != null && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>{t('backup.preview.currentFiles', 'Current Files')}</Text>
            <Text size="sm">{t('backup.preview.filesOnly', '{{count}} files', { count: affectedData.current_files_count })}</Text>
          </div>
        )}
      </Stack>
    );
  }

  return <Text size="sm" c="dimmed">{t('backup.preview.unknownType', 'Unknown backup type')}</Text>;
};

// Retention Settings Component
const RetentionSettings = ({
  settings,
  loading,
  saving,
  backupCount,
  onInputChange,
  onBlur,
  onSave,
}) => {
  const { t } = useTranslation('admin');

  if (loading) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Card shadow="sm" p="lg" withBorder>
      <Group mb="md">
        <ThemeIcon size="lg" variant="light" color="blue">
          <IconSettings size={20} />
        </ThemeIcon>
        <Text fw={600} size="lg">{t('backup.retention.title', 'Backup Retention Settings')}</Text>
      </Group>

      <Alert color="blue" variant="light" icon={<IconShield size={16} />} mb="lg">
        <Text fw={500} mb="xs">{t('backup.retention.retentionLogic', 'Retention Logic')}</Text>
        <List size="sm">
          <List.Item>
            <span dangerouslySetInnerHTML={{ __html: t('backup.retention.countProtection', '<strong>Count Protection:</strong> Always keep the {{count}} most recent backups', { count: settings.backup_min_count }) }} />
          </List.Item>
          <List.Item>
            <span dangerouslySetInnerHTML={{ __html: t('backup.retention.timeBasedCleanup', '<strong>Time-based Cleanup:</strong> Delete backups older than {{days}} days (beyond minimum count)', { days: settings.backup_retention_days }) }} />
          </List.Item>
          <List.Item>
            <span dangerouslySetInnerHTML={{ __html: t('backup.retention.priority', '<strong>Priority:</strong> Minimum count always takes precedence over time limits') }} />
          </List.Item>
          <List.Item>
            <span dangerouslySetInnerHTML={{ __html: t('backup.retention.currentStatus', '<strong>Current Status:</strong> {{count}} backups stored (max: {{max}})', { count: backupCount, max: settings.backup_max_count }) }} />
          </List.Item>
        </List>
      </Alert>

      <Stack gap="lg">
        {/* Retention Days */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>{t('backup.retention.retentionDays', 'Backup Retention (Days)')}</Text>
            <Text size="sm" c="dimmed">{t('backup.retention.retentionDaysDesc', 'Delete backups older than this many days (beyond minimum count)')}</Text>
          </Stack>
          <NumberInput
            w={160}
            min={1}
            max={365}
            value={settings.backup_retention_days}
            onChange={(val) => onInputChange('backup_retention_days', val)}
            onBlur={() => onBlur('backup_retention_days')}
            rightSection={<Text size="xs" c="dimmed">{t('backup.retention.daysUnit', 'days')}</Text>}
            aria-label={t('backup.retention.retentionDays', 'Backup Retention (Days)')}
          />
        </Group>

        {/* Minimum Count */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>{t('backup.retention.minimumCount', 'Minimum Backup Count')}</Text>
            <Text size="sm" c="dimmed">{t('backup.retention.minimumCountDesc', 'Always keep at least this many backups (regardless of age)')}</Text>
          </Stack>
          <NumberInput
            w={160}
            min={1}
            max={100}
            value={settings.backup_min_count}
            onChange={(val) => onInputChange('backup_min_count', val)}
            onBlur={() => onBlur('backup_min_count')}
            rightSection={<Text size="xs" c="dimmed">{t('backup.retention.backupsUnit', 'backups')}</Text>}
            aria-label={t('backup.retention.minimumCount', 'Minimum Backup Count')}
          />
        </Group>

        {/* Maximum Count */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>{t('backup.retention.maximumCount', 'Maximum Backup Count')}</Text>
            <Text size="sm" c="dimmed">{t('backup.retention.maximumCountDesc', 'Alert when backup count exceeds this limit (optional)')}</Text>
          </Stack>
          <NumberInput
            w={160}
            min={5}
            max={500}
            value={settings.backup_max_count}
            onChange={(val) => onInputChange('backup_max_count', val)}
            onBlur={() => onBlur('backup_max_count')}
            rightSection={<Text size="xs" c="dimmed">{t('backup.retention.backupsUnit', 'backups')}</Text>}
            aria-label={t('backup.retention.maximumCount', 'Maximum Backup Count')}
          />
        </Group>
      </Stack>

      <Divider my="lg" />
      <Group justify="flex-end">
        <Button
          loading={saving}
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={onSave}
        >
          {t('backup.retention.saveRetention', 'Save Retention Settings')}
        </Button>
      </Group>
    </Card>
  );
};

export default BackupManagement;
