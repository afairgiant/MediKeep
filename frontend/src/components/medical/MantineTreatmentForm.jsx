import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@mantine/core';
import BaseMedicalForm from './BaseMedicalForm';
import { treatmentFormFields } from '../../utils/medicalFormFields';
import PractitionerSelectWithCreate from './practitioners/PractitionerSelectWithCreate';

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
  const { t } = useTranslation('medical');

  // Convert conditions to dynamic options format
  const conditionOptions = conditionsOptions.map(condition => ({
    value: String(condition.id),
    label: `${condition.diagnosis}${condition.severity ? ` (${condition.severity})` : ''}${condition.status ? ` - ${condition.status}` : ''}`,
  }));

  const dynamicOptions = {
    conditions: conditionOptions,
  };

  const loadingStates = {
    conditions: conditionsLoading,
  };

  const customFieldRenderers = useMemo(
    () => ({
      practitioner_id: (_fieldConfig, baseProps) => (
        <PractitionerSelectWithCreate
          value={baseProps.value ? String(baseProps.value) : null}
          onChange={value =>
            onInputChange({ target: { name: 'practitioner_id', value: value || '' } })
          }
          practitioners={practitionersOptions}
          label={baseProps.label}
          placeholder={baseProps.placeholder}
          description={baseProps.description}
        />
      ),
    }),
    [onInputChange, practitionersOptions]
  );

  // Get status color for visual feedback
  const getStatusColor = status => {
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
    {
      value: 'planned',
      label: t('treatments.treatmentStatus.options.planned'),
    },
    { value: 'active', label: t('treatments.treatmentStatus.options.active') },
    { value: 'on-hold', label: t('treatments.treatmentStatus.options.onHold') },
    {
      value: 'completed',
      label: t('treatments.treatmentStatus.options.completed'),
    },
    {
      value: 'cancelled',
      label: t('treatments.treatmentStatus.options.cancelled'),
    },
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
      customFieldRenderers={customFieldRenderers}
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
