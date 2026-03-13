import React from 'react';
import { useTranslation } from 'react-i18next';
import { Paper, Title } from '@mantine/core';
import MantineLabResultForm from '../MantineLabResultForm';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import InlineTestComponentEntry from './InlineTestComponentEntry';
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
  onTestComponentRef,
  onFileUploadComplete,
  conditions,
  labResultConditions,
  fetchLabResultConditions,
  encounters,
  labResultEncounters,
  fetchLabResultEncounters,
  navigate,
  onError,
  children
}) => {
  const { t } = useTranslation('common');
  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in lab results ${editingItem ? 'edit' : 'create'}`,
      labResultId: editingItem?.id,
      error,
      component: 'LabResultFormWrapper',
    });
    onError?.(error);
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
    onFileUploadComplete?.(success, completedCount, failedCount);
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
      encounters={encounters}
      labResultEncounters={labResultEncounters}
      fetchLabResultEncounters={fetchLabResultEncounters}
      navigate={navigate}
      isLoading={isLoading}
      statusMessage={statusMessage}
    >
      {!editingItem && (
        <InlineTestComponentEntry
          onRef={onTestComponentRef}
          disabled={isLoading}
        />
      )}

      <Paper withBorder p="md" mt="md">
        <Title order={4} mb="md">
          {editingItem ? t('labResults.form.manageFiles', 'Manage Files') : t('labResults.form.addFilesOptional', 'Add Files')}
        </Title>
        <DocumentManagerWithProgress
          entityType="lab-result"
          entityId={editingItem?.id}
          mode={editingItem ? 'edit' : 'create'}
          onUploadPendingFiles={onDocumentManagerRef}
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