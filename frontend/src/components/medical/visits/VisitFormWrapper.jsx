import React from 'react';
import { Paper, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  labResults,
  encounterLabResults,
  fetchEncounterLabResults,
  navigate,
  children,
}) => {
  const { t } = useTranslation('common');

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in visits ${editingItem ? 'edit' : 'create'}`,
      visitId: editingItem?.id,
      error,
      component: 'VisitFormWrapper',
    });
    onError?.(error);
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
    onFileUploadComplete?.(success, completedCount, failedCount);
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
      labResults={labResults}
      encounterLabResults={encounterLabResults}
      fetchEncounterLabResults={fetchEncounterLabResults}
      navigate={navigate}
    >
      {!editingItem && (
        <Paper withBorder p="md" mt="md">
          <Title order={4} mb="md">
            {t('visits.form.addFilesOptional', 'Add Files (Optional)')}
          </Title>
          <DocumentManagerWithProgress
            entityType="visit"
            entityId={null}
            mode="create"
            onUploadPendingFiles={onDocumentManagerRef}
            showProgressModal={true}
            onUploadComplete={handleDocumentUploadComplete}
            onError={handleDocumentError}
          />
        </Paper>
      )}

      {children}
    </MantineVisitForm>
  );
};

export default VisitFormWrapper;