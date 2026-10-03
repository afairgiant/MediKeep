import PropTypes from 'prop-types';
import MantineVisitForm from '../MantineVisitForm';
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
  patientId,
  navigate,
  children,
}) => {
  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in visits ${editingItem ? 'edit' : 'create'}`,
      visitId: editingItem?.id,
      error,
      component: 'VisitFormWrapper',
    });
    onError?.(error);
  };

  const handleDocumentUploadComplete = (
    success,
    completedCount,
    failedCount
  ) => {
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
      patientId={patientId}
      navigate={navigate}
      onDocumentManagerRef={onDocumentManagerRef}
      onFileUploadComplete={handleDocumentUploadComplete}
      onDocumentError={handleDocumentError}
    >
      {children}
    </MantineVisitForm>
  );
};

VisitFormWrapper.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  formData: PropTypes.object,
  onInputChange: PropTypes.func,
  onSubmit: PropTypes.func,
  editingItem: PropTypes.object,
  practitioners: PropTypes.array,
  conditions: PropTypes.array,
  isLoading: PropTypes.bool,
  statusMessage: PropTypes.object,
  onDocumentManagerRef: PropTypes.func,
  onFileUploadComplete: PropTypes.func,
  onError: PropTypes.func,
  patientId: PropTypes.number,
  navigate: PropTypes.func,
  children: PropTypes.node,
};

export default VisitFormWrapper;
