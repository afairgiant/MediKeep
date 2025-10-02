import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  Alert,
  Modal,
  Group,
  Button,
  FileInput,
  TextInput,
} from '@mantine/core';
import {
  IconUpload,
  IconAlertTriangle,
} from '@tabler/icons-react';
import useDocumentManagerCore from './DocumentManagerCore';
import ProgressTracking from './ProgressTracking';
import RenderModeContent from './RenderModeContent';
import DocumentManagerErrorBoundary from './DocumentManagerErrorBoundary';
import logger from '../../services/logger';

// Separate component to properly handle React Hooks
const DocumentManagerContent = ({
  entityType,
  entityId,
  mode,
  onFileCountChange,
  onError,
  onUploadComplete,
  showProgressModal,
  progressProps,
  config,
  showUploadModal,
  setShowUploadModal,
  fileUpload,
  setFileUpload,
  handleFileUploadSubmit,
  updateHandlersRef,
  className
}) => {
  // Get handlers from DocumentManagerCore hook
  const coreHandlers = useDocumentManagerCore({
    entityType,
    entityId,
    mode,
    onFileCountChange,
    onError,
    onUploadComplete,
    showProgressModal,
    ...progressProps
  });

  // Store handlers in ref for stable access
  updateHandlersRef(coreHandlers);

  logger.debug('document_manager_with_progress_render', 'DocumentManagerWithProgress rendering', {
    mode,
    entityType,
    entityId,
    paperlessLoading: coreHandlers.paperlessLoading,
    selectedStorageBackend: coreHandlers.selectedStorageBackend,
    filesCount: coreHandlers.files?.length || 0,
    component: 'DocumentManagerWithProgress'
  });

  return (
    <Stack gap="md" className={className}>
      {/* Error Display */}
      {coreHandlers.error && (
        <Alert
          variant="light"
          color="red"
          title="File Operation Error"
          icon={<IconAlertTriangle size={16} />}
          withCloseButton
          onClose={() => coreHandlers.setError('')}
        >
          {coreHandlers.error}
        </Alert>
      )}

      {/* Main Content */}
      <DocumentManagerErrorBoundary
        componentName="DocumentManager Content"
        onError={onError}
      >
        <RenderModeContent
          mode={mode}
          loading={coreHandlers.loading}
          files={coreHandlers.files}
          paperlessLoading={coreHandlers.paperlessLoading}
          selectedStorageBackend={coreHandlers.selectedStorageBackend}
          onStorageBackendChange={coreHandlers.setSelectedStorageBackend}
          paperlessSettings={coreHandlers.paperlessSettings}
          syncStatus={coreHandlers.syncStatus}
          syncLoading={coreHandlers.syncLoading}
          pendingFiles={coreHandlers.pendingFiles}
          filesToDelete={coreHandlers.filesToDelete}
          config={config}
          onUploadModalOpen={() => setShowUploadModal(true)}
          onCheckSyncStatus={coreHandlers.handleCheckSyncStatus}
          onDownloadFile={coreHandlers.handleDownloadFile}
          onViewFile={coreHandlers.handleViewFile}
          onImmediateDelete={coreHandlers.handleImmediateDelete}
          onMarkFileForDeletion={coreHandlers.handleMarkFileForDeletion}
          onUnmarkFileForDeletion={coreHandlers.handleUnmarkFileForDeletion}
          onAddPendingFile={coreHandlers.handleAddPendingFile}
          onRemovePendingFile={coreHandlers.handleRemovePendingFile}
          onPendingFileDescriptionChange={coreHandlers.handlePendingFileDescriptionChange}
          handleImmediateUpload={coreHandlers.handleImmediateUpload}
        />
      </DocumentManagerErrorBoundary>

      {/* Upload Modal for View Mode */}
      <Modal
        opened={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setFileUpload({ file: null, description: '' });
        }}
        title="Upload File"
        centered
        zIndex={3001}
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
                disabled={!fileUpload.file || coreHandlers.loading}
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

const DocumentManagerWithProgress = React.memo(({
  entityType,
  entityId,
  mode = 'view', // 'view', 'edit', 'create'
  config = {},
  onFileCountChange,
  onError,
  onUploadPendingFiles, // Callback to expose upload function
  className = '',
  showProgressModal = true, // Whether to show the progress modal
  onUploadComplete, // Callback when upload completes
}) => {
  
  // Local state for modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });

  // Refs to store handlers for stable callback functions
  const handlersRef = useRef(null);

  // Performance optimization: Memoize form submission handler
  const handleFileUploadSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!fileUpload.file || !handlersRef.current) return;

    await handlersRef.current.handleImmediateUpload(fileUpload.file, fileUpload.description);
    setFileUpload({ file: null, description: '' });
    setShowUploadModal(false);
  }, [fileUpload.file, fileUpload.description]);

  // Expose upload function to parent when handlers change
  useEffect(() => {
    if (onUploadPendingFiles && handlersRef.current) {
      onUploadPendingFiles({
        uploadPendingFiles: handlersRef.current.uploadPendingFiles,
        getPendingFilesCount: handlersRef.current.getPendingFilesCount,
        hasPendingFiles: handlersRef.current.hasPendingFiles,
        clearPendingFiles: handlersRef.current.clearPendingFiles,
      });
    }
  }, [onUploadPendingFiles]);

  // Update handlers ref when they change - throttled to prevent excessive updates
  const updateHandlersRef = useCallback((handlers) => {
    // Only update if handlers actually changed to prevent unnecessary re-renders
    if (handlersRef.current !== handlers) {
      handlersRef.current = handlers;
      
      // Trigger parent callback update when handlers are ready (debounced)
      if (onUploadPendingFiles && handlers) {
        // Use setTimeout to debounce the callback update
        setTimeout(() => {
          onUploadPendingFiles({
            uploadPendingFiles: handlers.uploadPendingFiles,
            getPendingFilesCount: handlers.getPendingFilesCount,
            hasPendingFiles: handlers.hasPendingFiles,
            clearPendingFiles: handlers.clearPendingFiles,
          });
        }, 50); // 50ms debounce
      }
    }
  }, [onUploadPendingFiles]);

  return (
    <ProgressTracking
      showProgressModal={showProgressModal}
      onUploadComplete={onUploadComplete}
    >
      {(progressProps) => {
        // Get handlers from DocumentManagerCore hook - moved outside callback
        return <DocumentManagerContent 
          entityType={entityType}
          entityId={entityId}
          mode={mode}
          onFileCountChange={onFileCountChange}
          onError={onError}
          onUploadComplete={onUploadComplete}
          showProgressModal={showProgressModal}
          progressProps={progressProps}
          config={config}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
          fileUpload={fileUpload}
          setFileUpload={setFileUpload}
          handleFileUploadSubmit={handleFileUploadSubmit}
          updateHandlersRef={updateHandlersRef}
          className={className}
        />;
        }}
      </ProgressTracking>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  const criticalProps = [
    'entityType',
    'entityId',
    'mode',
    'showProgressModal',
  ];
  
  for (const prop of criticalProps) {
    if (prevProps[prop] !== nextProps[prop]) {
      return false; // Re-render
    }
  }
  
  // Shallow comparison for config object
  if (JSON.stringify(prevProps.config) !== JSON.stringify(nextProps.config)) {
    return false;
  }
  
  return true; // Skip re-render
});

export default DocumentManagerWithProgress;