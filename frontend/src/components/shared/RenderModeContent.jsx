import { memo } from 'react';
import {
  Stack,
  Paper,
  Title,
  Text,
  Group,
  Button,
  Center,
  Loader,
  ActionIcon,
  ThemeIcon,
  TextInput,
  Badge,
  Menu,
} from '@mantine/core';
import {
  IconUpload,
  IconRefresh,
  IconX,
  IconFileText,
  IconCheck,
  IconLink,
  IconChevronDown,
} from '@tabler/icons-react';

import { useTranslation } from 'react-i18next';
import FileList from './FileList';
import StorageBackendSelector from './StorageBackendSelector';

/**
 * Performance optimization: Extracted render logic into separate memoized component
 * This reduces the main component size and prevents unnecessary re-renders of the UI
 * when only internal state changes (like progress tracking) occur.
 */
const RenderModeContent = memo(
  ({
    mode,
    loading,
    files,
    paperlessLoading,
    selectedStorageBackend,
    onStorageBackendChange,
    paperlessSettings,
    syncStatus,
    syncLoading,
    pendingFiles,
    pendingLinks = [],
    filesToDelete,
    onUploadModalOpen,
    onLinkModalOpen,
    onPapraLinkModalOpen,
    onCheckSyncStatus,
    onDownloadFile,
    onViewFile,
    onImmediateDelete,
    onMarkFileForDeletion,
    onUnmarkFileForDeletion,
    onRemovePendingFile,
    onPendingFileDescriptionChange,
    onRemovePendingLink,
    onPendingLinkDescriptionChange,
  }) => {
    const { t } = useTranslation('documents');
    if (loading && files.length === 0) {
      return (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Loading files...</Text>
          </Stack>
        </Center>
      );
    }

    const hasRemoteFiles = files.some(
      f => f.storage_backend === 'paperless' || f.storage_backend === 'papra'
    );

    const storageBackendSelector = !paperlessLoading && (
      <Stack gap="xs">
        <StorageBackendSelector
          value={selectedStorageBackend}
          onChange={onStorageBackendChange}
          paperlessEnabled={paperlessSettings?.paperless_enabled || false}
          paperlessConnected={
            paperlessSettings?.paperless_enabled &&
            paperlessSettings?.paperless_url &&
            (paperlessSettings?.paperless_has_credentials ||
              paperlessSettings?.paperless_has_token)
          }
          papraEnabled={paperlessSettings?.papra_enabled || false}
          papraConnected={
            paperlessSettings?.papra_enabled &&
            paperlessSettings?.papra_url &&
            paperlessSettings?.papra_has_token
          }
          disabled={loading}
          size="sm"
        />
        {paperlessSettings?.paperless_auto_sync && (
          <Badge
            size="xs"
            color="green"
            variant="light"
            leftSection={<IconCheck size={10} />}
          >
            {t('paperlessStatus.autoSyncEnabled')}
          </Badge>
        )}
      </Stack>
    );

    const addDocumentMenu = label => (
      <Paper withBorder p="md" bg="var(--color-bg-secondary)">
        <Group justify="space-between" align="center">
          <Text fw={500}>{label}</Text>
          <Menu position="bottom-end" shadow="md" withinPortal zIndex={3000}>
            <Menu.Target>
              <Button
                type="button"
                rightSection={<IconChevronDown size={16} />}
                disabled={loading}
              >
                {t('manager.addDocument')}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconUpload size={16} />}
                onClick={onUploadModalOpen}
              >
                {t('manager.uploadNewFile')}
              </Menu.Item>
              {paperlessSettings?.paperless_enabled && (
                <Menu.Item
                  leftSection={<IconLink size={16} />}
                  onClick={onLinkModalOpen}
                >
                  {t('manager.linkPaperless')}
                </Menu.Item>
              )}
              {paperlessSettings?.papra_enabled && (
                <Menu.Item
                  leftSection={<IconLink size={16} />}
                  onClick={onPapraLinkModalOpen}
                >
                  {t('manager.linkPapra')}
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Paper>
    );

    const syncCheckButton = hasRemoteFiles && (
      <Button
        type="button"
        variant="light"
        size="xs"
        leftSection={<IconRefresh size={14} />}
        loading={syncLoading}
        onClick={onCheckSyncStatus}
        title="Check sync status with remote storage"
      >
        {t('manager.syncCheck')}
      </Button>
    );

    const pendingFilesList = pendingFiles.length > 0 && (
      <Stack gap="md">
        <Title order={5}>{t('manager.filesToUpload')}</Title>
        <Stack gap="sm">
          {pendingFiles.map(pendingFile => (
            <Paper key={pendingFile.id} withBorder p="sm" bg="blue.1">
              <Group justify="space-between" align="flex-start">
                <Group gap="xs" style={{ flex: 1 }}>
                  <ThemeIcon variant="light" color="blue" size="sm">
                    <IconFileText size={14} />
                  </ThemeIcon>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="md">
                      <Text fw={500} size="sm">
                        {pendingFile.file.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {(pendingFile.file.size / 1024).toFixed(1)} KB
                      </Text>
                    </Group>
                    {mode === 'edit' && (
                      <TextInput
                        placeholder="Description (optional)"
                        value={pendingFile.description}
                        onChange={e =>
                          onPendingFileDescriptionChange(
                            pendingFile.id,
                            e.target.value
                          )
                        }
                        size="xs"
                      />
                    )}
                  </Stack>
                </Group>
                <ActionIcon
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={() => onRemovePendingFile(pendingFile.id)}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    );

    const pendingLinksList = pendingLinks.length > 0 && (
      <Stack gap="md">
        <Title order={5}>{t('manager.documentsToLink')}</Title>
        <Stack gap="sm">
          {pendingLinks.map(pendingLink => (
            <Paper key={pendingLink.id} withBorder p="sm" bg="grape.1">
              <Group justify="space-between" align="flex-start">
                <Group gap="xs" style={{ flex: 1 }}>
                  <ThemeIcon variant="light" color="grape" size="sm">
                    <IconLink size={14} />
                  </ThemeIcon>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="md">
                      <Text fw={500} size="sm">
                        {pendingLink.displayTitle}
                      </Text>
                      <Badge size="xs" color="grape" variant="light">
                        {pendingLink.source === 'papra' ? 'Papra' : 'Paperless'}
                      </Badge>
                    </Group>
                    {onPendingLinkDescriptionChange && (
                      <TextInput
                        placeholder={t('manager.linkDescriptionPlaceholder')}
                        value={pendingLink.linkData?.description || ''}
                        onChange={e =>
                          onPendingLinkDescriptionChange(
                            pendingLink.id,
                            e.target.value
                          )
                        }
                        size="xs"
                      />
                    )}
                  </Stack>
                </Group>
                {onRemovePendingLink && (
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemovePendingLink(pendingLink.id)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    );

    if (mode === 'view') {
      return (
        <Stack gap="md">
          {storageBackendSelector}
          {addDocumentMenu('Add Document')}

          {hasRemoteFiles && (
            <Group justify="space-between" align="center">
              <Text fw={500}>{t('shared:tabs.documents')}</Text>
              {syncCheckButton}
            </Group>
          )}

          <FileList
            files={files}
            syncStatus={syncStatus}
            showActions={true}
            onDownload={onDownloadFile}
            onView={onViewFile}
            onDelete={onImmediateDelete}
          />
        </Stack>
      );
    }

    if (mode === 'edit') {
      return (
        <Stack gap="md">
          {storageBackendSelector}

          {files.length > 0 && (
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={5}>{t('manager.currentFiles')}</Title>
                {syncCheckButton}
              </Group>
              <FileList
                files={files}
                filesToDelete={filesToDelete}
                syncStatus={syncStatus}
                showActions={true}
                onDownload={onDownloadFile}
                onView={onViewFile}
                onDelete={onMarkFileForDeletion}
                onRestore={onUnmarkFileForDeletion}
              />
            </Stack>
          )}

          {addDocumentMenu('Manage Documents')}
          {pendingFilesList}
          {pendingLinksList}
        </Stack>
      );
    }

    if (mode === 'create') {
      return (
        <Stack gap="md">
          {storageBackendSelector}
          {addDocumentMenu('Manage Documents')}
          {pendingFilesList}
          {pendingLinksList}
        </Stack>
      );
    }

    return null;
  }
);

RenderModeContent.displayName = 'RenderModeContent';

export default RenderModeContent;
