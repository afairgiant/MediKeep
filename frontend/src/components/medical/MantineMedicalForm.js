import React, { useMemo, useEffect, useRef } from 'react';
import BaseMedicalForm from './BaseMedicalForm';
import { medicationFormFields } from '../../utils/medicalFormFields';
import logger from '../../services/logger';

const MantineMedicalForm = ({
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
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingMedication}
      fields={medicationFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineMedicalForm;
