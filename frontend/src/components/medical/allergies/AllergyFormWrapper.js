import React from 'react';
import {
  Modal,
} from '@mantine/core';
import MantineAllergyForm from '../MantineAllergyForm';
import logger from '../../../services/logger';

const AllergyFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingAllergy,
  formData,
  onInputChange,
  onSubmit,
  medicationsOptions = [],
  medicationsLoading = false,
  isLoading,
}) => {
  const handleError = (error) => {
    logger.error('allergy_form_wrapper_error', {
      message: 'Error in AllergyFormWrapper',
      allergyId: editingAllergy?.id,
      error: error.message,
      component: 'AllergyFormWrapper',
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
      <MantineAllergyForm
        isOpen={isOpen}
        onClose={handleFormClose}
        title={title}
        formData={formData}
        onInputChange={onInputChange}
        onSubmit={handleFormSubmit}
        editingAllergy={editingAllergy}
        medicationsOptions={medicationsOptions}
        medicationsLoading={medicationsLoading}
      />
    </Modal>
  );
};

export default AllergyFormWrapper;