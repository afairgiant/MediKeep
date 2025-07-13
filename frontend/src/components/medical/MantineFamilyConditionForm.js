import React from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { familyConditionFormFields } from '../../utils/medicalFormFields';
import logger from '../../services/logger';

const MantineFamilyConditionForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
}) => {
  const dynamicOptions = {
    // Add any dynamic options for family conditions if needed
  };

  // Debug: Log the fields to check if they're properly loaded (only on component mount)
  React.useEffect(() => {
    logger.debug('Family condition form fields loaded', {
      fieldCount: familyConditionFormFields?.length,
      component: 'MantineFamilyConditionForm'
    });
  }, []);

  // Safety check for fields
  if (!familyConditionFormFields || !Array.isArray(familyConditionFormFields)) {
    logger.error('Family condition form fields are not properly defined', {
      component: 'MantineFamilyConditionForm',
      fieldsType: typeof familyConditionFormFields,
      fieldsValue: familyConditionFormFields
    });
    return null;
  }

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingCondition}
      fields={familyConditionFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineFamilyConditionForm;