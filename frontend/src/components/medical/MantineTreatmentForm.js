import React from 'react';
import { Badge } from '@mantine/core';
import BaseMedicalForm from './BaseMedicalForm';
import { treatmentFormFields } from '../../utils/medicalFormFields';

const MantineTreatmentForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingTreatment = null,
  conditionsOptions = [],
  conditionsLoading = false,
  practitionersOptions = [],
  practitionersLoading = false,
}) => {
  // Convert conditions to dynamic options format
  const conditionOptions = conditionsOptions.map(condition => ({
    value: String(condition.id),
    label: `${condition.diagnosis}${condition.severity ? ` (${condition.severity})` : ''}${condition.status ? ` - ${condition.status}` : ''}`,
  }));

  // Convert practitioners to dynamic options format
  const practitionerOptions = practitionersOptions.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}${practitioner.practice ? ` (${practitioner.practice})` : ''}`,
  }));

  const dynamicOptions = {
    conditions: conditionOptions,
    practitioners: practitionerOptions,
  };

  const loadingStates = {
    conditions: conditionsLoading,
    practitioners: practitionersLoading,
  };

  // Get status color for visual feedback
  const getStatusColor = (status) => {
    switch (status) {
      case 'planned':
        return 'blue';
      case 'active':
        return 'green';
      case 'on-hold':
        return 'yellow';
      case 'completed':
        return 'teal';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Status options with labels
  const statusOptions = [
    { value: 'planned', label: 'Planned - Treatment scheduled for future' },
    { value: 'active', label: 'Active - Currently undergoing treatment' },
    { value: 'on-hold', label: 'On Hold - Temporarily paused' },
    { value: 'completed', label: 'Completed - Treatment finished successfully' },
    { value: 'cancelled', label: 'Cancelled - Treatment discontinued' },
  ];

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingTreatment}
      fields={treatmentFormFields}
      dynamicOptions={dynamicOptions}
      loadingStates={loadingStates}
      modalSize="lg"
    >
      {/* Status Badge Visual Indicator */}
      {formData.status && (
        <div style={{ marginTop: '8px' }}>
          <Badge
            color={getStatusColor(formData.status)}
            variant="light"
            size="sm"
          >
            {statusOptions
              .find(opt => opt.value === formData.status)
              ?.label.split(' - ')[0] || formData.status}
          </Badge>
        </div>
      )}
    </BaseMedicalForm>
  );
};

export default MantineTreatmentForm;