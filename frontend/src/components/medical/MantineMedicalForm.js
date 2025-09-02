import React, { useMemo, useEffect, useRef, memo, useCallback } from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { medicationFormFields } from '../../utils/medicalFormFields';
import logger from '../../services/logger';

const MantineMedicalForm = memo(({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  pharmacies = [],
  editingMedication = null,
}) => {
  // Track render count and prop changes
  const renderCount = useRef(0);
  const prevProps = useRef({ practitioners, pharmacies });
  
  useEffect(() => {
    renderCount.current++;
    
    // Check what changed
    const practitionersChanged = prevProps.current.practitioners !== practitioners;
    const pharmaciesChanged = prevProps.current.pharmacies !== pharmacies;
    
    logger.debug('MantineMedicalForm render', {
      component: 'MantineMedicalForm',
      renderCount: renderCount.current,
      isOpen,
      practitionersCount: practitioners?.length || 0,
      pharmaciesCount: pharmacies?.length || 0,
      practitionersChanged,
      pharmaciesChanged,
      practitionersType: Array.isArray(practitioners) ? 'array' : typeof practitioners,
      pharmaciesType: Array.isArray(pharmacies) ? 'array' : typeof pharmacies
    });
    
    if (renderCount.current > 20 && isOpen) {
      logger.warn('Excessive renders detected in MantineMedicalForm', {
        component: 'MantineMedicalForm',
        renderCount: renderCount.current,
        practitionersChanged,
        pharmaciesChanged
      });
    }
    
    prevProps.current = { practitioners, pharmacies };
  });

  // Memoize the onClose handler to prevent BaseMedicalForm re-renders
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoize the onSubmit handler to prevent BaseMedicalForm re-renders
  const handleSubmit = useCallback((e) => {
    onSubmit(e);
  }, [onSubmit]);

  // Memoize the onInputChange handler to prevent BaseMedicalForm re-renders
  const handleInputChange = useCallback((e) => {
    onInputChange(e);
  }, [onInputChange]);

  // Convert practitioners to Mantine format - memoized to prevent recreating on every render
  const practitionerOptions = useMemo(() => {
    if (!practitioners || !Array.isArray(practitioners)) return [];
    
    try {
      const options = practitioners.map(practitioner => ({
        value: String(practitioner.id),
        label: `${practitioner.name} - ${practitioner.specialty}`,
      }));
      
      if (options.length > 100) {
        logger.warn('Large number of practitioner options', {
          component: 'MantineMedicalForm',
          optionsCount: options.length
        });
      }
      
      return options;
    } catch (error) {
      logger.error('Error mapping practitioners', {
        component: 'MantineMedicalForm',
        error: error.message
      });
      return [];
    }
  }, [practitioners]);

  // Convert pharmacies to Mantine format - memoized to prevent recreating on every render
  const pharmacyOptions = useMemo(() => {
    if (!pharmacies || !Array.isArray(pharmacies)) return [];
    
    try {
      const options = pharmacies.map(pharmacy => ({
        value: String(pharmacy.id),
        label: `${pharmacy.name}${pharmacy.city ? ` - ${pharmacy.city}` : ''}${pharmacy.state ? `, ${pharmacy.state}` : ''}`,
      }));
      
      if (options.length > 100) {
        logger.warn('Large number of pharmacy options', {
          component: 'MantineMedicalForm',
          optionsCount: options.length
        });
      }
      
      return options;
    } catch (error) {
      logger.error('Error mapping pharmacies', {
        component: 'MantineMedicalForm',
        error: error.message
      });
      return [];
    }
  }, [pharmacies]);

  const dynamicOptions = useMemo(() => ({
    practitioners: practitionerOptions,
    pharmacies: pharmacyOptions,
  }), [practitionerOptions, pharmacyOptions]);

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingMedication}
      fields={medicationFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  
  // Check if modal state changed
  if (prevProps.isOpen !== nextProps.isOpen) {
    return false;
  }
  
  // Check if form data changed
  if (prevProps.formData !== nextProps.formData) {
    return false;
  }
  
  // Check if editing state changed
  if (prevProps.editingMedication !== nextProps.editingMedication) {
    return false;
  }
  
  // Check if title changed
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  
  // Check if practitioners array changed (reference or length)
  if (prevProps.practitioners !== nextProps.practitioners) {
    if (!prevProps.practitioners || !nextProps.practitioners ||
        prevProps.practitioners.length !== nextProps.practitioners.length) {
      return false;
    }
    
    // If lengths are same but references different, do a quick ID comparison
    // to avoid deep comparison on every render
    const prevIds = prevProps.practitioners.map(p => p.id).join(',');
    const nextIds = nextProps.practitioners.map(p => p.id).join(',');
    if (prevIds !== nextIds) {
      return false;
    }
  }
  
  // Check if pharmacies array changed (reference or length)
  if (prevProps.pharmacies !== nextProps.pharmacies) {
    if (!prevProps.pharmacies || !nextProps.pharmacies ||
        prevProps.pharmacies.length !== nextProps.pharmacies.length) {
      return false;
    }
    
    // If lengths are same but references different, do a quick ID comparison
    const prevIds = prevProps.pharmacies.map(p => p.id).join(',');
    const nextIds = nextProps.pharmacies.map(p => p.id).join(',');
    if (prevIds !== nextIds) {
      return false;
    }
  }
  
  // Function props should be stable due to useCallback in parent
  if (prevProps.onClose !== nextProps.onClose ||
      prevProps.onInputChange !== nextProps.onInputChange ||
      prevProps.onSubmit !== nextProps.onSubmit) {
    return false;
  }
  
  return true; // Props are equal, skip re-render
});

MantineMedicalForm.displayName = 'MantineMedicalForm';

export default MantineMedicalForm;
