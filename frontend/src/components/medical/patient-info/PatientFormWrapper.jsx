import {
  Modal,
  Stack,
  Alert,
} from '@mantine/core';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import MantinePatientForm from '../MantinePatientForm';
import logger from '../../../services/logger';

const PatientFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners = [],
  isLoading,
  statusMessage,
  isCreating = false,
  error = '',
  onPhotoChange, // New callback for photo changes
}) => {
  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    onSubmit();
  };

  if (!isOpen) return null;

  try {
    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        title={title}
        size="lg"
        closeOnClickOutside={!isLoading}
        closeOnEscape={!isLoading}
      >
        <FormLoadingOverlay visible={isLoading} statusMessage={statusMessage} />

        <Stack gap="md">
          {error && (
            <Alert variant="light" color="red" title="Error">
              {error}
            </Alert>
          )}

          <MantinePatientForm
            formData={formData}
            onInputChange={onInputChange}
            onSave={handleSubmit}
            onCancel={onClose}
            practitioners={practitioners}
            saving={isLoading}
            isCreating={isCreating}
            onPhotoChange={onPhotoChange}
          />
        </Stack>
      </Modal>
    );
  } catch (error) {
    logger.error('patient_form_wrapper_error', {
      message: 'Error in PatientFormWrapper',
      error: error.message,
      component: 'PatientFormWrapper',
      editingItemId: editingItem?.id,
    });

    return (
      <Modal opened={isOpen} onClose={onClose} title="Error">
        <Stack align="center" gap="md">
          <Alert variant="light" color="red" title="Form Error">
            Unable to display the patient form. Please try refreshing the page.
          </Alert>
        </Stack>
      </Modal>
    );
  }
};

export default PatientFormWrapper;