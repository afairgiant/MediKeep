import React from 'react';
import { Paper, Title } from '@mantine/core';
import MantineVisitForm from '../MantineVisitForm';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import logger from '../../../services/logger';

const VisitFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners,
  conditions,
  isLoading,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
  children
}) => {
  const handleDocumentManagerRef = (methods) => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in visits ${editingItem ? 'edit' : 'create'}`,
      visitId: editingItem?.id,
      error: error,
      component: 'VisitFormWrapper',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('visits_upload_completed', {
      message: 'File upload completed in visits form',
      visitId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'VisitFormWrapper',
    });
    
    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  return (
    <MantineVisitForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      conditionsOptions={conditions}
      editingVisit={editingItem}
      isLoading={isLoading}
      statusMessage={statusMessage}
    >
      {/* File Management Section for Both Create and Edit Mode */}
      <Paper withBorder p="md" mt="md">
        <Title order={4} mb="md">
          {editingItem ? 'Manage Files' : 'Add Files (Optional)'}
        </Title>
        <DocumentManagerWithProgress
          entityType="visit"
          entityId={editingItem?.id}
          mode={editingItem ? 'edit' : 'create'}
          config={{
            acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
            maxSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10
          }}
          onUploadPendingFiles={handleDocumentManagerRef}
          showProgressModal={true}
          onUploadComplete={handleDocumentUploadComplete}
          onError={handleDocumentError}
        />
      </Paper>
      
      {children}
    </MantineVisitForm>
  );
};

export default VisitFormWrapper;