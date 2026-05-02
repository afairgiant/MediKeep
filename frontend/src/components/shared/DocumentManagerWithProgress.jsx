import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  Stack,
  Alert,
  Modal,
  Group,
  Button,
  FileInput,
  TextInput,
} from '@mantine/core';
import { IconUpload, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import useDocumentManagerCore from './DocumentManagerCore';
import ProgressTracking from './ProgressTracking';
import RenderModeContent from './RenderModeContent';
import DocumentManagerErrorBoundary from './DocumentManagerErrorBoundary';
import LinkPaperlessDocumentModal from './LinkPaperlessDocumentModal';
import LinkPapraDocumentModal from './LinkPapraDocumentModal';
import { linkPaperlessDocument } from '../../services/api/paperlessApi';
import { linkPapraDocument } from '../../services/api/papraApi.jsx';
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
  showLinkModal,
  setShowLinkModal,
  showPapraLinkModal,
  setShowPapraLinkModal,
  fileUpload,
  setFileUpload,
  onUploadModalClose,
  handleUploadConfirm,
  handleLinkDocument,
  handleLinkPapraDocument,
  updateHandlersRef,
  className,
}) => {
  const { t } = useTranslation(['documents', 'shared']);
  // Get handlers from DocumentManagerCore hook
  const coreHandlers = useDocumentManagerCore({
    entityType,
    entityId,
    mode,
    onFileCountChange,
    onError,
    onUploadComplete,
    showProgressModal,
    ...progressProps,
  });

  // Store handlers in ref for stable access
  updateHandlersRef(coreHandlers);

  // logger.debug('document_manager_with_progress_render', 'DocumentManagerWithProgress rendering', {
  //   mode,
  //   entityType,
  //   entityId,
  //   paperlessLoading: coreHandlers.paperlessLoading,
  //   selectedStorageBackend: coreHandlers.selectedStorageBackend,
  //   filesCount: coreHandlers.files?.length || 0,
  //   component: 'DocumentManagerWithProgress'
  // });

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
          pendingLinks={coreHandlers.pendingLinks}
          filesToDelete={coreHandlers.filesToDelete}
          config={config}
          onUploadModalOpen={() => setShowUploadModal(true)}
          onLinkModalOpen={() => setShowLinkModal(true)}
          onPapraLinkModalOpen={() => setShowPapraLinkModal(true)}
          onCheckSyncStatus={coreHandlers.handleCheckSyncStatus}
          onDownloadFile={coreHandlers.handleDownloadFile}
          onViewFile={coreHandlers.handleViewFile}
          onImmediateDelete={coreHandlers.handleImmediateDelete}
          onMarkFileForDeletion={coreHandlers.handleMarkFileForDeletion}
          onUnmarkFileForDeletion={coreHandlers.handleUnmarkFileForDeletion}
          onAddPendingFile={coreHandlers.handleAddPendingFile}
          onRemovePendingFile={coreHandlers.handleRemovePendingFile}
          onPendingFileDescriptionChange={
            coreHandlers.handlePendingFileDescriptionChange
          }
          onRemovePendingLink={coreHandlers.handleRemovePendingLink}
          onPendingLinkDescriptionChange={
            coreHandlers.handlePendingLinkDescriptionChange
          }
          handleImmediateUpload={coreHandlers.handleImmediateUpload}
        />
      </DocumentManagerErrorBoundary>

      {/* Upload Modal */}
      <Modal
        opened={showUploadModal}
        onClose={onUploadModalClose}
        title="Upload File"
        centered
        zIndex={3001}
      >
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
            <Button variant="outline" onClick={onUploadModalClose}>
              {t('shared:fields.cancel')}
            </Button>
            <Button
              disabled={!fileUpload.file || coreHandlers.loading}
              leftSection={<IconUpload size={16} />}
              onClick={handleUploadConfirm}
            >
              {t('manager.uploadNewFile')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Link Paperless Document Modal */}
      <LinkPaperlessDocumentModal
        opened={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLinkDocument={handleLinkDocument}
        entityType={entityType}
        entityId={entityId}
      />

      {/* Link Papra Document Modal */}
      <LinkPapraDocumentModal
        opened={showPapraLinkModal}
        onClose={() => setShowPapraLinkModal(false)}
        onLinkDocument={handleLinkPapraDocument}
        entityType={entityType}
        entityId={entityId}
      />
    </Stack>
  );
};

