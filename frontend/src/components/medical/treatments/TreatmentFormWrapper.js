import React from 'react';
import {
  Modal,
} from '@mantine/core';
import MantineTreatmentForm from '../MantineTreatmentForm';
import logger from '../../../services/logger';

const TreatmentFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingTreatment,
  formData,
  onInputChange,
  onSubmit,
  conditionsOptions = [],
  conditionsLoading = false,
  practitionersOptions = [],
  practitionersLoading = false,
  isLoading,
}) => {
  const handleError = (error) => {
    logger.error('treatment_form_wrapper_error', {
      message: 'Error in TreatmentFormWrapper',
      treatmentId: editingTreatment?.id,
      error: error.message,
      component: 'TreatmentFormWrapper',
    });
  };

  const handleFormSubmit = async (e) => {
    try {
      await onSubmit(e);
    } catch (error) {
      handleError(error);
      throw error; // Re-throw so the form can handle it
    }
  };

  const handleFormClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={handleFormClose}
      title={title}
      size="lg"
      centered
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <MantineTreatmentForm
        isOpen={isOpen}
        onClose={handleFormClose}
        title={title}
        formData={formData}
        onInputChange={onInputChange}
        onSubmit={handleFormSubmit}
        editingTreatment={editingTreatment}
        conditionsOptions={conditionsOptions}
        conditionsLoading={conditionsLoading}
        practitionersOptions={practitionersOptions}
        practitionersLoading={practitionersLoading}
      />
    </Modal>
  );
};

export default TreatmentFormWrapper;