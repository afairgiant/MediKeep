import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Paper,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  ThemeIcon,
  TextInput,
  Select,
  Table,
  ScrollArea,
  Button,
  Alert,
  Loader,
  Center,
  Tooltip,
  Modal,
  ActionIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconTrash,
  IconSearch,
  IconRefresh,
  IconAlertCircle,
  IconFilterOff,
  IconRestore,
  IconTrashX,
  IconFile,
  IconAlertTriangle,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';

interface TrashItem {
  filename: string;
  trash_path: string;
  original_path?: string;
  deleted_at?: string;
  reason?: string;
  size_bytes?: number;
}

interface CleanupResult {
  deleted_files?: number;
  deleted_dirs?: number;
}

interface ConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel: string;
  confirmColor: string;
  confirmIcon: React.ReactNode;
  loading: boolean;
  warning?: string;
  children: React.ReactNode;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const clamped = Math.min(index, units.length - 1);
  const value = bytes / Math.pow(1024, clamped);
  return `${value.toFixed(clamped === 0 ? 0 : 1)} ${units[clamped]}`;
}

function getTotalSize(items: TrashItem[]): number {
  return items.reduce((sum, item) => sum + (item.size_bytes || 0), 0);
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function pluralFiles(count: number): string {
  return count === 1 ? 'file' : 'files';
}

function getFileExtension(filename: string): string | null {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return null;
  return filename.slice(dotIndex + 1).toLowerCase();
}

function ConfirmationModal({
  opened,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  confirmColor,
  confirmIcon,
  loading,
  warning,
  children,
}: ConfirmationModalProps): React.ReactElement {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        {warning && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
            {warning}
          </Alert>
        )}
        {children}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color={confirmColor}
            onClick={onConfirm}
            loading={loading}
            leftSection={confirmIcon}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function TrashManagement(): React.ReactElement {
  const { formatDateTime } = useDateFormat();

  // Data
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (client-side)
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Action states
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  // Modal states
  const [restoreTarget, setRestoreTarget] = useState<TrashItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);

  const fetchTrashContents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await adminApiService.listTrashContents();
      let items: TrashItem[] = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (Array.isArray(response?.items)) {
        items = response.items;
      } else if (Array.isArray(response?.data)) {
        items = response.data;
      }
      setTrashItems(items);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load trash contents');
      setError(message);
      logger.error('trash_fetch_error', 'Failed to fetch trash contents', {
        component: 'TrashManagement',
        error: message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrashContents();
  }, [fetchTrashContents]);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget) return;
    setRestoring(restoreTarget.trash_path);
    try {
      await adminApiService.restoreFromTrash(restoreTarget.trash_path);
      notifications.show({
        title: 'File restored',
        message: `${restoreTarget.filename} restored to original location`,
        color: 'green',
      });
      setRestoreTarget(null);
      await fetchTrashContents();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to restore file');
      notifications.show({ title: 'Restore failed', message, color: 'red' });
      logger.error('trash_restore_error', 'Failed to restore file from trash', {
        component: 'TrashManagement',
        error: message,
      });
    } finally {
      setRestoring(null);
    }
  }, [restoreTarget, fetchTrashContents]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.trash_path);
    try {
      await adminApiService.permanentlyDeleteFromTrash(deleteTarget.trash_path);
      notifications.show({
        title: 'File deleted',
        message: `${deleteTarget.filename} permanently deleted`,
        color: 'green',
      });
      setDeleteTarget(null);
      await fetchTrashContents();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to permanently delete file');
      notifications.show({ title: 'Delete failed', message, color: 'red' });
      logger.error('trash_delete_error', 'Failed to permanently delete file from trash', {
        component: 'TrashManagement',
        error: message,
      });
    } finally {
      setDeleting(null);
    }
  }, [deleteTarget, fetchTrashContents]);

  const confirmPurge = useCallback(async () => {
    setPurging(true);
    try {
      const result: CleanupResult = await adminApiService.cleanupTrash();
      const deletedFiles = result?.deleted_files ?? 0;
      const deletedDirs = result?.deleted_dirs ?? 0;
      const dirsSuffix = deletedDirs > 0 ? ` across ${deletedDirs} ${deletedDirs === 1 ? 'directory' : 'directories'}` : '';
      notifications.show({
        title: 'Trash purged',
        message: `${deletedFiles} expired ${pluralFiles(deletedFiles)} permanently deleted${dirsSuffix}`,
        color: 'green',
      });
      setPurgeModalOpen(false);
      await fetchTrashContents();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to purge expired files');
      notifications.show({ title: 'Purge failed', message, color: 'red' });
      logger.error('trash_purge_error', 'Failed to purge expired trash files', {
        component: 'TrashManagement',
        error: message,
      });
    } finally {
      setPurging(false);
    }
  }, [fetchTrashContents]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    return trashItems.filter((item) => {
      if (
        search &&
        !item.filename.toLowerCase().includes(search.toLowerCase()) &&
        !item.original_path?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (dateRange[0] || dateRange[1]) {
        const parsed = item.deleted_at && item.deleted_at !== 'Unknown'
          ? new Date(item.deleted_at)
          : null;
        if (parsed && !Number.isNaN(parsed.getTime())) {
          if (dateRange[0] && parsed < dateRange[0]) return false;
          if (dateRange[1] && parsed > dateRange[1]) return false;
        }
      }
      if (typeFilter) {
        const ext = getFileExtension(item.filename);
        if (ext !== typeFilter) return false;
      }
      return true;
    });
  }, [trashItems, search, dateRange, typeFilter]);

  const fileTypeOptions = useMemo(() => {
    const extensions = new Set<string>();
    trashItems.forEach((item) => {
      const ext = getFileExtension(item.filename);
      if (ext) extensions.add(ext);
    });
    return Array.from(extensions)
      .sort()
      .map((ext) => ({ value: ext, label: `.${ext}` }));
  }, [trashItems]);

  const hasActiveFilters = search || dateRange[0] || dateRange[1] || typeFilter;

  const handleClearFilters = () => {
    setSearch('');
    setDateRange([null, null]);
    setTypeFilter(null);
  };

  const totalSize = formatFileSize(getTotalSize(trashItems));

  return (
    <AdminLayout>
      <Stack gap="lg">
        {/* Header */}
        <Card shadow="sm" p="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <ThemeIcon size="xl" variant="light" color="yellow">
                  <IconTrash size={24} />
                </ThemeIcon>
                <Title order={2}>Trash Management</Title>
              </Group>
              <Text c="dimmed" size="md">
                Manage deleted uploaded files. Restore files to their original location or
                permanently remove them to free up storage.
              </Text>
              <Group mt="sm" gap="xs">
                <Badge variant="light" color="yellow">
                  {trashItems.length} {pluralFiles(trashItems.length)}
                </Badge>
                <Badge variant="light" color="gray">
                  {totalSize} total
                </Badge>
              </Group>
            </div>
            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={fetchTrashContents}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                leftSection={<IconTrashX size={16} />}
                color="red"
                variant="light"
                onClick={() => setPurgeModalOpen(true)}
              >
                Purge Expired
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Filters */}
        <Paper shadow="xs" p="md" withBorder>
          <Group grow align="flex-end">
            <TextInput
              placeholder="Search by filename or path..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              aria-label="Search trash files"
            />
            <DatePickerInput
              type="range"
              placeholder="Deleted date range"
              value={dateRange}
              onChange={setDateRange}
              clearable
              aria-label="Filter by deleted date range"
            />
            <Select
              placeholder="File type"
              data={fileTypeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              searchable
              aria-label="Filter by file type"
            />
            {hasActiveFilters && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconFilterOff size={16} />}
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
            )}
          </Group>
        </Paper>

        {/* Results Info */}
        {!loading && (
          <Text size="sm" c="dimmed">
            Showing {filteredItems.length} of {trashItems.length}{' '}
            {pluralFiles(trashItems.length)}
            {hasActiveFilters ? ' (filtered)' : ''}
          </Text>
        )}

        {/* Error State */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error loading trash" color="red">
            {error}
            <Button variant="subtle" size="xs" mt="xs" onClick={fetchTrashContents}>
              Retry
            </Button>
          </Alert>
        )}

        {/* Initial Loading State */}
        {loading && trashItems.length === 0 && (
          <Center py="xl">
            <Stack align="center">
              <Loader size="lg" />
              <Text c="dimmed">Loading trash contents...</Text>
            </Stack>
          </Center>
        )}

        {/* Data Table */}
        {(!loading || trashItems.length > 0) && !error && (
          <Paper shadow="xs" withBorder style={{ position: 'relative' }}>
            {loading && trashItems.length > 0 && (
              <Center
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255,255,255,0.7)',
                  zIndex: 10,
                }}
              >
                <Loader size="sm" />
              </Center>
            )}
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Filename</Table.Th>
                    <Table.Th>Original Location</Table.Th>
                    <Table.Th>Deleted</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <Table.Tr key={item.trash_path || item.filename}>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon size="sm" variant="light" color="gray">
                              <IconFile size={12} />
                            </ThemeIcon>
                            <Text size="sm" fw={500}>
                              {item.filename}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 260 }}>
                          {item.original_path ? (
                            <Tooltip
                              label={item.original_path}
                              disabled={item.original_path.length <= 50}
                              multiline
                              w={320}
                            >
                              <Text size="sm" c="dimmed" lineClamp={1}>
                                {item.original_path}
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text size="sm" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm">
                            {item.deleted_at ? formatDateTime(item.deleted_at) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.reason || 'Manual deletion'}</Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm">{formatFileSize(item.size_bytes)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Tooltip label="Restore to original location">
                              <ActionIcon
                                variant="light"
                                color="green"
                                size="sm"
                                onClick={() => setRestoreTarget(item)}
                                loading={restoring === item.trash_path}
                                aria-label={`Restore ${item.filename}`}
                              >
                                <IconRestore size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Permanently delete">
                              <ActionIcon
                                variant="light"
                                color="red"
                                size="sm"
                                onClick={() => setDeleteTarget(item)}
                                loading={deleting === item.trash_path}
                                aria-label={`Permanently delete ${item.filename}`}
                              >
                                <IconTrashX size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Center py="xl">
                          <Stack align="center">
                            <ThemeIcon size="xl" variant="light" color="gray">
                              <IconTrash size={24} />
                            </ThemeIcon>
                            <Text c="dimmed" size="sm">
                              {hasActiveFilters
                                ? 'No files match your filters'
                                : 'No files in trash'}
                            </Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}
      </Stack>

      {/* Restore Confirmation Modal */}
      <ConfirmationModal
        opened={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Restore File"
        confirmLabel="Restore"
        confirmColor="green"
        confirmIcon={<IconRestore size={16} />}
        loading={restoring !== null}
      >
        <Text size="sm">
          Are you sure you want to restore{' '}
          <Text component="span" fw={600}>
            {restoreTarget?.filename}
          </Text>
          {restoreTarget?.original_path && (
            <>
              {' '}
              to{' '}
              <Text component="span" c="dimmed" size="xs">
                {restoreTarget.original_path}
              </Text>
            </>
          )}
          ?
        </Text>
      </ConfirmationModal>

      {/* Permanent Delete Confirmation Modal */}
      <ConfirmationModal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Permanently Delete File"
        confirmLabel="Delete Permanently"
        confirmColor="red"
        confirmIcon={<IconTrashX size={16} />}
        loading={deleting !== null}
        warning="This action cannot be undone. The file will be permanently removed from the system."
      >
        <Text size="sm">
          Are you sure you want to permanently delete{' '}
          <Text component="span" fw={600}>
            {deleteTarget?.filename}
          </Text>
          ?
        </Text>
      </ConfirmationModal>

      {/* Purge Expired Files Confirmation Modal */}
      <ConfirmationModal
        opened={purgeModalOpen}
        onClose={() => setPurgeModalOpen(false)}
        onConfirm={confirmPurge}
        title="Purge Expired Files"
        confirmLabel="Purge Expired"
        confirmColor="red"
        confirmIcon={<IconTrashX size={16} />}
        loading={purging}
        warning="This will permanently delete all expired files from the trash. This action cannot be undone."
      >
        <Text size="sm">
          Files that have exceeded the retention period will be removed. Currently there{' '}
          {trashItems.length === 1 ? 'is' : 'are'}{' '}
          <Text component="span" fw={600}>
            {trashItems.length} {pluralFiles(trashItems.length)}
          </Text>{' '}
          in the trash totalling{' '}
          <Text component="span" fw={600}>
            {totalSize}
          </Text>
          .
        </Text>
      </ConfirmationModal>
    </AdminLayout>
  );
}

export default TrashManagement;
