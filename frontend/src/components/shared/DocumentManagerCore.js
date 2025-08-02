import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { getPaperlessSettings } from '../../services/api/paperlessApi';
import logger from '../../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  getUserFriendlyError,
  enhancePaperlessError,
  formatErrorWithContext
} from '../../constants/errorMessages';

// Import configuration from upload progress hook
const UPLOAD_CONFIG = {
  PROGRESS_UPDATE_INTERVAL: 800,
  PROGRESS_SIMULATION_RATE: 15
};

// Performance optimization utility: Debounce function for progress updates
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Performance monitoring utility - module scope to avoid ESLint issues
let performanceMonitorInstance = null;

const createPerformanceMonitor = () => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = {
      renderCount: 0,
      stateUpdateCount: 0,
      lastRenderTime: Date.now(),
      
      logRender: (componentName, reason) => {
        performanceMonitorInstance.renderCount++;
        const now = Date.now();
        const timeSinceLastRender = now - performanceMonitorInstance.lastRenderTime;
        
        // Only log if renders are frequent (potential performance issue)
        if (timeSinceLastRender < 100) {
          logger.warn('performance_frequent_render', {
            component: componentName,
            renderCount: performanceMonitorInstance.renderCount,
            timeSinceLastRender,
            reason,
          });
        }
        
        performanceMonitorInstance.lastRenderTime = now;
      },
      
      logStateUpdate: (updateType, newValue) => {
        performanceMonitorInstance.stateUpdateCount++;
        if (performanceMonitorInstance.stateUpdateCount % 10 === 0) {
          logger.info('performance_state_updates', {
            component: 'DocumentManagerCore',
            totalUpdates: performanceMonitorInstance.stateUpdateCount,
            updateType,
            hasValue: !!newValue,
          });
        }
      },
    };
  }
  return performanceMonitorInstance;
};

/**
 * DocumentManagerCore - Main coordination and state management component
 * Handles all business logic, API calls, and state management for document operations
 */
