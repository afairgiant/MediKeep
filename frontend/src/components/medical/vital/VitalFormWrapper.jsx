import React from 'react';
import {
  Modal,
} from '@mantine/core';
import VitalsForm from '../VitalsForm';
import logger from '../../../services/logger';

const VitalFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingVital,
  patientId,
  practitionerId,
  onSave,
  error,
  clearError,
  isLoading,
  createItem,
  updateItem,
}) => {
  const handleError = (error) => {
    logger.error('vital_form_wrapper_error', {
      message: 'Error in VitalFormWrapper',
      vitalId: editingVital?.id,
      error: error.message,
      component: 'VitalFormWrapper',
    });
  };

  const handleFormSave = async (formData) => {
    try {
      await onSave(formData);
    } catch (error) {
      handleError(error);
      throw error; // Re-throw so the form can handle it
    }
  };

  const handleFormCancel = () => {
    if (clearError) {
      clearError();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={handleFormCancel}
      title={title}
      size="lg"
      centered
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <VitalsForm
        vitals={editingVital}
        patientId={patientId}
        practitionerId={practitionerId}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
        isEdit={!!editingVital}
        createItem={createItem}
        updateItem={updateItem}
        error={error}
        clearError={clearError}
      />
    </Modal>
  );
};

export default VitalFormWrapper;