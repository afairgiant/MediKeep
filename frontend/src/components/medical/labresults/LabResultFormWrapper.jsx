import React from 'react';
import { useTranslation } from 'react-i18next';
import { Paper, Title } from '@mantine/core';
import MantineLabResultForm from '../MantineLabResultForm';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import logger from '../../../services/logger';

const LabResultFormWrapper = ({
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
  conditions,
  labResultConditions,
  fetchLabResultConditions,
  navigate,
  onError,
  children
}) => {
  const { t } = useTranslation('common');
  const handleDocumentManagerRef = (methods) => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in lab results ${editingItem ? 'edit' : 'create'}`,
      labResultId: editingItem?.id,
      error: error,
      component: 'LabResultFormWrapper',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('lab_results_upload_completed', {
      message: 'File upload completed in lab results form',
      labResultId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'LabResultFormWrapper',
    });
    
    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  return (
    <MantineLabResultForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      editingLabResult={editingItem}
      conditions={conditions}
      labResultConditions={labResultConditions}
      fetchLabResultConditions={fetchLabResultConditions}
      navigate={navigate}
      isLoading={isLoading}
      statusMessage={statusMessage}
    >
      {/* File Management Section for Both Create and Edit Mode */}
      <Paper withBorder p="md" mt="md">
        <Title order={4} mb="md">
          {editingItem ? t('labResults.form.manageFiles', 'Manage Files') : t('labResults.form.addFilesOptional', 'Add Files (Optional)')}
        </Title>
        <DocumentManagerWithProgress
          entityType="lab-result"
          entityId={editingItem?.id}
          mode={editingItem ? 'edit' : 'create'}
          onUploadPendingFiles={handleDocumentManagerRef}
          showProgressModal={true}
          onUploadComplete={handleDocumentUploadComplete}
          onError={handleDocumentError}
        />
      </Paper>
      
      {children}
    </MantineLabResultForm>
  );
};

export default LabResultFormWrapper;