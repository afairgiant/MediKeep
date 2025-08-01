import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ThemeIcon,
  Progress,
} from '@mantine/core';
import {
  IconFile,
  IconDownload,
  IconTrash,
  IconUpload,
  IconX,
  IconRestore,
  IconFileText,
  IconAlertTriangle,
  IconRefresh,
  IconCheck,
  IconLoader,
  IconExclamationMark,
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
  onUploadPendingFiles, // Callback to expose upload function
  className = '',
}) => {
  // Add spinning animation styles
  const spinKeyframes = `
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;
  // State management
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState({});
  const [syncLoading, setSyncLoading] = useState(false);

  // File upload state for modal
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });

  // Paperless settings state
  const [paperlessSettings, setPaperlessSettings] = useState(null);
  const [selectedStorageBackend, setSelectedStorageBackend] = useState('local');
  
  // Use refs to access current state in stable callback  
  const pendingFilesRef = useRef(pendingFiles);
  const selectedStorageBackendRef = useRef(selectedStorageBackend);
  const paperlessSettingsRef = useRef(paperlessSettings);
  
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);
  
  useEffect(() => {
    selectedStorageBackendRef.current = selectedStorageBackend;
  }, [selectedStorageBackend]);
  
  useEffect(() => {
    paperlessSettingsRef.current = paperlessSettings;
  }, [paperlessSettings]);
  
  const [paperlessLoading, setPaperlessLoading] = useState(true);

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
        component: 'DocumentManager',
      });
    } catch (err) {
      logger.warn('Failed to load paperless settings', {
        error: err.message,
        component: 'DocumentManager',
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
        component: 'DocumentManager',
      });
    }
  }, [entityType, entityId, onFileCountChange, onError]);

  // Check sync status for Paperless documents
  const checkSyncStatus = useCallback(async (isManualSync = false) => {
    if (isManualSync) setSyncLoading(true);
    
    try {
      const status = await apiService.checkPaperlessSyncStatus();
      setSyncStatus(status);
      
      // Refresh file list to get updated sync status from database
      await loadFiles();
    } catch (err) {
      logger.error('document_manager_sync_check_error', {
        message: 'Failed to check Paperless sync status',
        entityType,
        entityId,
        error: err.message,
        component: 'DocumentManager',
      });
      // Don't show error to user for sync checks - it's optional
    } finally {
      if (isManualSync) setSyncLoading(false);
    }
  }, [entityType, entityId, loadFiles]);

  // Load files when component mounts or entityId changes
  useEffect(() => {
    if (entityId && mode !== 'create') {
      setLoading(true);
      
      loadFiles().finally(() => {
        setLoading(false);
        // Note: Sync check now only happens manually via button to avoid UI changes
      });
    }
  }, [entityId, mode, loadFiles]);

  // Load paperless settings separately (independent of entityId)
  useEffect(() => {
    loadPaperlessSettings();
  }, [loadPaperlessSettings]);

  // Add pending file for batch upload (edit/create mode)
  const handleAddPendingFile = useCallback((file, description = '') => {
    setPendingFiles(prev => [...prev, { file, description, id: Date.now() }]);
  }, []);

  // Remove pending file
  const handleRemovePendingFile = useCallback(fileId => {
    const fileIndex = pendingFiles.findIndex(f => f.id === fileId);
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
    
    // Clear progress for this file
    if (fileIndex !== -1) {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileIndex];
        return newProgress;
      });
    }
  }, [pendingFiles]);

  // Mark file for deletion (edit mode)
  const handleMarkFileForDeletion = useCallback(fileId => {
    setFilesToDelete(prev => [...prev, fileId]);
  }, []);

  // Unmark file for deletion
  const handleUnmarkFileForDeletion = useCallback(fileId => {
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
        component: 'DocumentManager',
      });

      await apiService.uploadEntityFile(
        entityType,
        entityId,
        file,
        description,
        '',
        selectedStorageBackend
      );

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
        component: 'DocumentManager',
      });
    } catch (err) {
      let errorMessage = err.message || 'Failed to upload file';

      // Provide more specific error messages for Paperless issues
      if (selectedStorageBackend === 'paperless') {
        if (errorMessage.includes('not enabled')) {
          errorMessage =
            'Paperless integration is not enabled. Please enable it in Settings.';
        } else if (errorMessage.includes('configuration is incomplete')) {
          errorMessage =
            'Paperless configuration is incomplete. Please check your settings.';
        } else if (errorMessage.includes('appears to be a duplicate')) {
          // Duplicate error - use the detailed message from backend
          errorMessage = errorMessage;
        } else if (errorMessage.includes('Failed to upload to paperless')) {
          errorMessage = `Failed to upload to Paperless: ${errorMessage.replace('Failed to upload to paperless: ', '')}`;
        } else if (!errorMessage.includes('Paperless') && !errorMessage.includes('duplicate')) {
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
        component: 'DocumentManager',
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
        component: 'DocumentManager',
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
        component: 'DocumentManager',
      });
    }
  };

  // Delete file immediately (view mode)
  const handleImmediateDelete = async fileId => {
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
        component: 'DocumentManager',
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
        component: 'DocumentManager',
      });
    } finally {
      setLoading(false);
    }
  };

  // Batch upload pending files (for create/edit mode)
  const uploadPendingFiles = useCallback(async targetEntityId => {
    const currentPendingFiles = pendingFilesRef.current;
    
    logger.info('document_manager_upload_pending_start', {
      message: 'uploadPendingFiles function called',
      entityType,
      targetEntityId,
      pendingFilesCount: currentPendingFiles.length,
      component: 'DocumentManager',
    });
    
    if (currentPendingFiles.length === 0) {
      logger.info('document_manager_no_pending_files', {
        message: 'No pending files to upload',
        entityType,
        targetEntityId,
        component: 'DocumentManager',
      });
      return true;
    }

    // Initialize progress tracking for all files
    const initialProgress = {};
    currentPendingFiles.forEach((file, index) => {
      initialProgress[index] = { progress: 0, status: 'pending', error: null };
    });
    setUploadProgress(initialProgress);

    const uploadPromises = currentPendingFiles.map(async (pendingFile, index) => {
      logger.info('document_manager_individual_upload_start', {
        message: 'Starting individual file upload',
        entityType,
        targetEntityId,
        fileName: pendingFile.file.name,
        fileIndex: index,
        selectedStorageBackend,
        component: 'DocumentManager',
      });
      
      try {
        // Mark as uploading
        setUploadProgress(prev => ({
          ...prev,
          [index]: { progress: 0, status: 'uploading', error: null }
        }));

        const currentStorageBackend = selectedStorageBackendRef.current;
        const currentPaperlessSettings = paperlessSettingsRef.current;
        
        logger.info('document_manager_batch_upload_attempt', {
          message: 'Attempting batch file upload',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          selectedStorageBackend: currentStorageBackend,
          paperlessEnabled: currentPaperlessSettings?.paperless_enabled,
          paperlessHasCredentials: currentPaperlessSettings?.paperless_has_credentials,
          paperlessUrl: currentPaperlessSettings?.paperless_url,
          component: 'DocumentManager',
        });

        // Show progress updates for Paperless uploads (they take longer)
        let progressInterval = null;
        
        if (currentStorageBackend === 'paperless') {
          // Set initial progress
          setUploadProgress(prev => ({
            ...prev,
            [index]: { progress: 10, status: 'uploading', error: null }
          }));
          
          // Simulate progress for better UX since we don't have real progress from API
          progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              const current = prev[index]?.progress || 10;
              if (current < 85) {
                const newProgress = Math.min(current + Math.random() * 15, 85);
                return {
                  ...prev,
                  [index]: { ...prev[index], progress: newProgress }
                };
              }
              return prev;
            });
          }, 800);
        }

        try {
          logger.info('document_manager_calling_api_upload', {
            message: 'About to call apiService.uploadEntityFile',
            entityType,
            targetEntityId,
            fileName: pendingFile.file.name,
            selectedStorageBackend: currentStorageBackend,
            component: 'DocumentManager',
          });
          
          await apiService.uploadEntityFile(
            entityType,
            targetEntityId,
            pendingFile.file,
            pendingFile.description,
            '',
            currentStorageBackend
          );
          
          logger.info('document_manager_api_upload_success', {
            message: 'apiService.uploadEntityFile completed successfully',
            entityType,
            targetEntityId,
            fileName: pendingFile.file.name,
            component: 'DocumentManager',
          });
          
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        } catch (error) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          throw error;
        }

        // Mark as completed
        setUploadProgress(prev => ({
          ...prev,
          [index]: { progress: 100, status: 'completed', error: null }
        }));

        logger.info('document_manager_batch_upload_success', {
          message: 'Batch file uploaded successfully',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          component: 'DocumentManager',
        });
      } catch (error) {
        // Enhance error message for Paperless issues
        let errorMessage = error.message || 'Failed to upload file';

        if (currentStorageBackend === 'paperless') {
          if (errorMessage.includes('not enabled')) {
            errorMessage =
              'Paperless integration is not enabled. Please enable it in Settings.';
          } else if (errorMessage.includes('configuration is incomplete')) {
            errorMessage =
              'Paperless configuration is incomplete. Please check your settings.';
          } else if (errorMessage.includes('appears to be a duplicate')) {
            // Duplicate error - use the detailed message from backend
            errorMessage = errorMessage;
          } else if (errorMessage.includes('Failed to upload to paperless')) {
            errorMessage = `Failed to upload to Paperless: ${errorMessage.replace('Failed to upload to paperless: ', '')}`;
          } else if (!errorMessage.includes('Paperless') && !errorMessage.includes('duplicate')) {
            errorMessage = `Failed to upload to Paperless: ${errorMessage}`;
          }
        }

        // Mark as failed
        setUploadProgress(prev => ({
          ...prev,
          [index]: { progress: 0, status: 'failed', error: errorMessage }
        }));

        logger.error('document_manager_batch_upload_error', {
          message: 'Failed to upload file in batch',
          entityType,
          entityId: targetEntityId,
          fileName: pendingFile.file.name,
          selectedStorageBackend: currentStorageBackend,
          error: error.message,
          enhancedError: errorMessage,
          component: 'DocumentManager',
        });

        // Create a new error with the enhanced message
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        throw enhancedError;
      }
    });

    logger.info('document_manager_about_to_promise_all', {
      message: 'About to execute Promise.all for file uploads',
      entityType,
      targetEntityId,
      promiseCount: uploadPromises.length,
      component: 'DocumentManager',
    });

    try {
      const results = await Promise.all(uploadPromises);
      logger.info('document_manager_batch_upload_complete', {
        message: 'All files uploaded successfully in batch',
        entityType,
        entityId: targetEntityId,
        fileCount: currentPendingFiles.length,
        component: 'DocumentManager',
      });
      
      setPendingFiles([]);
      
      // Clear upload progress after a brief delay to show completion
      setTimeout(() => {
        setUploadProgress({});
      }, 2000);
      
      return true;
    } catch (error) {
      logger.error('document_manager_batch_upload_failed', {
        message: 'Batch upload failed',
        entityType,
        entityId: targetEntityId,
        error: error.message,
        component: 'DocumentManager',
      });
      
      // Don't clear pending files if upload failed
      // Let user see the error state and retry if needed
      throw error;
    }
  }, [entityType]);


  // Expose upload function to parent via callback (only once)
  useEffect(() => {
    if (onUploadPendingFiles) {
      logger.info('document_manager_exposing_methods', {
        message: 'Exposing upload methods to parent component',
        entityType,
        entityId,
        exposingMethodsCount: 1, // Track how many times this runs
        pendingFilesCount: pendingFilesRef.current.length,
        component: 'DocumentManager',
      });
      
      onUploadPendingFiles({
        uploadPendingFiles,
        getPendingFilesCount: () => pendingFilesRef.current.length,
        hasPendingFiles: () => pendingFilesRef.current.length > 0,
        clearPendingFiles: () => setPendingFiles([]),
      });
    }
  }, [onUploadPendingFiles, uploadPendingFiles]);

  // Batch delete marked files (for edit mode)
  const deleteMarkedFiles = async () => {
    if (filesToDelete.length === 0) return true;

    const deletePromises = filesToDelete.map(async fileId => {
      try {
        await apiService.deleteEntityFile(fileId);

        logger.info('document_manager_batch_delete_success', {
          message: 'Batch file deleted successfully',
          entityType,
          entityId,
          fileId,
          component: 'DocumentManager',
        });
      } catch (error) {
        logger.error('document_manager_batch_delete_error', {
          message: 'Failed to delete file in batch',
          entityType,
          entityId,
          fileId,
          error: error.message,
          component: 'DocumentManager',
        });
        throw error;
      }
    });

    await Promise.all(deletePromises);
    setFilesToDelete([]);
    return true;
  };

  // Handle file upload form submission (view mode modal)
  const handleFileUploadSubmit = async e => {
    e.preventDefault();
    if (!fileUpload.file) return;

    await handleImmediateUpload(fileUpload.file, fileUpload.description);
  };

  // Note: Batch operations (uploadPendingFiles, deleteMarkedFiles) are available
  // but not currently exposed via imperative handle since no parent components use refs

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
              paperlessConnected={
                paperlessSettings?.paperless_enabled &&
                paperlessSettings?.paperless_url &&
                paperlessSettings?.paperless_has_credentials
              }
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
            syncStatus={syncStatus}
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
              paperlessConnected={
                paperlessSettings?.paperless_enabled &&
                paperlessSettings?.paperless_url &&
                paperlessSettings?.paperless_has_credentials
              }
              disabled={loading}
              size="sm"
            />
          )}

          {/* Existing Files */}
          {files.length > 0 && (
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={5}>Current Files:</Title>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  loading={syncLoading}
                  onClick={() => checkSyncStatus(true)}
                  title="Check sync status with Paperless"
                >
                  Sync Check
                </Button>
              </Group>
              <FileList
                files={files}
                filesToDelete={filesToDelete}
                syncStatus={syncStatus}
                showActions={true}
                onDownload={handleDownloadFile}
                onDelete={handleMarkFileForDeletion}
                onRestore={handleUnmarkFileForDeletion}
              />
            </Stack>
          )}

          {/* Add New Files */}
          <FileUploadZone
            onUpload={uploadedFiles => {
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
                {pendingFiles.map((pendingFile, index) => {
                  const fileProgress = uploadProgress[index];
                  const isUploading = fileProgress?.status === 'uploading';
                  const isCompleted = fileProgress?.status === 'completed';
                  const isFailed = fileProgress?.status === 'failed';
                  const progressValue = fileProgress?.progress || 0;

                  return (
                    <Paper key={pendingFile.id} withBorder p="sm" bg={
                      isCompleted ? "green.1" : 
                      isFailed ? "red.1" : 
                      isUploading ? "yellow.1" : 
                      "blue.1"
                    }>
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs" style={{ flex: 1 }}>
                          <ThemeIcon 
                            variant="light" 
                            color={
                              isCompleted ? "green" : 
                              isFailed ? "red" : 
                              isUploading ? "yellow" : 
                              "blue"
                            } 
                            size="sm"
                          >
                            {isCompleted ? (
                              <IconCheck size={14} />
                            ) : isFailed ? (
                              <IconExclamationMark size={14} />
                            ) : isUploading ? (
                              <IconLoader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <IconFileText size={14} />
                            )}
                          </ThemeIcon>
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="md">
                              <Text fw={500} size="sm">
                                {pendingFile.file.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {(pendingFile.file.size / 1024).toFixed(1)} KB
                              </Text>
                              {isUploading && selectedStorageBackend === 'paperless' && (
                                <Badge variant="light" color="yellow" size="xs">
                                  Uploading to Paperless...
                                </Badge>
                              )}
                              {isCompleted && (
                                <Badge variant="light" color="green" size="xs">
                                  Uploaded
                                </Badge>
                              )}
                              {isFailed && (
                                <Badge variant="light" color="red" size="xs">
                                  Failed
                                </Badge>
                              )}
                            </Group>
                            
                            {/* Progress bar for uploads */}
                            {(isUploading || isCompleted || isFailed) && (
                              <Progress 
                                value={progressValue}
                                color={
                                  isCompleted ? "green" : 
                                  isFailed ? "red" : 
                                  "blue"
                                }
                                size="sm"
                                striped={isUploading}
                                animated={isUploading}
                              />
                            )}
                            
                            {/* Error message for failed uploads */}
                            {isFailed && fileProgress?.error && (
                              <Alert variant="light" color="red" size="xs" p="xs">
                                <Text size="xs">{fileProgress.error}</Text>
                              </Alert>
                            )}
                            
                            {!isUploading && !isCompleted && (
                              <TextInput
                                placeholder="Description (optional)"
                                value={pendingFile.description}
                                onChange={e => {
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
                            )}
                          </Stack>
                        </Group>
                        {!isUploading && !isCompleted && (
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleRemovePendingFile(pendingFile.id)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Paper>
                  );
                })}
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
              paperlessConnected={
                paperlessSettings?.paperless_enabled &&
                paperlessSettings?.paperless_url &&
                paperlessSettings?.paperless_has_credentials
              }
              disabled={loading}
              size="sm"
            />
          )}

          <FileUploadZone
            onUpload={uploadedFiles => {
              uploadedFiles.forEach(({ file, description }) => {
                handleAddPendingFile(file, description);
              });
            }}
            acceptedTypes={config.acceptedTypes}
            maxSize={config.maxSize}
            maxFiles={config.maxFiles}
            autoUpload={true} // Auto-upload in create mode for better UX
            selectedStorageBackend={selectedStorageBackend}
            paperlessSettings={paperlessSettings}
          />

          {/* Pending Files */}
          {pendingFiles.length > 0 && (
            <Stack gap="md">
              <Title order={5}>Files to Upload:</Title>
              <Stack gap="sm">
                {pendingFiles.map((pendingFile, index) => {
                  const fileProgress = uploadProgress[index];
                  const isUploading = fileProgress?.status === 'uploading';
                  const isCompleted = fileProgress?.status === 'completed';
                  const isFailed = fileProgress?.status === 'failed';
                  const progressValue = fileProgress?.progress || 0;

                  return (
                    <Paper key={pendingFile.id} withBorder p="sm" bg={
                      isCompleted ? "green.1" : 
                      isFailed ? "red.1" : 
                      isUploading ? "yellow.1" : 
                      "blue.1"
                    }>
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs" style={{ flex: 1 }}>
                          <ThemeIcon 
                            variant="light" 
                            color={
                              isCompleted ? "green" : 
                              isFailed ? "red" : 
                              isUploading ? "yellow" : 
                              "blue"
                            } 
                            size="sm"
                          >
                            {isCompleted ? (
                              <IconCheck size={14} />
                            ) : isFailed ? (
                              <IconExclamationMark size={14} />
                            ) : isUploading ? (
                              <IconLoader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <IconFileText size={14} />
                            )}
                          </ThemeIcon>
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="md">
                              <Text fw={500} size="sm">
                                {pendingFile.file.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {(pendingFile.file.size / 1024).toFixed(1)} KB
                              </Text>
                              {isUploading && selectedStorageBackend === 'paperless' && (
                                <Badge variant="light" color="yellow" size="xs">
                                  Uploading to Paperless...
                                </Badge>
                              )}
                              {isCompleted && (
                                <Badge variant="light" color="green" size="xs">
                                  Uploaded
                                </Badge>
                              )}
                              {isFailed && (
                                <Badge variant="light" color="red" size="xs">
                                  Failed
                                </Badge>
                              )}
                            </Group>
                            
                            {/* Progress bar for uploads */}
                            {(isUploading || isCompleted || isFailed) && (
                              <Progress 
                                value={progressValue}
                                color={
                                  isCompleted ? "green" : 
                                  isFailed ? "red" : 
                                  "blue"
                                }
                                size="sm"
                                striped={isUploading}
                                animated={isUploading}
                              />
                            )}
                            
                            {/* Error message for failed uploads */}
                            {isFailed && fileProgress?.error && (
                              <Alert variant="light" color="red" size="xs" p="xs">
                                <Text size="xs">{fileProgress.error}</Text>
                              </Alert>
                            )}
                          </Stack>
                        </Group>
                        {!isUploading && !isCompleted && (
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleRemovePendingFile(pendingFile.id)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>
      );
    }
  };

  return (
    <>
      {/* Inject CSS for spin animation */}
      <style>{spinKeyframes}</style>
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
              onChange={file => setFileUpload(prev => ({ ...prev, file }))}
              accept={config.acceptedTypes?.join(',')}
              leftSection={<IconUpload size={16} />}
            />
            <TextInput
              placeholder="File description (optional)"
              value={fileUpload.description}
              onChange={e =>
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
    </>
  );
};

export default DocumentManager;
