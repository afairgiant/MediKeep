import React from 'react';
import MantinePharmacyForm from '../MantinePharmacyForm';
import logger from '../../../services/logger';

const PharmacyFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPharmacy,
  isLoading,
  statusMessage,
}) => {
  const handleError = (error) => {
    logger.error('pharmacy_form_wrapper_error', {
      message: 'Error in PharmacyFormWrapper',
      editingPharmacy: editingPharmacy?.id,
      error: error.message,
      component: 'PharmacyFormWrapper',
    });
  };

  const handleSubmit = (e) => {
    try {
      e.preventDefault();
      onSubmit(e);
    } catch (error) {
      handleError(error);
    }
  };

  const handleInputChange = (e) => {
    try {
      onInputChange(e);
    } catch (error) {
      handleError(error);
    }
  };

  const handleClose = () => {
    try {
      if (!isLoading) {
        onClose();
      }
    } catch (error) {
      handleError(error);
    }
  };

  if (!isOpen) return null;

  return (
    <MantinePharmacyForm
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingPharmacy={editingPharmacy}
    />
  );
};

export default PharmacyFormWrapper;