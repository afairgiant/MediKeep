import React from 'react';
import { Divider, Stack, Title } from '@mantine/core';
import BaseMedicalForm from './BaseMedicalForm';
import MedicationRelationships from './MedicationRelationships';
import { conditionFormFields } from '../../utils/medicalFormFields';
import { CONDITION_STATUS_OPTIONS, SEVERITY_OPTIONS } from '../../utils/statusConfig';

const MantineConditionForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
  medications = [],
  conditionMedications = {},
  fetchConditionMedications = null,
  navigate = null,
}) => {
  const dynamicOptions = {
    conditionStatus: CONDITION_STATUS_OPTIONS,
    severity: SEVERITY_OPTIONS,
  };

  // Custom content for medication relationships (only for editing)
  const customContent = editingCondition && medications.length > 0 && fetchConditionMedications && navigate ? (
    <>
      <Divider />
      <Stack gap="md">
        <Title order={4}>Linked Medications</Title>
        <MedicationRelationships 
          conditionId={editingCondition.id}
          conditionMedications={conditionMedications}
          medications={medications}
          fetchConditionMedications={fetchConditionMedications}
          navigate={navigate}
          isViewMode={false}
        />
      </Stack>
    </>
  ) : null;

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingCondition}
      fields={conditionFormFields}
      dynamicOptions={dynamicOptions}
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default MantineConditionForm;
