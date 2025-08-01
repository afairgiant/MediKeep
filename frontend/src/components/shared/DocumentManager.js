import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Paper,
  Title,
  Text,
  Group,
  Button,
  Alert,
  Loader,
  Center,
  Modal,
  ActionIcon,
  Badge,
  Divider,
  FileInput,
  TextInput,
  ThemeIcon
} from '@mantine/core';
import {
  IconFile,
  IconDownload,
  IconTrash,
  IconUpload,
  IconX,
  IconRestore,
  IconFileText,
  IconAlertTriangle
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { getPaperlessSettings } from '../../services/api/paperlessApi';
import logger from '../../services/logger';
import FileUploadZone from './FileUploadZone';
import FileList from './FileList';
import FileCountBadge from './FileCountBadge';
import StorageBackendSelector from './StorageBackendSelector';

const DocumentManager = ({
  entityType,
  entityId,
  mode = 'view', // 'view', 'edit', 'create'
  config = {},
  onFileCountChange,
  onError,
  className = ''
}) => {
  // State management
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // File upload state for modal
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });

  // Paperless settings state
  const [paperlessSettings, setPaperlessSettings] = useState(null);
  const [selectedStorageBackend, setSelectedStorageBackend] = useState('local');
  const [paperlessLoading, setPaperlessLoading] = useState(true);

  // Load files when component mounts or entityId changes
  useEffect(() => {
    if (entityId && mode !== 'create') {
      loadFiles();
    }
  }, [entityId, mode]);
  
  // Load paperless settings separately (independent of entityId)
  useEffect(() => {
    loadPaperlessSettings();
  }, [loadPaperlessSettings]);

  // Load paperless settings
  const loadPaperlessSettings = useCallback(async () => {
    setPaperlessLoading(true);
    try {
      const settings = await getPaperlessSettings();
      setPaperlessSettings(settings);
      
      // Set default storage backend based on user preference
      if (settings?.default_storage_backend) {
        setSelectedStorageBackend(settings.default_storage_backend);
      } else {
        // Fallback to app's local storage system
        setSelectedStorageBackend('local');
      }
      
      logger.debug('Paperless settings loaded successfully', {
        paperlessEnabled: settings?.paperless_enabled,
        hasUrl: !!settings?.paperless_url,
        hasCredentials: !!settings?.paperless_has_credentials,
        defaultBackend: settings?.default_storage_backend,
        component: 'DocumentManager'
      });
    } catch (err) {
      logger.warn('Failed to load paperless settings', {
        error: err.message,
        component: 'DocumentManager'
      });
      // Default to local storage if paperless settings fail
      setPaperlessSettings(null);
      setSelectedStorageBackend('local');
    } finally {
      setPaperlessLoading(false);
    }
  }, []);

  // Load files from server
  const loadFiles = useCallback(async () => {
    if (!entityId) return;

    setLoading(true);
    setError('');

    try {
      const response = await apiService.getEntityFiles(entityType, entityId);
      const fileList = Array.isArray(response) ? response : [];
      setFiles(fileList);
      
      // Notify parent of file count change
      if (onFileCountChange) {
        onFileCountChange(fileList.length);
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to load files';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
      
      logger.error('document_manager_load_error', {
        message: 'Failed to load files',
        entityType,
        entityId,
        error: err.message,
        component: 'DocumentManager'
      });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, onFileCountChange, onError]);

  // Add pending file for batch upload (edit/create mode)
  const handleAddPendingFile = useCallback((file, description = '') => {
    setPendingFiles(prev => [...prev, { file, description, id: Date.now() }]);
  }, []);

  // Remove pending file
  const handleRemovePendingFile = useCallback((fileId) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Mark file for deletion (edit mode)
  const handleMarkFileForDeletion = useCallback((fileId) => {
    setFilesToDelete(prev => [...prev, fileId]);
  }, []);

  // Unmark file for deletion
  const handleUnmarkFileForDeletion = useCallback((fileId) => {
    setFilesToDelete(prev => prev.filter(id => id !== fileId));
  }, []);

  // Upload single file immediately (view mode)
  const handleImmediateUpload = async (file, description = '') => {
    if (!entityId) {
      setError('Cannot upload file: entity ID not provided');
      return;
    }

    setLoading(true);
    setError('');

    try {
      logger.info('document_manager_upload_attempt', {
        message: 'Attempting file upload',
        entityType,
        entityId,
        fileName: file.name,
        selectedStorageBackend,
        paperlessEnabled: paperlessSettings?.paperless_enabled,
        paperlessHasCredentials: paperlessSettings?.paperless_has_credentials,
        paperlessUrl: paperlessSettings?.paperless_url,
        component: 'DocumentManager'
      });
      
      await apiService.uploadEntityFile(entityType, entityId, file, description, '', selectedStorageBackend);
      
      // Reload files to show the new upload
      await loadFiles();
      
      // Clear upload form
      setFileUpload({ file: null, description: '' });
      setShowUploadModal(false);
      
      logger.info('document_manager_upload_success', {
        message: 'File uploaded successfully',
        entityType,
        entityId,
        fileName: file.name,
        component: 'DocumentManager'
      });
    } catch (err) {
      let errorMessage = err.message || 'Failed to upload file';
      
      // Provide more specific error messages for Paperless issues
      if (selectedStorageBackend === 'paperless') {
        if (errorMessage.includes('not enabled')) {
          errorMessage = 'Paperless integration is not enabled. Please enable it in Settings.';
        } else if (errorMessage.includes('configuration is incomplete')) {
          errorMessage = 'Paperless configuration is incomplete. Please check your settings.';
        } else if (errorMessage.includes('Failed to upload to paperless')) {
          errorMessage = `Failed to upload to Paperless: ${errorMessage.replace('Failed to upload to paperless: ', '')}`;
        } else if (!errorMessage.includes('Paperless')) {
          errorMessage = `Failed to upload to Paperless: ${errorMessage}`;
        }
      }
      
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
      
      logger.error('document_manager_upload_error', {
        message: 'Failed to upload file',
        entityType,
        entityId,
        fileName: file.name,
        selectedStorageBackend,
        error: err.message,
        component: 'DocumentManager'
      });
    } finally {
      setLoading(false);
    }
  };

  // Download file
  const handleDownloadFile = async (fileId, fileName) => {
    try {
      await apiService.downloadEntityFile(fileId, fileName);
      
      logger.info('document_manager_download_success', {
        message: 'File downloaded successfully',
        entityType,
        entityId,
        fileId,
        fileName,
        component: 'DocumentManager'
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to download file';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
      
      logger.error('document_manager_download_error', {
        message: 'Failed to download file',
        entityType,
        entityId,
        fileId,
        fileName,
        error: err.message,
        component: 'DocumentManager'
      });
    }
  };

  // Delete file immediately (view mode)
  const handleImmediateDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiService.deleteEntityFile(fileId);
      
      // Reload files to reflect deletion
      await loadFiles();
      
      logger.info('document_manager_delete_success', {
        message: 'File deleted successfully',
        entityType,
        entityId,
        fileId,
        component: 'DocumentManager'
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete file';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
      
      logger.error('document_manager_delete_error', {
        message: 'Failed to delete file',
        entityType,
        entityId,
        fileId,
        error: err.message,
        component: 'DocumentManager'
      });
    } finally {
      setLoading(false);
    }
  };

  // Batch upload pending files (for create/edit mode)
  const uploadPendingFiles = async (targetEntityId) => {
    if (pendingFiles.length === 0) return true;

    const uploadPromises = pendingFiles.map(async (pendingFile) => {
      try {
        logger.info('document_manager_batch_upload_attempt', {
          message: 'Attempting batch file upload',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          selectedStorageBackend,
          paperlessEnabled: paperlessSettings?.paperless_enabled,
          paperlessHasCredentials: paperlessSettings?.paperless_has_credentials,
          paperlessUrl: paperlessSettings?.paperless_url,
          component: 'DocumentManager'
        });
        
        await apiService.uploadEntityFile(
          entityType,
          targetEntityId,
          pendingFile.file,
          pendingFile.description,
          '',
          selectedStorageBackend
        );
        
        logger.info('document_manager_batch_upload_success', {
          message: 'Batch file uploaded successfully',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          component: 'DocumentManager'
        });
      } catch (error) {
        // Enhance error message for Paperless issues
        let errorMessage = error.message || 'Failed to upload file';
        
        if (selectedStorageBackend === 'paperless') {
          if (errorMessage.includes('not enabled')) {
            errorMessage = 'Paperless integration is not enabled. Please enable it in Settings.';
          } else if (errorMessage.includes('configuration is incomplete')) {
            errorMessage = 'Paperless configuration is incomplete. Please check your settings.';
          } else if (errorMessage.includes('Failed to upload to paperless')) {
            errorMessage = `Failed to upload to Paperless: ${errorMessage.replace('Failed to upload to paperless: ', '')}`;
          } else if (!errorMessage.includes('Paperless')) {
            errorMessage = `Failed to upload to Paperless: ${errorMessage}`;
          }
        }
        
        logger.error('document_manager_batch_upload_error', {
          message: 'Failed to upload file in batch',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          selectedStorageBackend,
          error: error.message,
          enhancedError: errorMessage,
          component: 'DocumentManager'
        });
        
        // Create a new error with the enhanced message
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        throw enhancedError;
      }
    });

    await Promise.all(uploadPromises);
    setPendingFiles([]);
    return true;
  };

  // Batch delete marked files (for edit mode)
  const deleteMarkedFiles = async () => {
    if (filesToDelete.length === 0) return true;

    const deletePromises = filesToDelete.map(async (fileId) => {
      try {
        await apiService.deleteEntityFile(fileId);
        
        logger.info('document_manager_batch_delete_success', {
          message: 'Batch file deleted successfully',
          entityType,
          entityId,
          fileId,
          component: 'DocumentManager'
        });
      } catch (error) {
        logger.error('document_manager_batch_delete_error', {
          message: 'Failed to delete file in batch',
          entityType,
          entityId,
          fileId,
          error: error.message,
          component: 'DocumentManager'
        });
        throw error;
      }
    });

    await Promise.all(deletePromises);
    setFilesToDelete([]);
    return true;
  };

  // Handle file upload form submission (view mode modal)
  const handleFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!fileUpload.file) return;

    await handleImmediateUpload(fileUpload.file, fileUpload.description);
  };

  // Expose batch operations for parent components (create/edit mode)
  React.useImperativeHandle(React.forwardRef(), () => ({
    uploadPendingFiles,
    deleteMarkedFiles,
    getPendingFilesCount: () => pendingFiles.length,
    getFilesToDeleteCount: () => filesToDelete.length
  }));

  // Render based on mode
  const renderContent = () => {
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

    if (mode === 'view') {
      return (
        <Stack gap="md">
          {/* Storage Backend Selector */}
          {!paperlessLoading && (
            <StorageBackendSelector
              value={selectedStorageBackend}
              onChange={setSelectedStorageBackend}
              paperlessEnabled={paperlessSettings?.paperless_enabled || false}
              paperlessConnected={paperlessSettings?.paperless_enabled && paperlessSettings?.paperless_url && paperlessSettings?.paperless_has_credentials}
              disabled={loading}
              size="sm"
            />
          )}

          {/* File Upload Section */}
          <Paper withBorder p="md" bg="gray.1">
            <Group justify="space-between" align="center">
              <Text fw={500}>Upload New File</Text>
              <Button
                leftSection={<IconUpload size={16} />}
                onClick={() => setShowUploadModal(true)}
                disabled={loading}
              >
                Upload File
              </Button>
            </Group>
          </Paper>

          {/* Files List */}
          <FileList
            files={files}
            showActions={true}
            onDownload={handleDownloadFile}
            onDelete={handleImmediateDelete}
          />
        </Stack>
      );
    }

    if (mode === 'edit') {
      return (
        <Stack gap="md">
          {/* Storage Backend Selector */}
          {!paperlessLoading && (
            <StorageBackendSelector
              value={selectedStorageBackend}
              onChange={setSelectedStorageBackend}
              paperlessEnabled={paperlessSettings?.paperless_enabled || false}
              paperlessConnected={paperlessSettings?.paperless_enabled && paperlessSettings?.paperless_url && paperlessSettings?.paperless_has_credentials}
              disabled={loading}
              size="sm"
            />
          )}

          {/* Existing Files */}
          {files.length > 0 && (
            <Stack gap="md">
              <Title order={5}>Current Files:</Title>
              <FileList
                files={files}
                filesToDelete={filesToDelete}
                showActions={true}
                onDownload={handleDownloadFile}
                onDelete={handleMarkFileForDeletion}
                onRestore={handleUnmarkFileForDeletion}
              />
            </Stack>
          )}

          {/* Add New Files */}
          <FileUploadZone
            onUpload={(uploadedFiles) => {
              uploadedFiles.forEach(({ file, description }) => {
                handleAddPendingFile(file, description);
              });
            }}
            acceptedTypes={config.acceptedTypes}
            maxSize={config.maxSize}
            maxFiles={config.maxFiles}
            selectedStorageBackend={selectedStorageBackend}
            paperlessSettings={paperlessSettings}
          />

          {/* Pending Files */}
          {pendingFiles.length > 0 && (
            <Stack gap="md">
              <Title order={5}>Files to Upload:</Title>
              <Stack gap="sm">
                {pendingFiles.map((pendingFile) => (
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
                          <TextInput
                            placeholder="Description (optional)"
                            value={pendingFile.description}
                            onChange={(e) => {
                              setPendingFiles(prev =>
                                prev.map(f =>
                                  f.id === pendingFile.id
                                    ? { ...f, description: e.target.value }
                                    : f
                                )
                              );
                            }}
                            size="xs"
                          />
                        </Stack>
                      </Group>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => handleRemovePendingFile(pendingFile.id)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      );
    }

    if (mode === 'create') {
      return (
        <Stack gap="md">
          {/* Storage Backend Selector */}
          {!paperlessLoading && (
            <StorageBackendSelector
              value={selectedStorageBackend}
              onChange={setSelectedStorageBackend}
              paperlessEnabled={paperlessSettings?.paperless_enabled || false}
              paperlessConnected={paperlessSettings?.paperless_enabled && paperlessSettings?.paperless_url && paperlessSettings?.paperless_has_credentials}
              disabled={loading}
              size="sm"
            />
          )}

          <FileUploadZone
            onUpload={(uploadedFiles) => {
              uploadedFiles.forEach(({ file, description }) => {
                handleAddPendingFile(file, description);
              });
            }}
            acceptedTypes={config.acceptedTypes}
            maxSize={config.maxSize}
            maxFiles={config.maxFiles}
            selectedStorageBackend={selectedStorageBackend}
            paperlessSettings={paperlessSettings}
          />

          {/* Pending Files */}
          {pendingFiles.length > 0 && (
            <Stack gap="md">
              <Title order={5}>Files to Upload:</Title>
              <Stack gap="sm">
                {pendingFiles.map((pendingFile) => (
                  <Paper key={pendingFile.id} withBorder p="sm" bg="blue.1">
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="blue" size="sm">
                          <IconFileText size={14} />
                        </ThemeIcon>
                        <Text fw={500} size="sm">
                          {pendingFile.file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {(pendingFile.file.size / 1024).toFixed(1)} KB
                        </Text>
                      </Group>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => handleRemovePendingFile(pendingFile.id)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      );
    }
  };

  return (
    <Stack gap="md" className={className}>
      {/* Error Display */}
      {error && (
        <Alert
          variant="light"
          color="red"
          title="File Operation Error"
          icon={<IconAlertTriangle size={16} />}
          withCloseButton
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* Main Content */}
      {renderContent()}

      {/* Upload Modal for View Mode */}
      <Modal
        opened={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setFileUpload({ file: null, description: '' });
        }}
        title="Upload File"
        centered
      >
        <form onSubmit={handleFileUploadSubmit}>
          <Stack gap="md">
            <FileInput
              placeholder="Select a file to upload"
              value={fileUpload.file}
              onChange={(file) =>
                setFileUpload(prev => ({ ...prev, file }))
              }
              accept={config.acceptedTypes?.join(',')}
              leftSection={<IconUpload size={16} />}
            />
            <TextInput
              placeholder="File description (optional)"
              value={fileUpload.description}
              onChange={(e) =>
                setFileUpload(prev => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
            <Group justify="flex-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setFileUpload({ file: null, description: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!fileUpload.file || loading}
                leftSection={<IconUpload size={16} />}
              >
                Upload
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};

export default DocumentManager;