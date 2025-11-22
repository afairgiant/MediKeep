import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from './BaseMedicalForm';
import { immunizationFormFields } from '../../utils/medicalFormFields';

const MantineImmunizationForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingImmunization = null,
}) => {
  const { t } = useTranslation('medical');

  // Injection site options with descriptions
  const siteOptions = [
    { value: 'left_arm', label: t('immunizations.siteOptions.leftArm') },
    { value: 'right_arm', label: t('immunizations.siteOptions.rightArm') },
    { value: 'left_deltoid', label: t('immunizations.siteOptions.leftDeltoid') },
    { value: 'right_deltoid', label: t('immunizations.siteOptions.rightDeltoid') },
    { value: 'left_thigh', label: t('immunizations.siteOptions.leftThigh') },
    { value: 'right_thigh', label: t('immunizations.siteOptions.rightThigh') },
  ];

  // Route options with medical descriptions
  const routeOptions = [
    { value: 'intramuscular', label: t('immunizations.routeOptions.intramuscular') },
    { value: 'subcutaneous', label: t('immunizations.routeOptions.subcutaneous') },
    { value: 'intradermal', label: t('immunizations.routeOptions.intradermal') },
    { value: 'oral', label: t('immunizations.routeOptions.oral') },
    { value: 'nasal', label: t('immunizations.routeOptions.nasal') },
  ];

  // Common vaccine manufacturers
  const manufacturerOptions = [
    { value: 'Pfizer-BioNTech', label: t('immunizations.manufacturerOptions.pfizerBioNTech') },
    { value: 'Moderna', label: t('immunizations.manufacturerOptions.moderna') },
    { value: 'Johnson & Johnson', label: t('immunizations.manufacturerOptions.johnsonJohnson') },
    { value: 'AstraZeneca', label: t('immunizations.manufacturerOptions.astraZeneca') },
    { value: 'Merck', label: t('immunizations.manufacturerOptions.merck') },
    { value: 'GlaxoSmithKline', label: t('immunizations.manufacturerOptions.glaxoSmithKline') },
    { value: 'Sanofi', label: t('immunizations.manufacturerOptions.sanofi') },
    { value: 'Other', label: t('immunizations.manufacturerOptions.other') },
  ];

  const dynamicOptions = {
    sites: siteOptions,
    routes: routeOptions,
    manufacturers: manufacturerOptions,
  };

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingImmunization}
      fields={immunizationFormFields}
      dynamicOptions={dynamicOptions}
    />
  );
};

export default MantineImmunizationForm;
