import logger from '../../services/logger';

import React, { useState, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminData } from '../../hooks/useAdminData';
import { useBackupNotifications } from '../../hooks/useBackupNotifications';
import { adminApiService } from '../../services/api/adminApi';
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
  const { formatDateTime } = useDateFormat();
  const [creating, setCreating] = useState({});
  const [restoring, setRestoring] = useState({});
  const [uploading, setUploading] = useState(false);
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
      showWarning('Invalid File Type', 'Please select a .sql or .zip backup file.');
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

  if (loading && !backupData) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">Loading backup management...</Text>
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
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Error">
              {error}
            </Alert>
            <Button onClick={() => refreshData()}>Retry</Button>
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
                <Title order={2}>Backup Management</Title>
                <Text c="dimmed" size="sm">Create and manage system backups</Text>
              </div>
            </Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={refreshData}
              loading={loading}
              variant="light"
            >
              Refresh
            </Button>
          </Group>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List mb="xl">
            <Tabs.Tab value="backups" leftSection={<IconDeviceFloppy size={16} />}>
              Backups
            </Tabs.Tab>
            <Tabs.Tab
              value="settings"
              leftSection={<IconSettings size={16} />}
              rightSection={
                hasUnsavedChanges
                  ? <Badge size="xs" color="yellow" variant="filled">Unsaved</Badge>
                  : null
              }
            >
              Settings
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
                <Text fw={600} size="lg">Backup Operations</Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                {/* Full Backup */}
                <Card withBorder p="md">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="cyan">
                      <IconDatabaseExport size={24} />
                    </ThemeIcon>
                    <Text fw={500} ta="center">Full System Backup</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      Complete backup (database + files)
                    </Text>
                    <Button
                      fullWidth
                      loading={creating.full}
                      onClick={() => handleCreateBackup('full')}
                      leftSection={<IconDatabaseExport size={16} />}
                    >
                      Create Full Backup
                    </Button>
                  </Stack>
                </Card>

                {/* Upload */}
                <Card withBorder p="md">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="blue">
                      <IconUpload size={24} />
                    </ThemeIcon>
                    <Text fw={500} ta="center">Upload Backup</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      Upload an external backup file (.sql or .zip)
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
                          Choose Backup File
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
                    <Text fw={500} ta="center">Advanced Options</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      Additional backup and cleanup operations
                    </Text>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <Button
                          fullWidth
                          variant="light"
                          leftSection={<IconDotsVertical size={16} />}
                        >
                          More Options
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconDatabase size={16} />}
                          onClick={() => handleCreateBackup('database')}
                          disabled={creating.database}
                        >
                          {creating.database ? 'Creating...' : 'Database Only'}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconFiles size={16} />}
                          onClick={() => handleCreateBackup('files')}
                          disabled={creating.files}
                        >
                          {creating.files ? 'Creating...' : 'Files Only'}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<IconEraser size={16} />}
                          onClick={handleCleanupBackups}
                          disabled={loading}
                        >
                          Cleanup Old Backups
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={handleOpenCleanupModal}
                          disabled={loading}
                        >
                          Complete Cleanup
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
                  <Text fw={600} size="lg">Existing Backups</Text>
                </Group>
                <Text size="sm" c="dimmed">{backups.length} backup{backups.length !== 1 ? 's' : ''}</Text>
              </Group>

              {backups.length === 0 ? (
                <Center py="xl">
                  <Stack align="center">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconInbox size={24} />
                    </ThemeIcon>
                    <Text c="dimmed">No backups found</Text>
                  </Stack>
                </Center>
              ) : (
                <Paper withBorder>
                  <ScrollArea>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Filename</Table.Th>
                          <Table.Th>Size</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Created</Table.Th>
                          <Table.Th>File Exists</Table.Th>
                          <Table.Th>Actions</Table.Th>
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
                              <Text size="sm">{backup.size_bytes ? formatFileSize(backup.size_bytes) : 'Unknown'}</Text>
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
                                {backup.file_exists ? 'Yes' : 'No'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                {backup.file_exists && (
                                  <Tooltip label="Download">
                                    <ActionIcon
                                      variant="subtle"
                                      color="green"
                                      onClick={() => handleDownloadBackup(backup.id, backup.filename)}
                                      aria-label="Download backup"
                                    >
                                      <IconDownload size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label="Verify">
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => handleVerifyBackup(backup.id)}
                                    aria-label="Verify backup"
                                  >
                                    <IconShieldCheck size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                {backup.file_exists && (
                                  <Tooltip label="Preview restore">
                                    <ActionIcon
                                      variant="subtle"
                                      color="cyan"
                                      onClick={() => handlePreviewRestore(backup.id)}
                                      aria-label="Preview restore"
                                    >
                                      <IconEye size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label="Delete">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteClick(backup.id, backup.filename)}
                                    aria-label="Delete backup"
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                {backup.file_exists && (
                                  <Tooltip label="Restore">
                                    <ActionIcon
                                      variant="subtle"
                                      color="orange"
                                      onClick={() => handleRestoreClick(backup.id, backup.backup_type)}
                                      disabled={restoring[backup.id]}
                                      aria-label="Restore backup"
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
                    Auto-Backup Schedule
                  </Text>
                  <Badge
                    variant="light"
                    color={scheduleSettings.enabled ? 'green' : 'gray'}
                  >
                    {scheduleSettings.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </Group>

                <Stack>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={500}>Backup Frequency</Text>
                      <Text size="sm" c="dimmed">
                        Schedule automatic full backups (database + files)
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
                      data={[
                        { value: 'disabled', label: 'Disabled' },
                        { value: 'every_6_hours', label: 'Every 6 hours' },
                        { value: 'every_12_hours', label: 'Every 12 hours' },
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                      ]}
                    />
                  </Group>

                  {(scheduleSettings.preset === 'daily' ||
                    scheduleSettings.preset === 'weekly') && (
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text fw={500}>Time of Day</Text>
                        <Text size="sm" c="dimmed">
                          When should the backup run? (24-hour format)
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
                        <Text fw={500}>Day of Week</Text>
                        <Text size="sm" c="dimmed">
                          Which day should the weekly backup run?
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
                        data={[
                          { value: 'mon', label: 'Monday' },
                          { value: 'tue', label: 'Tuesday' },
                          { value: 'wed', label: 'Wednesday' },
                          { value: 'thu', label: 'Thursday' },
                          { value: 'fri', label: 'Friday' },
                          { value: 'sat', label: 'Saturday' },
                          { value: 'sun', label: 'Sunday' },
                        ]}
                        leftSection={<IconCalendarEvent size={16} />}
                      />
                    </Group>
                  )}

                  {scheduleSettings.next_run_at && scheduleSettings.enabled && (
                    <Group justify="space-between">
                      <Text fw={500}>Next Scheduled Run</Text>
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
                        Last backup:{' '}
                        {new Date(scheduleSettings.last_run_at).toLocaleString()}
                        {' \u2014 '}
                        {scheduleSettings.last_run_status === 'success'
                          ? 'Completed successfully'
                          : `Failed: ${scheduleSettings.last_run_error || 'Unknown error'}`}
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
                      Save Schedule
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
              <Text fw={600}>Unsaved Changes</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
              You have unsaved changes in your retention settings. Leaving this tab will discard your changes.
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={closeUnsaved}>
                Stay on Settings
              </Button>
              <Button color="yellow" onClick={handleConfirmTabSwitch}>
                Discard Changes
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
              <Text fw={600}>Delete Backup</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                Are you sure you want to delete backup &quot;{backupToDelete?.filename}&quot;?
              </Text>
              <Text size="sm">This action cannot be undone.</Text>
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeDelete(); setBackupToDelete(null); }}>
                Cancel
              </Button>
              <Button color="red" onClick={handleConfirmDelete}>
                Delete
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
              <Text fw={600}>Complete System Cleanup</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                This will permanently remove:
              </Text>
              <List size="sm">
                <List.Item>Old backup files</List.Item>
                <List.Item>Orphaned files</List.Item>
                <List.Item>Trash files</List.Item>
              </List>
            </Alert>
            <TextInput
              label={<Text size="sm">Type <strong>CLEANUP</strong> to confirm</Text>}
              placeholder="CLEANUP"
              value={cleanupConfirmText}
              onChange={(e) => setCleanupConfirmText(e.currentTarget.value)}
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeCleanup(); setCleanupConfirmText(''); }}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleConfirmCompleteCleanup}
                disabled={cleanupConfirmText !== 'CLEANUP'}
              >
                Execute Cleanup
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
              <Text fw={600}>Restore from Backup</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500} mb="xs">
                This will restore from backup and REPLACE current data!
              </Text>
              <Text size="sm">
                A safety backup will be created automatically before the restore process begins.
              </Text>
            </Alert>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeRestore(); setBackupToRestore(null); }}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleConfirmRestore}
                loading={backupToRestore && restoring[backupToRestore.id]}
              >
                Restore Now
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
              <Text fw={600}>Restore Preview</Text>
            </Group>
          }
          centered
          size="lg"
        >
          {previewLoading && (
            <Center py="xl">
              <Stack align="center">
                <Loader size="lg" />
                <Text c="dimmed" size="sm">Analyzing backup contents...</Text>
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
                <Text fw={500} mb="sm">Backup Details</Text>
                <Group gap="lg" wrap="wrap">
                  <div>
                    <Text size="xs" c="dimmed">Type</Text>
                    <Badge variant="light" color={getTypeColor(previewData.backup_type)}>
                      {previewData.backup_type}
                    </Badge>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Created</Text>
                    <Text size="sm">{formatDateTime(previewData.backup_created)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Size</Text>
                    <Text size="sm">{formatFileSize(previewData.backup_size)}</Text>
                  </div>
                  {previewData.backup_description && (
                    <div>
                      <Text size="xs" c="dimmed">Description</Text>
                      <Text size="sm">{previewData.backup_description}</Text>
                    </div>
                  )}
                </Group>
              </Paper>

              {/* Warnings */}
              {previewData.warnings?.length > 0 && (
                <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
                  <Text fw={500} mb="xs">Warnings</Text>
                  <List size="sm">
                    {previewData.warnings.map((warning, idx) => (
                      <List.Item key={idx}>{warning}</List.Item>
                    ))}
                  </List>
                </Alert>
              )}

              {/* Affected Data */}
              <Paper withBorder p="md">
                <Text fw={500} mb="sm">Affected Data</Text>
                <RestorePreviewAffectedData
                  backupType={previewData.backup_type}
                  affectedData={previewData.affected_data}
                  formatFileSize={formatFileSize}
                />
              </Paper>

              <Divider />
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={closePreview}>
                  Close
                </Button>
                <Button color="red" onClick={handlePreviewToRestore}>
                  Proceed with Restore
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
  if (!affectedData || affectedData.error) {
    return (
      <Text size="sm" c="dimmed">
        {affectedData?.error || 'No affected data information available'}
      </Text>
    );
  }

  if (backupType === 'database') {
    return (
      <Stack gap="sm">
        {affectedData.restore_method && (
          <div>
            <Text size="xs" c="dimmed">Restore Method</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.current_database && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Current Database</Text>
            <Text size="sm">
              {affectedData.current_database.total_records != null
                ? `${affectedData.current_database.total_records} total records`
                : 'No statistics available'}
            </Text>
          </div>
        )}
        {affectedData.backup_content && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Backup Content</Text>
            <Text size="sm">
              {affectedData.backup_content.total_statements != null
                ? `${affectedData.backup_content.total_statements} SQL statements`
                : 'Backup analysis not available'}
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
            <Text size="xs" c="dimmed">Restore Method</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.backup_files && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Backup Files</Text>
            <Text size="sm">
              {affectedData.backup_files.total_files} files ({formatFileSize(affectedData.backup_files.total_size)})
            </Text>
            {affectedData.backup_files.sample_files?.length > 0 && (
              <List size="xs" mt="xs">
                {affectedData.backup_files.sample_files.slice(0, 5).map((file, idx) => (
                  <List.Item key={idx}>{file.filename}</List.Item>
                ))}
                {affectedData.backup_files.sample_files.length > 5 && (
                  <List.Item>...and {affectedData.backup_files.total_files - 5} more</List.Item>
                )}
              </List>
            )}
          </div>
        )}
        {affectedData.current_files && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Current Files</Text>
            <Text size="sm">{affectedData.current_files.total_files} files</Text>
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
            <Text size="xs" c="dimmed">Restore Method</Text>
            <Text size="sm">{affectedData.restore_method}</Text>
          </div>
        )}
        {affectedData.backup_components && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Components</Text>
            <Group gap="xs">
              {affectedData.backup_components.map((comp, idx) => (
                <Badge key={idx} variant="light" size="sm">{comp}</Badge>
              ))}
            </Group>
          </div>
        )}
        {affectedData.backup_manifest && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Manifest</Text>
            <Text size="sm">
              Created: {affectedData.backup_manifest.created_at || 'Unknown'}
            </Text>
          </div>
        )}
        {affectedData.backup_files_count != null && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Backup Files</Text>
            <Text size="sm">
              {affectedData.backup_files_count} files ({formatFileSize(affectedData.backup_files_size || 0)})
            </Text>
          </div>
        )}
        {affectedData.current_database && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Current Database</Text>
            <Text size="sm">
              {affectedData.current_database.total_records != null
                ? `${affectedData.current_database.total_records} total records`
                : 'No statistics available'}
            </Text>
          </div>
        )}
        {affectedData.current_files_count != null && (
          <div>
            <Text size="xs" c="dimmed" fw={500}>Current Files</Text>
            <Text size="sm">{affectedData.current_files_count} files</Text>
          </div>
        )}
      </Stack>
    );
  }

  return <Text size="sm" c="dimmed">Unknown backup type</Text>;
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
        <Text fw={600} size="lg">Backup Retention Settings</Text>
      </Group>

      <Alert color="blue" variant="light" icon={<IconShield size={16} />} mb="lg">
        <Text fw={500} mb="xs">Retention Logic</Text>
        <List size="sm">
          <List.Item>
            <strong>Count Protection:</strong> Always keep the {settings.backup_min_count} most recent backups
          </List.Item>
          <List.Item>
            <strong>Time-based Cleanup:</strong> Delete backups older than {settings.backup_retention_days} days (beyond minimum count)
          </List.Item>
          <List.Item>
            <strong>Priority:</strong> Minimum count always takes precedence over time limits
          </List.Item>
          <List.Item>
            <strong>Current Status:</strong> {backupCount} backup{backupCount !== 1 ? 's' : ''} stored (max: {settings.backup_max_count})
          </List.Item>
        </List>
      </Alert>

      <Stack gap="lg">
        {/* Retention Days */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>Backup Retention (Days)</Text>
            <Text size="sm" c="dimmed">Delete backups older than this many days (beyond minimum count)</Text>
          </Stack>
          <NumberInput
            w={160}
            min={1}
            max={365}
            value={settings.backup_retention_days}
            onChange={(val) => onInputChange('backup_retention_days', val)}
            onBlur={() => onBlur('backup_retention_days')}
            rightSection={<Text size="xs" c="dimmed">days</Text>}
            aria-label="Backup retention days"
          />
        </Group>

        {/* Minimum Count */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>Minimum Backup Count</Text>
            <Text size="sm" c="dimmed">Always keep at least this many backups (regardless of age)</Text>
          </Stack>
          <NumberInput
            w={160}
            min={1}
            max={100}
            value={settings.backup_min_count}
            onChange={(val) => onInputChange('backup_min_count', val)}
            onBlur={() => onBlur('backup_min_count')}
            rightSection={<Text size="xs" c="dimmed">backups</Text>}
            aria-label="Minimum backup count"
          />
        </Group>

        {/* Maximum Count */}
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={500}>Maximum Backup Count</Text>
            <Text size="sm" c="dimmed">Alert when backup count exceeds this limit (optional)</Text>
          </Stack>
          <NumberInput
            w={160}
            min={5}
            max={500}
            value={settings.backup_max_count}
            onChange={(val) => onInputChange('backup_max_count', val)}
            onBlur={() => onBlur('backup_max_count')}
            rightSection={<Text size="xs" c="dimmed">backups</Text>}
            aria-label="Maximum backup count"
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
          Save Retention Settings
        </Button>
      </Group>
    </Card>
  );
};

export default BackupManagement;
