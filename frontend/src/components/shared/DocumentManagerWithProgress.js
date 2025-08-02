import React, { useState, useCallback, useEffect } from 'react';
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
import DocumentManagerCore from './DocumentManagerCore';
import ProgressTracking from './ProgressTracking';
import RenderModeContent from './RenderModeContent';
import DocumentManagerErrorBoundary from './DocumentManagerErrorBoundary';
import logger from '../../services/logger';


const DocumentManagerWithProgress = ({
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

















  return (
    <ProgressTracking
      showProgressModal={showProgressModal}
      onUploadComplete={onUploadComplete}
    >
      {(progressProps) => {
        // Use DocumentManagerCore to get all handlers and state
        const coreHandlers = DocumentManagerCore({
          entityType,
          entityId,
          mode,
          onFileCountChange,
          onError,
          onUploadComplete,
          showProgressModal,
          ...progressProps,
        });

        // Performance optimization: Memoize form submission handler
        const handleFileUploadSubmit = useCallback(async (e) => {
          e.preventDefault();
          if (!fileUpload.file) return;

          await coreHandlers.handleImmediateUpload(fileUpload.file, fileUpload.description);
          setFileUpload({ file: null, description: '' });
          setShowUploadModal(false);
        }, [fileUpload.file, fileUpload.description, coreHandlers.handleImmediateUpload]);

        // Expose upload function to parent
        useEffect(() => {
          if (onUploadPendingFiles) {
            onUploadPendingFiles({
              uploadPendingFiles: coreHandlers.uploadPendingFiles,
              getPendingFilesCount: coreHandlers.getPendingFilesCount,
              hasPendingFiles: coreHandlers.hasPendingFiles,
              clearPendingFiles: coreHandlers.clearPendingFiles,
            });
          }
        }, [onUploadPendingFiles, coreHandlers.uploadPendingFiles]);

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
                onImmediateDelete={coreHandlers.handleImmediateDelete}
                onMarkFileForDeletion={coreHandlers.handleMarkFileForDeletion}
                onUnmarkFileForDeletion={coreHandlers.handleUnmarkFileForDeletion}
                onAddPendingFile={coreHandlers.handleAddPendingFile}
                onRemovePendingFile={coreHandlers.handleRemovePendingFile}
                onPendingFileDescriptionChange={coreHandlers.handlePendingFileDescriptionChange}
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
      }}
    </ProgressTracking>
  );
};

export default DocumentManagerWithProgress;