const DocumentManagerWithProgress = React.memo(
  ({
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
    // Local state for modals
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showPapraLinkModal, setShowPapraLinkModal] = useState(false);
    const [fileUpload, setFileUpload] = useState({
      file: null,
      description: '',
    });

    // Refs to store handlers and current fileUpload for stable callbacks
    const handlersRef = useRef(null);
    const fileUploadRef = useRef(fileUpload);
    useEffect(() => {
      fileUploadRef.current = fileUpload;
    }, [fileUpload]);

    const handleUploadModalClose = useCallback(() => {
      setShowUploadModal(false);
      setFileUpload({ file: null, description: '' });
    }, []);

    const handleUploadConfirm = useCallback(async () => {
      const { file, description } = fileUploadRef.current;
      if (!file || !handlersRef.current) return;

      if (mode === 'create') {
        handlersRef.current.handleAddPendingFile(file, description);
      } else {
        await handlersRef.current.handleImmediateUpload(file, description);
      }
      handleUploadModalClose();
    }, [mode, handleUploadModalClose]);

    // Shared handler for linking documents from remote backends (Paperless, Papra).
    // When the entity has not been saved yet (create mode / no entityId), the
    // operation is queued via the core hook's pending-link queue and flushed
    // after save by uploadPendingFiles(savedEntityId). Otherwise it is POSTed
    // immediately, mirroring the existing edit-mode behavior.
    const createLinkHandler = useCallback(
      (backendName, linkApiFn) => {
        return async linkData => {
          const source = backendName.toLowerCase();
          const eventPrefix = `document_manager_link_${source}`;

          if (!entityId && handlersRef.current?.handleAddPendingLink) {
            handlersRef.current.handleAddPendingLink(linkData);
            logger.info(
              `${eventPrefix}_queued`,
              `${backendName} document queued for linking after entity save`,
              {
                component: 'DocumentManagerWithProgress',
                entityType,
                entityId,
              }
            );
            return;
          }

          try {
            logger.info(eventPrefix, `Linking ${backendName} document`, {
              component: 'DocumentManagerWithProgress',
              entityType,
              entityId,
            });

            await linkApiFn(entityType, entityId, linkData);

            if (handlersRef.current?.loadFiles) {
              await handlersRef.current.loadFiles();
            }

            logger.info(
              `${eventPrefix}_success`,
              `${backendName} document linked successfully`,
              {
                component: 'DocumentManagerWithProgress',
                entityType,
                entityId,
              }
            );
          } catch (error) {
            logger.error(
              `${eventPrefix}_error`,
              `Failed to link ${backendName} document`,
              {
                component: 'DocumentManagerWithProgress',
                error: error.message,
                entityType,
                entityId,
              }
            );
            throw error;
          }
        };
      },
      [entityType, entityId]
    );

    const handleLinkDocument = useCallback(
      linkData =>
        createLinkHandler('Paperless', linkPaperlessDocument)(linkData),
      [createLinkHandler]
    );

    const handleLinkPapraDocument = useCallback(
      linkData => createLinkHandler('Papra', linkPapraDocument)(linkData),
      [createLinkHandler]
    );

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
    const updateHandlersRef = useCallback(
      handlers => {
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
      },
      [onUploadPendingFiles]
    );

    return (
      <ProgressTracking
        showProgressModal={showProgressModal}
        onUploadComplete={onUploadComplete}
      >
        {progressProps => {
          // Get handlers from DocumentManagerCore hook - moved outside callback
          return (
            <DocumentManagerContent
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
              showLinkModal={showLinkModal}
              setShowLinkModal={setShowLinkModal}
              showPapraLinkModal={showPapraLinkModal}
              setShowPapraLinkModal={setShowPapraLinkModal}
              fileUpload={fileUpload}
              setFileUpload={setFileUpload}
              onUploadModalClose={handleUploadModalClose}
              handleUploadConfirm={handleUploadConfirm}
              handleLinkDocument={handleLinkDocument}
              handleLinkPapraDocument={handleLinkPapraDocument}
              updateHandlersRef={updateHandlersRef}
              className={className}
            />
          );
        }}
      </ProgressTracking>
    );
  },
  (prevProps, nextProps) => {
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
  }
);

DocumentManagerWithProgress.displayName = 'DocumentManagerWithProgress';

export default DocumentManagerWithProgress;
