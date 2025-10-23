import React, { useCallback, useMemo } from 'react';
import UploadProgressModal from './UploadProgressModal';
import UploadProgressErrorBoundary from './UploadProgressErrorBoundary';
import { useUploadProgress } from '../../hooks/useUploadProgress';

/**
 * ProgressTracking - Handles all progress-related functionality
 * Manages progress modal rendering, progress calculations, and upload completion handling
 */
const ProgressTracking = React.memo(({
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

  // Memoize progress props to prevent unnecessary re-renders
  const progressProps = useMemo(() => ({
    uploadState,
    startUpload,
    updateFileProgress,
    completeUpload,
    resetUpload,
    isModalOpen,
    canRetry,
    estimatedTimeRemaining,
    uploadSpeed,
  }), [
    uploadState,
    startUpload,
    updateFileProgress,
    completeUpload,
    resetUpload,
    isModalOpen,
    canRetry,
    estimatedTimeRemaining,
    uploadSpeed,
  ]);

  // Render children with progress functions
  const renderChildren = useCallback(() => {
    if (typeof children === 'function') {
      return children(progressProps);
    }
    return children;
  }, [children, progressProps]);

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
}, (prevProps, nextProps) => {
  // Only re-render if showProgressModal or onUploadComplete changes
  return prevProps.showProgressModal === nextProps.showProgressModal &&
         prevProps.onUploadComplete === nextProps.onUploadComplete &&
         prevProps.children === nextProps.children;
});

export default ProgressTracking;