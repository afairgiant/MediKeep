import React from 'react';
import { Divider, Stack, Title, Paper, Text, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalForm from './BaseMedicalForm';
import ConditionRelationships from './ConditionRelationships';
import LabResultEncounterRelationships from './labresults/LabResultEncounterRelationships';
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
  // Encounter relationship props
  encounters = [],
  labResultEncounters = {},
  fetchLabResultEncounters,
  navigate,
}) => {
  const { t } = useTranslation(['medical', 'shared']);

  // Status options with visual indicators
  const statusOptions = [
    { value: 'ordered', label: t('labresults:status.ordered') },
    { value: 'in-progress', label: t('labresults:status.inProgress') },
    { value: 'completed', label: t('labresults:status.completed') },
    { value: 'cancelled', label: t('labresults:status.cancelled') },
  ];

  // Test category options
  const categoryOptions = [
    { value: 'blood work', label: t('labresults:category.bloodWork') },
    { value: 'imaging', label: t('labresults:category.imaging') },
    { value: 'pathology', label: t('labresults:category.pathology') },
    { value: 'microbiology', label: t('labresults:category.microbiology') },
    { value: 'chemistry', label: t('labresults:category.chemistry') },
    { value: 'hematology', label: t('labresults:category.hematology') },
    { value: 'hepatology', label: t('labresults:category.hepatology') },
    { value: 'immunology', label: t('labresults:category.immunology') },
    { value: 'genetics', label: t('labresults:category.genetics') },
    { value: 'cardiology', label: t('labresults:category.cardiology') },
    { value: 'pulmonology', label: t('labresults:category.pulmonology') },
    { value: 'hearing', label: t('labresults:category.hearing') },
    { value: 'stomatology', label: t('labresults:category.stomatology') },
    { value: 'other', label: t('shared:fields.other') },
  ];

  // Test type options with urgency levels
  const testTypeOptions = [
    { value: 'routine', label: t('labresults:testType.routine') },
    { value: 'urgent', label: t('labresults:testType.urgent') },
    { value: 'emergency', label: t('labresults:testType.emergency') },
    { value: 'follow-up', label: t('labresults:testType.followUp') },
    { value: 'screening', label: t('labresults:testType.screening') },
  ];

  // Lab result options with color coding
  const labResultOptions = [
    {
      value: 'normal',
      label: t('labresults:result.normal'),
      color: 'green',
    },
    {
      value: 'abnormal',
      label: t('labresults:result.abnormal'),
      color: 'red',
    },
    {
      value: 'critical',
      label: t('labresults:result.critical'),
      color: 'red',
    },
    { value: 'high', label: t('labresults:result.high'), color: 'orange' },
    { value: 'low', label: t('labresults:result.low'), color: 'orange' },
    {
      value: 'borderline',
      label: t('labresults:result.borderline'),
      color: 'yellow',
    },
    {
      value: 'inconclusive',
      label: t('labresults:result.inconclusive'),
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
      <Divider label={t('labresults:form.testDetails')} labelPosition="center" />

      {/* Status Badge */}
      {formData.status && (
        <div style={{ marginTop: '-8px', marginBottom: '8px' }}>
          <Text size="sm" fw={500} mb="xs">{t('labresults:form.statusIndicator')}</Text>
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
          <Text size="sm" fw={500} mb="xs">{t('labresults:form.resultIndicator')}</Text>
          {getResultBadge(formData.labs_result)}
        </div>
      )}

      {/* Condition Relationships Section for Edit Mode */}
      {editingLabResult && conditions.length > 0 && (
        <>
          <Divider label={t('shared:labels.relatedConditions')} labelPosition="center" mt="lg" />
          <Paper withBorder p="md" bg="var(--color-bg-secondary)">
            <Stack gap="md">
              <Title order={5}>{t('labresults:form.linkConditionsTitle')}</Title>
              <Text size="sm" c="dimmed">
                {t('labresults:form.linkConditionsDescription')}
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

      {/* Encounter Relationships Section for Edit Mode */}
      {editingLabResult && encounters.length > 0 && (
        <>
          <Divider label={t('common:labResults.form.linkedVisits', 'Linked Visits')} labelPosition="center" mt="lg" />
          <Paper withBorder p="md" bg="var(--color-bg-secondary)">
            <Stack gap="md">
              <Title order={5}>{t('common:labResults.form.linkVisitsTitle', 'Link to Visits')}</Title>
              <Text size="sm" c="dimmed">
                {t('common:labResults.form.linkVisitsDescription', 'Associate this lab result with visits where it was ordered or reviewed.')}
              </Text>
              <LabResultEncounterRelationships
                labResultId={editingLabResult.id}
                labResultEncounters={labResultEncounters}
                encounters={encounters}
                fetchLabResultEncounters={fetchLabResultEncounters}
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
