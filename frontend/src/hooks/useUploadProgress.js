import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconExclamationMark } from '@tabler/icons-react';
import logger from '../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  WARNING_MESSAGES, 
  getUserFriendlyError,
  formatErrorWithContext
} from '../constants/errorMessages';

// Configuration object for upload progress settings
const UPLOAD_CONFIG = {
  PROGRESS_UPDATE_INTERVAL: 800,
  TIME_THRESHOLD_SECONDS: 60000,
  TIME_THRESHOLD_MINUTES: 3600000,
  MAX_RETRY_ATTEMPTS: 3,
  PROGRESS_SIMULATION_RATE: 15
};

/**
 * Hook for managing upload progress state and UI feedback
 * Provides comprehensive upload progress tracking with user feedback
 */
export const useUploadProgress = () => {
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    files: [],
    overallProgress: 0,
    isCompleted: false,
    hasErrors: false,
    canClose: false,
    startTime: null,
    endTime: null,
  });

  const uploadStartTimeRef = useRef(null);
  const progressUpdateIntervalRef = useRef(null);

  // Calculate estimated time remaining based on progress
  const calculateTimeRemaining = useCallback((progress, startTime) => {
    if (!startTime || progress <= 0) return null;
    
    const elapsed = Date.now() - startTime;
    const rate = progress / elapsed;
    const remaining = (100 - progress) / rate;
    
    if (remaining < UPLOAD_CONFIG.TIME_THRESHOLD_SECONDS) {
      return `${Math.round(remaining / 1000)}s`;
    } else if (remaining < UPLOAD_CONFIG.TIME_THRESHOLD_MINUTES) {
      return `${Math.round(remaining / 60000)}m`;
    } else {
      return `${Math.round(remaining / 3600000)}h`;
    }
  }, []);

  // Calculate upload speed
  const calculateUploadSpeed = useCallback((completedBytes, startTime) => {
    if (!startTime || completedBytes <= 0) return null;
    
    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSecond = completedBytes / elapsed;
    
    if (bytesPerSecond < 1024) {
      return `${Math.round(bytesPerSecond)}B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${Math.round(bytesPerSecond / 1024)}KB/s`;
    } else {
      return `${Math.round(bytesPerSecond / (1024 * 1024))}MB/s`;
    }
  }, []);

  // Initialize upload process
  const startUpload = useCallback((files = []) => {
    const startTime = Date.now();
    uploadStartTimeRef.current = startTime;

    const initialFiles = files.map((file, index) => ({
      id: file.id || `file-${index}-${Date.now()}`,
      name: file.name,
      size: file.size || 0,
      description: file.description || '',
      status: 'pending',
      progress: 0,
      error: null,
      startTime: null,
      endTime: null,
    }));

    setUploadState({
      isUploading: true,
      files: initialFiles,
      overallProgress: 0,
      isCompleted: false,
      hasErrors: false,
      canClose: false,
      startTime,
      endTime: null,
    });

    logger.info('upload_progress_started', {
      message: 'Upload progress tracking started',
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      component: 'useUploadProgress',
    });
  }, []);

  // Rate limiting refs for logging
  const lastLogTimeRef = useRef(0);
  const LOG_THROTTLE_MS = 1000; // 1 second throttle for frequent logs

  // Update individual file progress with proper state serialization
  const updateFileProgress = useCallback((fileId, progress, status = 'uploading', error = null) => {
    setUploadState(prev => {
      // Ensure progress is properly bounded (0-100)
      const boundedProgress = Math.min(100, Math.max(0, Number(progress) || 0));
      const currentTime = Date.now();

      const updatedFiles = prev.files.map(file => {
        if (file.id === fileId) {
          const updatedFile = {
            ...file,
            progress: boundedProgress,
            status,
            error,
            lastUpdate: currentTime, // Add timestamp for tracking
          };

          // Set start time when upload begins
          if (status === 'uploading' && !file.startTime) {
            updatedFile.startTime = currentTime;
          }

          // Set end time when upload completes or fails
          if ((status === 'completed' || status === 'failed') && !file.endTime) {
            updatedFile.endTime = currentTime;
          }

          return updatedFile;
        }
        return file;
      });

      // Recalculate overall progress based on current file states
      const validFiles = updatedFiles.filter(f => f.progress !== undefined && f.progress !== null);
      const totalProgress = validFiles.reduce((sum, file) => sum + file.progress, 0);
      const overallProgress = validFiles.length > 0 ? Math.min(100, Math.max(0, totalProgress / validFiles.length)) : 0;

      // Check completion status
      const completedFiles = updatedFiles.filter(f => f.status === 'completed' || f.status === 'failed');
      const isCompleted = completedFiles.length === updatedFiles.length && updatedFiles.length > 0;
      const hasErrors = updatedFiles.some(f => f.status === 'failed');

      // Create serialized state update to prevent race conditions
      const newState = {
        ...prev,
        files: updatedFiles,
        overallProgress: Math.round(overallProgress * 100) / 100, // Round to 2 decimal places
        isCompleted,
        hasErrors,
        canClose: isCompleted,
        endTime: isCompleted && !prev.endTime ? currentTime : prev.endTime,
      };

      // Rate-limited logging - only log significant state changes
      const now = Date.now();
      if (status === 'completed' || status === 'failed' || (status === 'uploading' && boundedProgress === 0)) {
        // Always log important state transitions
        logger.info('upload_progress_state_change', {
          fileId,
          progress: boundedProgress,
          status,
          overallProgress: newState.overallProgress,
          isCompleted,
          component: 'useUploadProgress',
        });
      } else if (now - lastLogTimeRef.current > LOG_THROTTLE_MS) {
        // Throttled debug logging for progress updates
        logger.debug('upload_progress_update', {
          fileId,
          progress: boundedProgress,
          overallProgress: newState.overallProgress,
          component: 'useUploadProgress',
        });
        lastLogTimeRef.current = now;
      }

      return newState;
    });
  }, []);

  // Batch update multiple files
  const updateMultipleFiles = useCallback((updates) => {
    setUploadState(prev => {
      let updatedFiles = [...prev.files];

      updates.forEach(({ fileId, progress, status, error }) => {
        const fileIndex = updatedFiles.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
          const file = updatedFiles[fileIndex];
          updatedFiles[fileIndex] = {
            ...file,
            progress: Math.min(100, Math.max(0, progress)),
            status,
            error,
            startTime: status === 'uploading' && !file.startTime ? Date.now() : file.startTime,
            endTime: (status === 'completed' || status === 'failed') && !file.endTime ? Date.now() : file.endTime,
          };
        }
      });

      // Calculate overall progress
      const totalProgress = updatedFiles.reduce((sum, file) => sum + (file.progress || 0), 0);
      const overallProgress = updatedFiles.length > 0 ? totalProgress / updatedFiles.length : 0;

      // Check completion status
      const completedFiles = updatedFiles.filter(f => f.status === 'completed' || f.status === 'failed');
      const isCompleted = completedFiles.length === updatedFiles.length && updatedFiles.length > 0;
      const hasErrors = updatedFiles.some(f => f.status === 'failed');

      return {
        ...prev,
        files: updatedFiles,
        overallProgress,
        isCompleted,
        hasErrors,
        canClose: isCompleted,
        endTime: isCompleted && !prev.endTime ? Date.now() : prev.endTime,
      };
    });
  }, []);

  // Complete upload process
  const completeUpload = useCallback((success = true, finalMessage = null) => {
    const endTime = Date.now();
    
    setUploadState(prev => {
      const updatedState = {
        ...prev,
        isCompleted: true,
        canClose: true,
        endTime,
        overallProgress: 100,
      };

      // Calculate file stats for notification (but don't show yet)
      const completedFiles = prev.files.filter(f => f.status === 'completed').length;
      const failedFiles = prev.files.filter(f => f.status === 'failed').length;
      const totalFiles = prev.files.length;

      const duration = endTime - (uploadStartTimeRef.current || endTime);
      logger.info('upload_progress_completed', {
        message: 'Upload progress tracking completed',
        success,
        totalFiles,
        completedFiles,
        failedFiles,
        duration,
        component: 'useUploadProgress',
      });

      return updatedState;
    });

    // Show notifications after state update to avoid render phase issues
    setTimeout(() => {
      const currentState = uploadStateRef.current;
      const completedFiles = currentState.files.filter(f => f.status === 'completed').length;
      const failedFiles = currentState.files.filter(f => f.status === 'failed').length;
      const totalFiles = currentState.files.length;

      if (success && failedFiles === 0) {
        notifications.show({
          title: 'Upload Successful',
          message: finalMessage || (totalFiles === 1 ? SUCCESS_MESSAGES.UPLOAD_SUCCESS : SUCCESS_MESSAGES.UPLOAD_MULTIPLE_SUCCESS),
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        });
      } else if (failedFiles > 0) {
        notifications.show({
          title: 'Upload Completed with Errors',
          message: finalMessage || `${completedFiles}/${totalFiles} files uploaded successfully. ${failedFiles} failed.`,
          color: 'orange',
          icon: <IconExclamationMark size={16} />,
          autoClose: 7000,
        });
      } else {
        notifications.show({
          title: 'Upload Failed',
          message: finalMessage || ERROR_MESSAGES.UPLOAD_FAILED,
          color: 'red',
          icon: <IconX size={16} />,
          autoClose: 7000,
        });
      }
    }, 0);
  }, []);

  // Reset upload state
  const resetUpload = useCallback(() => {
    if (progressUpdateIntervalRef.current) {
      clearInterval(progressUpdateIntervalRef.current);
      progressUpdateIntervalRef.current = null;
    }
    
    uploadStartTimeRef.current = null;
    
    setUploadState({
      isUploading: false,
      files: [],
      overallProgress: 0,
      isCompleted: false,
      hasErrors: false,
      canClose: false,
      startTime: null,
      endTime: null,
    });

    logger.info('upload_progress_reset', {
      message: 'Upload progress state reset',
      component: 'useUploadProgress',
    });
  }, []);

  // Force close (emergency close)
  const forceClose = useCallback(() => {
    setUploadState(prev => ({
      ...prev,
      canClose: true,
    }));
  }, []);

  // Get derived state values - memoized to prevent frequent re-calculations
  const derivedState = useMemo(() => {
    const { files, startTime, overallProgress } = uploadState;
    
    // Early return for empty state to avoid unnecessary calculations
    if (!files.length || !uploadState.isUploading) {
      return {
        estimatedTimeRemaining: null,
        uploadSpeed: null,
        completedBytes: 0,
        totalBytes: 0,
      };
    }
    
    const completedBytes = files.reduce((sum, file) => {
      return sum + (file.size || 0) * ((file.progress || 0) / 100);
    }, 0);

    const estimatedTimeRemaining = startTime && overallProgress > 5 
      ? calculateTimeRemaining(overallProgress, startTime)
      : null;

    const uploadSpeed = startTime && completedBytes > 0
      ? calculateUploadSpeed(completedBytes, startTime)
      : null;

    return {
      estimatedTimeRemaining,
      uploadSpeed,
      completedBytes,
      totalBytes: files.reduce((sum, file) => sum + (file.size || 0), 0),
    };
  }, [uploadState.files, uploadState.startTime, uploadState.overallProgress, uploadState.isUploading, calculateTimeRemaining, calculateUploadSpeed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
    };
  }, []);

  // Memoize computed values to prevent recalculation on every render
  const computedValues = useMemo(() => ({
    isModalOpen: uploadState.isUploading,
    canRetry: uploadState.isCompleted && uploadState.hasErrors,
    completedCount: uploadState.files.filter(f => f.status === 'completed').length,
    failedCount: uploadState.files.filter(f => f.status === 'failed').length,
    uploadingCount: uploadState.files.filter(f => f.status === 'uploading').length,
  }), [uploadState.isUploading, uploadState.isCompleted, uploadState.hasErrors, uploadState.files]);

  return {
    // State
    uploadState,
    
    // Derived state
    ...derivedState,
    
    // Actions
    startUpload,
    updateFileProgress,
    updateMultipleFiles,
    completeUpload,
    resetUpload,
    forceClose,
    
    // Computed values
    ...computedValues,
  };
};

export default useUploadProgress;