const DocumentManagerCore = ({
  entityType,
  entityId,
  mode = 'view',
  onFileCountChange,
  onError,
  onUploadComplete,
  showProgressModal = true,
  uploadState,
  updateFileProgress,
  startUpload,
  completeUpload,
  resetUpload,
}) => {
  // Performance monitoring: Track component renders
  const performanceMonitor = createPerformanceMonitor();
  performanceMonitor.logRender('DocumentManagerCore', `mode=${mode}, entityId=${entityId}`);
  
  // State management
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState({});
  const [syncLoading, setSyncLoading] = useState(false);

  // Performance optimization: Enhanced state setters with monitoring
  const monitoredSetFiles = useCallback((newFiles) => {
    performanceMonitor.logStateUpdate('files', newFiles);
    setFiles(newFiles);
  }, []);
  
  const monitoredSetPendingFiles = useCallback((newPendingFiles) => {
    performanceMonitor.logStateUpdate('pendingFiles', newPendingFiles);
    setPendingFiles(newPendingFiles);
  }, []);

  // Paperless settings state
  const [paperlessSettings, setPaperlessSettings] = useState(null);
  const [selectedStorageBackend, setSelectedStorageBackend] = useState('local');
  const [paperlessLoading, setPaperlessLoading] = useState(true);

  // Performance optimization: Memoize expensive progress statistics
  const progressStats = useMemo(() => {
    if (!uploadState.files || uploadState.files.length === 0) {
      return { completed: 0, failed: 0, uploading: 0, total: 0 };
    }
    
    const completed = uploadState.files.filter(f => f.status === 'completed').length;
    const failed = uploadState.files.filter(f => f.status === 'failed').length;
    const uploading = uploadState.files.filter(f => f.status === 'uploading').length;
    const total = uploadState.files.length;
    
    return { completed, failed, uploading, total };
  }, [uploadState.files]);

  // Performance optimization: Memoize file size calculations
  const fileStats = useMemo(() => {
    if (!files || files.length === 0) {
      return { totalSize: 0, averageSize: 0 };
    }
    
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const averageSize = totalSize / files.length;
    
    return { totalSize, averageSize };
  }, [files]);

  // Performance optimization: Memoize pending files stats
  const pendingStats = useMemo(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      return { count: 0, totalSize: 0 };
    }
    
    const count = pendingFiles.length;
    const totalSize = pendingFiles.reduce((sum, pf) => sum + (pf.file?.size || 0), 0);
    
    return { count, totalSize };
  }, [pendingFiles]);

  // Performance optimization: Debounced progress update function
  const debouncedUpdateProgress = useMemo(
    () => debounce((fileId, progress, status, error) => {
      updateFileProgress(fileId, progress, status, error);
    }, 100),
    [updateFileProgress]
  );

  // Rate limiting for logging
  const lastLogTimeRef = useRef(0);
  const LOG_THROTTLE_MS = 1000; // 1 second throttle

  // Refs for stable callbacks
  const pendingFilesRef = useRef(pendingFiles);
  const selectedStorageBackendRef = useRef(selectedStorageBackend);
  const paperlessSettingsRef = useRef(paperlessSettings);
  
  // Ref to track progress intervals for proper cleanup
  const progressIntervalsRef = useRef(new Set());

  // Performance optimization: Batch ref updates to reduce effect executions
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
    selectedStorageBackendRef.current = selectedStorageBackend;
    paperlessSettingsRef.current = paperlessSettings;
  }, [pendingFiles, selectedStorageBackend, paperlessSettings]);

  // Load paperless settings
  const loadPaperlessSettings = useCallback(async () => {
    setPaperlessLoading(true);
    try {
      const settings = await getPaperlessSettings();
      setPaperlessSettings(settings);

      if (settings?.default_storage_backend) {
        setSelectedStorageBackend(settings.default_storage_backend);
      } else {
        setSelectedStorageBackend('local');
      }

      logger.info('Paperless settings loaded successfully', {
        paperlessEnabled: settings?.paperless_enabled,
        hasUrl: !!settings?.paperless_url,
        hasCredentials: !!settings?.paperless_has_credentials,
        defaultBackend: settings?.default_storage_backend,
        component: 'DocumentManagerCore',
      });
    } catch (err) {
      logger.warn('Failed to load paperless settings', {
        error: err.message,
        component: 'DocumentManagerCore',
      });
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
      
      // Performance optimization: Prevent unnecessary re-renders with enhanced comparison
      monitoredSetFiles(prevFiles => {
        // Quick length check first (most common case)
        if (prevFiles.length !== fileList.length) {
          return fileList;
        }
        
        // Enhanced comparison checking both id and updated_at for better change detection
        const hasChanged = !prevFiles.every((file, index) => {
          const newFile = fileList[index];
          return newFile && file.id === newFile.id && file.updated_at === newFile.updated_at;
        });
        
        return hasChanged ? fileList : prevFiles;
      });

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
        component: 'DocumentManagerCore',
      });
    }
  }, [entityType, entityId, onFileCountChange, onError]);

  // Check sync status for Paperless documents
  const checkSyncStatus = useCallback(async (isManualSync = false) => {
    if (isManualSync) setSyncLoading(true);

    try {
      const status = await apiService.checkPaperlessSyncStatus();
      setSyncStatus(status);
      await loadFiles();
    } catch (err) {
      logger.error('document_manager_sync_check_error', {
        message: 'Failed to check Paperless sync status',
        entityType,
        entityId,
        error: err.message,
        component: 'DocumentManagerCore',
      });
    } finally {
      if (isManualSync) setSyncLoading(false);
    }
  }, [entityType, entityId, loadFiles]);

  // Performance optimization: Split file loading effect from paperless settings
  // This prevents unnecessary file reloads when paperless settings change
  useEffect(() => {
    if (entityId && mode !== 'create') {
      setLoading(true);
      loadFiles().finally(() => {
        setLoading(false);
      });
    }
  }, [entityId, mode, loadFiles]);

  // Load paperless settings only once on mount
  useEffect(() => {
    loadPaperlessSettings();
  }, []);

  // Add pending file for batch upload
  const handleAddPendingFile = useCallback((file, description = '') => {
    monitoredSetPendingFiles(prev => [...prev, { file, description, id: Date.now() }]);
  }, [monitoredSetPendingFiles]);

  // Remove pending file
  const handleRemovePendingFile = useCallback(fileId => {
    monitoredSetPendingFiles(prev => prev.filter(f => f.id !== fileId));
  }, [monitoredSetPendingFiles]);

  // Mark file for deletion
  const handleMarkFileForDeletion = useCallback(fileId => {
    setFilesToDelete(prev => [...prev, fileId]);
  }, []);

  // Unmark file for deletion
  const handleUnmarkFileForDeletion = useCallback(fileId => {
    setFilesToDelete(prev => prev.filter(id => id !== fileId));
  }, []);

  // Performance optimization: Memoize expensive event handlers
  const handleImmediateUpload = useCallback(async (file, description = '') => {
    if (!entityId) {
      setError('Cannot upload file: entity ID not provided');
      return;
    }

    // Show progress modal for single file upload
    if (showProgressModal) {
      startUpload([{ 
        id: `single-${Date.now()}`, 
        name: file.name, 
        size: file.size, 
        description 
      }]);
    }

    // Performance optimization: Batch initial state updates
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
        component: 'DocumentManagerCore',
      });

      // Update progress for single file
      if (showProgressModal) {
        updateFileProgress(`single-${Date.now()}`, 10, 'uploading');
      }

      await apiService.uploadEntityFile(
        entityType,
        entityId,
        file,
        description,
        '',
        selectedStorageBackend
      );

      // Update progress to completion
      if (showProgressModal) {
        updateFileProgress(`single-${Date.now()}`, 100, 'completed');
        completeUpload(true, `${file.name} uploaded successfully!`);
      }

      // Reload files
      await loadFiles();

      if (!showProgressModal) {
        notifications.show({
          title: 'File Uploaded',
          message: formatErrorWithContext(SUCCESS_MESSAGES.UPLOAD_SUCCESS, file.name),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }

      logger.info('document_manager_upload_success', {
        message: 'File uploaded successfully',
        entityType,
        entityId,
        fileName: file.name,
        component: 'DocumentManagerCore',
      });
    } catch (err) {
      let errorMessage;

      // Enhance error messages for Paperless or use generic error handling
      if (selectedStorageBackend === 'paperless') {
        errorMessage = enhancePaperlessError(err.message || '');
      } else {
        errorMessage = getUserFriendlyError(err, 'upload');
      }
      
      // Add file context to the error message
      errorMessage = formatErrorWithContext(errorMessage, file.name);

      if (showProgressModal) {
        updateFileProgress(`single-${Date.now()}`, 0, 'failed', errorMessage);
        completeUpload(false, errorMessage);
      } else {
        notifications.show({
          title: 'Upload Failed',
          message: errorMessage,
          color: 'red',
          icon: <IconX size={16} />,
        });
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
        component: 'DocumentManagerCore',
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, selectedStorageBackend, paperlessSettings, showProgressModal, startUpload, updateFileProgress, completeUpload, loadFiles, onError]);

  // Batch upload pending files with progress tracking
  const uploadPendingFiles = useCallback(async targetEntityId => {
    const currentPendingFiles = pendingFilesRef.current;

    logger.info('document_manager_batch_upload_start', {
      message: 'Starting batch upload with progress tracking',
      entityType,
      targetEntityId,
      pendingFilesCount: currentPendingFiles.length,
      component: 'DocumentManagerCore',
    });

    if (currentPendingFiles.length === 0) {
      return true;
    }

    // Start progress tracking
    if (showProgressModal) {
      const progressFiles = currentPendingFiles.map((pf, index) => ({
        id: `batch-${index}`,
        name: pf.file.name,
        size: pf.file.size,
        description: pf.description,
      }));
      startUpload(progressFiles);
    }

    const uploadPromises = currentPendingFiles.map(async (pendingFile, index) => {
      const fileId = `batch-${index}`;

      try {
        // Mark as starting
        if (showProgressModal) {
          debouncedUpdateProgress(fileId, 5, 'uploading');
        }

        const currentStorageBackend = selectedStorageBackendRef.current;
        const currentPaperlessSettings = paperlessSettingsRef.current;

        logger.info('document_manager_individual_batch_upload', {
          message: 'Starting individual file upload in batch',
          entityType,
          targetEntityId,
          fileName: pendingFile.file.name,
          selectedStorageBackend: currentStorageBackend,
          component: 'DocumentManagerCore',
        });

        // Simulate progress updates for better UX with proper interval tracking
        let progressInterval = null;
        if (showProgressModal && currentStorageBackend === 'paperless') {
          let currentProgress = 10;
          progressInterval = setInterval(() => {
            if (currentProgress < 85) {
              currentProgress += Math.random() * UPLOAD_CONFIG.PROGRESS_SIMULATION_RATE;
              debouncedUpdateProgress(fileId, Math.min(currentProgress, 85), 'uploading');
            }
          }, UPLOAD_CONFIG.PROGRESS_UPDATE_INTERVAL);
          
          // Track interval for cleanup
          progressIntervalsRef.current.add(progressInterval);
        }

        try {
          await apiService.uploadEntityFile(
            entityType,
            targetEntityId,
            pendingFile.file,
            pendingFile.description,
            '',
            currentStorageBackend
          );

          // Clean up interval properly
          if (progressInterval) {
            clearInterval(progressInterval);
            progressIntervalsRef.current.delete(progressInterval);
          }

          // Mark as completed
          if (showProgressModal) {
            updateFileProgress(fileId, 100, 'completed');
          }

          logger.info('document_manager_individual_batch_success', {
            message: 'Individual file uploaded successfully in batch',
            entityType,
            targetEntityId,
            fileName: pendingFile.file.name,
            component: 'DocumentManagerCore',
          });
        } catch (error) {
          // Clean up interval on error
          if (progressInterval) {
            clearInterval(progressInterval);
            progressIntervalsRef.current.delete(progressInterval);
          }
          throw error;
        }
      } catch (error) {
        let errorMessage;

        // Enhance error messages for Paperless or use generic error handling
        if (selectedStorageBackendRef.current === 'paperless') {
          errorMessage = enhancePaperlessError(error.message || '');
        } else {
          errorMessage = getUserFriendlyError(error, 'upload');
        }
        
        // Add file context to the error message
        errorMessage = formatErrorWithContext(errorMessage, pendingFile.file.name);

        // Mark as failed
        if (showProgressModal) {
          updateFileProgress(fileId, 0, 'failed', errorMessage);
        }

        logger.error('document_manager_individual_batch_error', {
          message: 'Individual file upload failed in batch',
          entityType,
          targetEntityId,
          fileName: pendingFile.file.name,
          error: error.message,
          enhancedError: errorMessage,
          component: 'DocumentManagerCore',
        });

        throw new Error(errorMessage);
      }
    });

    try {
      await Promise.all(uploadPromises);

      // Complete successfully
      if (showProgressModal) {
        completeUpload(true, `All ${currentPendingFiles.length} file(s) uploaded successfully!`);
      }

      monitoredSetPendingFiles([]);

      // Refresh data
      await loadFiles();

      if (onUploadComplete) {
        onUploadComplete(true, currentPendingFiles.length, 0);
      }

      logger.info('document_manager_batch_upload_complete', {
        message: 'Batch upload completed successfully',
        entityType,
        targetEntityId,
        fileCount: currentPendingFiles.length,
        component: 'DocumentManagerCore',
      });

      return true;
    } catch (error) {
      // Some files failed
      const completedCount = uploadState.files.filter(f => f.status === 'completed').length;
      const failedCount = uploadState.files.filter(f => f.status === 'failed').length;

      if (showProgressModal) {
        completeUpload(false, `Upload completed with errors: ${completedCount} succeeded, ${failedCount} failed.`);
      }

      if (onUploadComplete) {
        onUploadComplete(false, completedCount, failedCount);
      }

      logger.error('document_manager_batch_upload_failed', {
        message: 'Batch upload completed with errors',
        entityType,
        targetEntityId,
        completedCount,
        failedCount,
        error: error.message,
        component: 'DocumentManagerCore',
      });

      throw error;
    }
  }, [
    entityType,
    showProgressModal,
    startUpload,
    updateFileProgress,
    completeUpload,
    uploadState.files,
    loadFiles,
    onUploadComplete,
  ]);

  // Performance optimization: Memoize download handler
  const handleDownloadFile = useCallback(async (fileId, fileName) => {
    try {
      await apiService.downloadEntityFile(fileId, fileName);

      logger.info('document_manager_download_success', {
        message: 'File downloaded successfully',
        entityType,
        entityId,
        fileId,
        fileName,
        component: 'DocumentManagerCore',
      });
    } catch (err) {
      const errorMessage = getUserFriendlyError(err, 'download');
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
        component: 'DocumentManagerCore',
      });
    }
  }, [entityType, entityId, onError]);

  // Performance optimization: Memoize delete handler
  const handleImmediateDelete = useCallback(async fileId => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    // Performance optimization: Batch state updates for delete operation
    setLoading(true);
    setError('');

    try {
      await apiService.deleteEntityFile(fileId);
      await loadFiles();

      notifications.show({
        title: 'File Deleted',
        message: SUCCESS_MESSAGES.FILE_DELETED,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      logger.info('document_manager_delete_success', {
        message: 'File deleted successfully',
        entityType,
        entityId,
        fileId,
        component: 'DocumentManagerCore',
      });
    } catch (err) {
      const errorMessage = getUserFriendlyError(err, 'delete');
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
        component: 'DocumentManagerCore',
      });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, loadFiles, onError]);

  // Performance optimization: Memoize pending file description change handler
  const handlePendingFileDescriptionChange = useCallback((fileId, description) => {
    monitoredSetPendingFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, description } : f
      )
    );
  }, [monitoredSetPendingFiles]);

  // Performance optimization: Memoize sync check handler
  const handleCheckSyncStatus = useCallback(() => {
    checkSyncStatus(true);
  }, [checkSyncStatus]);

  // Cleanup function to clear all intervals on component unmount
  useEffect(() => {
    return () => {
      // Clear all tracked progress intervals
      progressIntervalsRef.current.forEach(interval => {
        clearInterval(interval);
      });
      progressIntervalsRef.current.clear();
      
      // Performance monitoring: Log final component stats
      logger.info('document_manager_cleanup', {
        message: 'Component unmounting with performance stats',
        intervalCount: progressIntervalsRef.current.size,
        totalRenders: performanceMonitorInstance?.renderCount || 0,
        totalStateUpdates: performanceMonitorInstance?.stateUpdateCount || 0,
        component: 'DocumentManagerCore',
      });
    };
  }, []);

  // Return all state and handlers for the main component to use
  return {
    // State
    files,
    pendingFiles,
    filesToDelete,
    loading,
    error,
    setError,
    syncStatus,
    syncLoading,
    paperlessSettings,
    selectedStorageBackend,
    setSelectedStorageBackend,
    paperlessLoading,
    
    // Statistics
    progressStats,
    fileStats,
    pendingStats,
    
    // Handlers
    handleAddPendingFile,
    handleRemovePendingFile,
    handleMarkFileForDeletion,
    handleUnmarkFileForDeletion,
    handleImmediateUpload,
    uploadPendingFiles,
    handleDownloadFile,
    handleImmediateDelete,
    handlePendingFileDescriptionChange,
    handleCheckSyncStatus,
    loadFiles,
    checkSyncStatus,
    
    // API
    getPendingFilesCount: () => pendingFilesRef.current.length,
    hasPendingFiles: () => pendingFilesRef.current.length > 0,
    clearPendingFiles: () => monitoredSetPendingFiles([]),
  };
};

export default DocumentManagerCore;