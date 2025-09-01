import React, { memo } from 'react';
import MantineMedicalForm from '../MantineMedicalForm';
import logger from '../../../services/logger';

const MedicationFormWrapper = memo(({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners,
  pharmacies,
  editingMedication,
}) => {
  return (
    <MantineMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      practitioners={practitioners}
      pharmacies={pharmacies}
      editingMedication={editingMedication}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const keysToCompare = [
    'isOpen', 'title', 'formData', 'editingMedication'
  ];
  
  // Check primitive props
  for (const key of keysToCompare) {
    if (prevProps[key] !== nextProps[key]) {
      logger.debug('MedicationFormWrapper re-rendering due to prop change', {
        component: 'MedicationFormWrapper',
        changedProp: key,
        prevValue: prevProps[key],
        nextValue: nextProps[key]
      });
      return false;
    }
  }
  
  // Check array props (practitioners and pharmacies)
  if (prevProps.practitioners !== nextProps.practitioners) {
    // Deep compare if references are different
    if (prevProps.practitioners?.length !== nextProps.practitioners?.length) {
      logger.debug('MedicationFormWrapper re-rendering due to practitioners length change', {
        component: 'MedicationFormWrapper',
        prevLength: prevProps.practitioners?.length || 0,
        nextLength: nextProps.practitioners?.length || 0
      });
      return false;
    }
  }
  
  if (prevProps.pharmacies !== nextProps.pharmacies) {
    // Deep compare if references are different
    if (prevProps.pharmacies?.length !== nextProps.pharmacies?.length) {
      logger.debug('MedicationFormWrapper re-rendering due to pharmacies length change', {
        component: 'MedicationFormWrapper',
        prevLength: prevProps.pharmacies?.length || 0,
        nextLength: nextProps.pharmacies?.length || 0
      });
      return false;
    }
  }
  
  // Function props - these should be stable from parent
  if (prevProps.onClose !== nextProps.onClose ||
      prevProps.onInputChange !== nextProps.onInputChange ||
      prevProps.onSubmit !== nextProps.onSubmit) {
    logger.debug('MedicationFormWrapper re-rendering due to function prop change', {
      component: 'MedicationFormWrapper',
      onCloseChanged: prevProps.onClose !== nextProps.onClose,
      onInputChangeChanged: prevProps.onInputChange !== nextProps.onInputChange,
      onSubmitChanged: prevProps.onSubmit !== nextProps.onSubmit
    });
    return false;
  }
  
  return true; // Props are equal, skip re-render
});

MedicationFormWrapper.displayName = 'MedicationFormWrapper';

export default MedicationFormWrapper;