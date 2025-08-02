import React from 'react';
import { Paper, Title } from '@mantine/core';
import MantineProcedureForm from '../MantineProcedureForm';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import logger from '../../../services/logger';

const ProcedureFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners,
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
      message: `Document manager error in procedures ${editingItem ? 'edit' : 'create'}`,
      procedureId: editingItem?.id,
      error: error,
      component: 'ProcedureFormWrapper',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('procedures_upload_completed', {
      message: 'File upload completed in procedures form',
      procedureId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'ProcedureFormWrapper',
    });
    
    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  return (
    <MantineProcedureForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      editingProcedure={editingItem}
      isLoading={isLoading}
      statusMessage={statusMessage}
    >
      {/* File Management Section for Both Create and Edit Mode */}
      <Paper withBorder p="md" mt="md">
        <Title order={4} mb="md">
          {editingItem ? 'Manage Files' : 'Add Files (Optional)'}
        </Title>
        <DocumentManagerWithProgress
          entityType="procedure"
          entityId={editingItem?.id}
          mode={editingItem ? 'edit' : 'create'}
          config={{
            acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
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
    </MantineProcedureForm>
  );
};

export default ProcedureFormWrapper;