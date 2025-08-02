import React, { useCallback } from 'react';
import UploadProgressModal from './UploadProgressModal';
import UploadProgressErrorBoundary from './UploadProgressErrorBoundary';
import { useUploadProgress } from '../../hooks/useUploadProgress';

/**
 * ProgressTracking - Handles all progress-related functionality
 * Manages progress modal rendering, progress calculations, and upload completion handling
 */
const ProgressTracking = ({
  showProgressModal = true,
  onUploadComplete,
  children, // Render prop pattern to provide progress functions to children
}) => {
  // Upload progress hook
  const {
    uploadState,
    startUpload,
    updateFileProgress,
    completeUpload,
    resetUpload,
    isModalOpen,
    canRetry,
    estimatedTimeRemaining,
    uploadSpeed,
  } = useUploadProgress();

  // Handle modal close
  const handleProgressModalClose = useCallback(() => {
    if (uploadState.canClose) {
      resetUpload();
    }
  }, [uploadState.canClose, resetUpload]);

  // Handle retry failed uploads
  const handleRetryFailedUploads = useCallback(() => {
    const failedFiles = uploadState.files.filter(f => f.status === 'failed');
    if (failedFiles.length > 0 && onUploadComplete) {
      // Convert back to pending files format for retry
      const retryFiles = failedFiles.map(f => ({
        file: { name: f.name, size: f.size },
        description: f.description,
        id: Date.now() + Math.random(),
      }));
      
      // Call callback with retry files
      onUploadComplete('retry', retryFiles);
      resetUpload();
    }
  }, [uploadState.files, resetUpload, onUploadComplete]);

  // Render children with progress functions
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children({
        uploadState,
        startUpload,
        updateFileProgress,
        completeUpload,
        resetUpload,
        isModalOpen,
        canRetry,
        estimatedTimeRemaining,
        uploadSpeed,
      });
    }
    return children;
  };

  return (
    <>
      {renderChildren()}
      
      {/* Upload Progress Modal */}
      {showProgressModal && (
        <UploadProgressErrorBoundary>
          <UploadProgressModal
            opened={isModalOpen}
            onClose={handleProgressModalClose}
            title="Uploading Files"
            subtitle="Please wait while your files are being uploaded..."
            files={uploadState.files}
            overallProgress={uploadState.overallProgress}
            isCompleted={uploadState.isCompleted}
            hasErrors={uploadState.hasErrors}
            canClose={uploadState.canClose}
            onRetry={handleRetryFailedUploads}
            showRetryButton={canRetry}
            estimatedTimeRemaining={estimatedTimeRemaining}
            uploadSpeed={uploadSpeed}
          />
        </UploadProgressErrorBoundary>
      )}
    </>
  );
};

export default ProgressTracking;