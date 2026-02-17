import React from 'react';
import { Divider, Stack, Title, Paper, Text, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from './BaseMedicalForm';
import ConditionRelationships from './ConditionRelationships';
import { labResultFormFields } from '../../utils/medicalFormFields';

const MantineLabResultForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  editingLabResult = null,
  children, // For file management section in edit mode
  // Condition relationship props
  conditions = [],
  labResultConditions = {},
  fetchLabResultConditions,
  navigate,
}) => {
  const { t } = useTranslation('medical');

  // Status options with visual indicators
  const statusOptions = [
    { value: 'ordered', label: t('labResults.status.ordered') },
    { value: 'in-progress', label: t('labResults.status.inProgress') },
    { value: 'completed', label: t('labResults.status.completed') },
    { value: 'cancelled', label: t('labResults.status.cancelled') },
  ];

  // Test category options
  const categoryOptions = [
    { value: 'blood work', label: t('labResults.category.bloodWork') },
    { value: 'imaging', label: t('labResults.category.imaging') },
    { value: 'pathology', label: t('labResults.category.pathology') },
    { value: 'microbiology', label: t('labResults.category.microbiology') },
    { value: 'chemistry', label: t('labResults.category.chemistry') },
    { value: 'hematology', label: t('labResults.category.hematology') },
    { value: 'hepatology', label: t('labResults.category.hepatology') },
    { value: 'immunology', label: t('labResults.category.immunology') },
    { value: 'genetics', label: t('labResults.category.genetics') },
    { value: 'cardiology', label: t('labResults.category.cardiology') },
    { value: 'pulmonology', label: t('labResults.category.pulmonology') },
    { value: 'hearing', label: t('labResults.category.hearing') },
    { value: 'stomatology', label: t('labResults.category.stomatology') },
    { value: 'other', label: t('labResults.category.other') },
  ];

  // Test type options with urgency levels
  const testTypeOptions = [
    { value: 'routine', label: t('labResults.testType.routine') },
    { value: 'urgent', label: t('labResults.testType.urgent') },
    { value: 'emergency', label: t('labResults.testType.emergency') },
    { value: 'follow-up', label: t('labResults.testType.followUp') },
    { value: 'screening', label: t('labResults.testType.screening') },
  ];

  // Lab result options with color coding
  const labResultOptions = [
    {
      value: 'normal',
      label: t('labResults.result.normal'),
      color: 'green',
    },
    {
      value: 'abnormal',
      label: t('labResults.result.abnormal'),
      color: 'red',
    },
    {
      value: 'critical',
      label: t('labResults.result.critical'),
      color: 'red',
    },
    { value: 'high', label: t('labResults.result.high'), color: 'orange' },
    { value: 'low', label: t('labResults.result.low'), color: 'orange' },
    {
      value: 'borderline',
      label: t('labResults.result.borderline'),
      color: 'yellow',
    },
    {
      value: 'inconclusive',
      label: t('labResults.result.inconclusive'),
      color: 'gray',
    },
  ];

  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  const dynamicOptions = {
    categories: categoryOptions,
    testTypes: testTypeOptions,
    practitioners: practitionerOptions,
    statuses: statusOptions,
    results: labResultOptions,
  };

  // Get status color
  const getStatusColor = status => {
    switch (status) {
      case 'ordered':
        return 'blue';
      case 'in-progress':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Get result badge
  const getResultBadge = result => {
    const option = labResultOptions.find(opt => opt.value === result);
    if (!option) return null;
    return (
      <Badge color={option.color} variant="light" size="sm">
        {option.value.charAt(0).toUpperCase() + option.value.slice(1)}
      </Badge>
    );
  };

  // Custom content for divider, badges, condition relationships, and file management
  const customContent = (
    <>
      <Divider label={t('labResults.form.testDetails')} labelPosition="center" />

      {/* Status Badge */}
      {formData.status && (
        <div style={{ marginTop: '-8px', marginBottom: '8px' }}>
          <Text size="sm" fw={500} mb="xs">{t('labResults.form.statusIndicator')}</Text>
          <Badge
            color={getStatusColor(formData.status)}
            variant="light"
            size="sm"
          >
            {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
          </Badge>
        </div>
      )}

      {/* Result Badge */}
      {formData.labs_result && (
        <div style={{ marginBottom: '16px' }}>
          <Text size="sm" fw={500} mb="xs">{t('labResults.form.resultIndicator')}</Text>
          {getResultBadge(formData.labs_result)}
        </div>
      )}

      {/* Condition Relationships Section for Edit Mode */}
      {editingLabResult && conditions.length > 0 && (
        <>
          <Divider label={t('labResults.form.relatedConditions')} labelPosition="center" mt="lg" />
          <Paper withBorder p="md" bg="gray.1">
            <Stack gap="md">
              <Title order={5}>{t('labResults.form.linkConditionsTitle')}</Title>
              <Text size="sm" c="dimmed">
                {t('labResults.form.linkConditionsDescription')}
              </Text>
              <ConditionRelationships
                labResultId={editingLabResult.id}
                labResultConditions={labResultConditions}
                conditions={conditions}
                fetchLabResultConditions={fetchLabResultConditions}
                navigate={navigate}
              />
            </Stack>
          </Paper>
        </>
      )}

      {/* File Management Section (passed as children for edit mode) */}
      {children}
    </>
  );

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      editingItem={editingLabResult}
      fields={labResultFormFields}
      dynamicOptions={dynamicOptions}
      modalSize="xl"
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default MantineLabResultForm;
