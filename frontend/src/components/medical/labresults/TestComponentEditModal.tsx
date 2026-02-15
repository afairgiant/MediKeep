/**
 * TestComponentEditModal - Modal for editing individual test components
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  Group,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Text,
  Box,
  Alert,
  Divider
} from '@mantine/core';
import { IconEdit, IconAlertCircle, IconLink } from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import { LabTestComponent } from '../../../services/api/labTestComponentApi';
import { TEST_LIBRARY } from '../../../constants/testLibrary';

interface TestComponentEditModalProps {
  component: LabTestComponent | null;
  opened: boolean;
  onClose: () => void;
  onSubmit: (updatedData: Partial<LabTestComponent>) => Promise<void>;
}

const TestComponentEditModal: React.FC<TestComponentEditModalProps> = ({
  component,
  opened,
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation('common');
  const [formData, setFormData] = useState<Partial<LabTestComponent>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate status based on value and reference range
  const calculateStatus = (
    value: number | undefined,
    refMin: number | undefined,
    refMax: number | undefined
  ): LabTestComponent['status'] => {
    if (value === undefined || value === null) return undefined;

    // If no reference range is provided, can't determine status
    if (refMin === undefined && refMax === undefined) return undefined;

    // If value is a number and we have ranges, calculate status
    if (typeof value === 'number' && !isNaN(value)) {
      // Both min and max defined
      if (refMin !== undefined && refMax !== undefined) {
        if (value < refMin) return 'low';
        if (value > refMax) return 'high';
        return 'normal';
      }
      // Only min defined
      if (refMin !== undefined && refMax === undefined) {
        if (value < refMin) return 'low';
        return 'normal';
      }
      // Only max defined
      if (refMax !== undefined && refMin === undefined) {
        if (value > refMax) return 'high';
        return 'normal';
      }
    }

    return undefined;
  };

  // Auto-suggest category based on test name
  const suggestCategory = (testName: string): LabTestComponent['category'] => {
    if (!testName) return undefined;

    const nameLower = testName.toLowerCase();

    // Blood Chemistry & Metabolic
    if (nameLower.includes('glucose') || nameLower.includes('bun') ||
        nameLower.includes('creatinine') || nameLower.includes('sodium') ||
        nameLower.includes('potassium') || nameLower.includes('chloride') ||
        nameLower.includes('calcium') || nameLower.includes('protein') ||
        nameLower.includes('albumin') || nameLower.includes('bilirubin') ||
        nameLower.includes('alt') || nameLower.includes('ast') ||
        nameLower.includes('alp') || nameLower.includes('aminotransferase') ||
        nameLower.includes('phosphatase')) {
      return 'chemistry';
    }

    // Blood Counts & Cells
    if (nameLower.includes('hemoglobin') || nameLower.includes('hematocrit') ||
        nameLower.includes('wbc') || nameLower.includes('rbc') ||
        nameLower.includes('platelet') || nameLower.includes('mcv') ||
        nameLower.includes('mch') || nameLower.includes('mchc') ||
        nameLower.includes('white blood') || nameLower.includes('red blood') ||
        nameLower.includes('neutrophil') || nameLower.includes('lymphocyte') ||
        nameLower.includes('monocyte') || nameLower.includes('eosinophil') ||
        nameLower.includes('basophil')) {
      return 'hematology';
    }

    // Cholesterol & Lipids
    if (nameLower.includes('cholesterol') || nameLower.includes('triglyceride') ||
        nameLower.includes('hdl') || nameLower.includes('ldl') ||
        nameLower.includes('vldl') || nameLower.includes('lipid')) {
      return 'lipids';
    }

    // Hormones & Thyroid
    if (nameLower.includes('tsh') || nameLower.includes('thyroid') ||
        nameLower.includes('t3') || nameLower.includes('t4') ||
        nameLower.includes('hormone') || nameLower.includes('testosterone') ||
        nameLower.includes('estrogen') || nameLower.includes('progesterone') ||
        nameLower.includes('cortisol') || nameLower.includes('insulin')) {
      return 'endocrinology';
    }

    // Immune System & Antibodies
    if (nameLower.includes('antibod') || nameLower.includes('immuno') ||
        nameLower.includes('igg') || nameLower.includes('igm') ||
        nameLower.includes('iga') || nameLower.includes('ige')) {
      return 'immunology';
    }

    // Infections & Cultures
    if (nameLower.includes('culture') || nameLower.includes('bacterial') ||
        nameLower.includes('viral') || nameLower.includes('infection') ||
        nameLower.includes('sensitivity')) {
      return 'microbiology';
    }

    return undefined;
  };

  // Build dropdown options for canonical test name from test library
  const canonicalTestOptions = useMemo(() => {
    const options = TEST_LIBRARY.map(test => ({
      value: test.test_name,
      label: test.abbreviation ? `${test.test_name} (${test.abbreviation})` : test.test_name
    }));
    // Sort alphabetically
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Initialize form when component changes
  useEffect(() => {
    if (component) {
      const calculatedStatus = calculateStatus(
        component.value,
        component.ref_range_min ?? undefined,
        component.ref_range_max ?? undefined
      );

      // Use existing category if present, otherwise suggest one
      const categoryToUse = component.category || suggestCategory(component.test_name);

      setFormData({
        test_name: component.test_name,
        abbreviation: component.abbreviation || '',
        test_code: component.test_code || '',
        value: component.value,
        unit: component.unit,
        ref_range_min: component.ref_range_min ?? undefined,
        ref_range_max: component.ref_range_max ?? undefined,
        ref_range_text: component.ref_range_text || '',
        status: calculatedStatus,
        category: categoryToUse,
        canonical_test_name: component.canonical_test_name || '',
        notes: component.notes || ''
      });
    }
  }, [component]);

  // Effect to recalculate status when value or ranges change
  // Note: formData.status and formData.category are NOT in dependencies since they're outputs, not inputs
  useEffect(() => {
    const newStatus = calculateStatus(
      formData.value as number,
      formData.ref_range_min as number | undefined,
      formData.ref_range_max as number | undefined
    );

    // Only update if status actually changed to avoid infinite loops
    setFormData(prev => {
      if (prev.status === newStatus) {
        return prev;
      }
      return { ...prev, status: newStatus };
    });
  }, [formData.value, formData.ref_range_min, formData.ref_range_max]);

  // Separate effect for auto-suggesting category when test name changes
  useEffect(() => {
    // Only suggest category if test_name exists and category is empty
    if (!formData.test_name) return;

    setFormData(prev => {
      // Only suggest if category is currently empty
      if (prev.category) return prev;

      const suggestedCategory = suggestCategory(formData.test_name);
      if (suggestedCategory) {
        return { ...prev, category: suggestedCategory };
      }
      return prev;
    });
  }, [formData.test_name]);

  const handleSubmit = async () => {
    if (!component) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!component) return null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconEdit size={20} />
          <Text fw={600}>{t('testComponents.editModal.title', 'Edit Test Component')}</Text>
        </Group>
      }
      size="lg"
      centered
      zIndex={3000}
    >
      <Box style={{ position: 'relative' }}>
        <FormLoadingOverlay
          visible={isSubmitting}
          message={t('testComponents.editModal.updating', 'Updating test component...')}
        />

        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            {t('testComponents.editModal.editing', 'Editing')}: <strong>{component.test_name}</strong>
          </Alert>

          {/* Test Name */}
          <TextInput
            label={t('testComponents.editModal.fields.testName', 'Test Name')}
            placeholder={t('testComponents.editModal.placeholders.testName', 'e.g., Hemoglobin')}
            required
            value={formData.test_name || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, test_name: e.target.value }))}
          />

          {/* Abbreviation and Test Code */}
          <Group grow>
            <TextInput
              label={t('testComponents.editModal.fields.abbreviation', 'Abbreviation')}
              placeholder={t('testComponents.editModal.placeholders.abbreviation', 'e.g., HGB')}
              value={formData.abbreviation || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, abbreviation: e.target.value }))}
            />
            <TextInput
              label={t('testComponents.editModal.fields.testCode', 'Test Code')}
              placeholder={t('testComponents.editModal.placeholders.testCode', 'e.g., 718-7')}
              value={formData.test_code || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, test_code: e.target.value }))}
            />
          </Group>

          {/* Value and Unit */}
          <Group grow>
            <NumberInput
              label={t('testComponents.editModal.fields.value', 'Value')}
              placeholder={t('testComponents.editModal.placeholders.value', 'Enter test value')}
              required
              value={formData.value}
              onChange={(value) => setFormData(prev => ({ ...prev, value: value as number }))}
              decimalScale={2}
            />
            <TextInput
              label={t('testComponents.editModal.fields.unit', 'Unit')}
              placeholder={t('testComponents.editModal.placeholders.unit', 'e.g., g/dL')}
              required
              value={formData.unit || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
            />
          </Group>

          {/* Reference Range */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>{t('testComponents.editModal.fields.referenceRange', 'Reference Range')}</Text>
            <Group grow>
              <NumberInput
                label={t('testComponents.editModal.fields.minimum', 'Minimum')}
                placeholder={t('testComponents.editModal.placeholders.minValue', 'Min value')}
                value={formData.ref_range_min ?? undefined}
                onChange={(value) => setFormData(prev => ({ ...prev, ref_range_min: value === '' ? undefined : value as number }))}
                decimalScale={2}
              />
              <NumberInput
                label={t('testComponents.editModal.fields.maximum', 'Maximum')}
                placeholder={t('testComponents.editModal.placeholders.maxValue', 'Max value')}
                value={formData.ref_range_max ?? undefined}
                onChange={(value) => setFormData(prev => ({ ...prev, ref_range_max: value === '' ? undefined : value as number }))}
                decimalScale={2}
              />
            </Group>
            <TextInput
              label={t('testComponents.editModal.fields.rangeText', 'Range Text (alternative)')}
              placeholder={t('testComponents.editModal.placeholders.rangeText', "e.g., 'Negative' or 'Male: 13.5-17.5, Female: 12.0-15.5'")}
              value={formData.ref_range_text || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ref_range_text: e.target.value }))}
            />
          </Stack>

          {/* Status (Auto-calculated) and Category */}
          <Group grow>
            <TextInput
              label={t('testComponents.editModal.fields.status', 'Status (Auto-calculated)')}
              value={
                formData.status
                  ? formData.status.charAt(0).toUpperCase() + formData.status.slice(1)
                  : t('testComponents.editModal.notDetermined', 'Not determined')
              }
              readOnly
              styles={{
                input: {
                  backgroundColor: '#f8f9fa',
                  color: formData.status === 'high' || formData.status === 'critical'
                    ? '#fa5252'
                    : formData.status === 'low'
                    ? '#fd7e14'
                    : formData.status === 'normal'
                    ? '#51cf66'
                    : '#868e96',
                  fontWeight: 500
                }
              }}
            />
            <Select
              label={t('testComponents.editModal.fields.category', 'Category')}
              placeholder={t('testComponents.editModal.placeholders.category', 'Select category')}
              clearable
              searchable
              comboboxProps={{ zIndex: 3001 }}
              data={[
                { value: 'chemistry', label: t('testComponents.categories.chemistry', 'Chemistry - Electrolytes & Minerals') },
                { value: 'hematology', label: t('testComponents.categories.hematology', 'Hematology - Blood Counts & Iron') },
                { value: 'hepatology', label: t('testComponents.categories.hepatology', 'Hepatology - Liver Enzymes & Function') },
                { value: 'lipids', label: t('testComponents.categories.lipids', 'Lipids - Cholesterol & Triglycerides') },
                { value: 'endocrinology', label: t('testComponents.categories.endocrinology', 'Endocrinology - Hormones & Diabetes') },
                { value: 'cardiology', label: t('testComponents.categories.cardiology', 'Cardiology - Heart & Cardiac Markers') },
                { value: 'immunology', label: t('testComponents.categories.immunology', 'Immunology - Immune System & Antibodies') },
                { value: 'microbiology', label: t('testComponents.categories.microbiology', 'Microbiology - Infections & Cultures') },
                { value: 'toxicology', label: t('testComponents.categories.toxicology', 'Toxicology - Drug & Toxin Screening') },
                { value: 'genetics', label: t('testComponents.categories.genetics', 'Genetics - Genetic Testing') },
                { value: 'molecular', label: t('testComponents.categories.molecular', 'Molecular - DNA Tests') },
                { value: 'pathology', label: t('testComponents.categories.pathology', 'Pathology - Tissue & Biopsy Analysis') },
                { value: 'other', label: t('testComponents.categories.other', 'Other Tests') },
              ]}
              value={formData.category ?? null}
              onChange={(value) => setFormData(prev => ({
                ...prev,
                category: value as LabTestComponent['category']
              }))}
            />
          </Group>

          {/* Trend Linking */}
          <Divider label={t('testComponents.editModal.trendLinking', 'Trend Linking')} labelPosition="center" />

          <Select
            label={
              <Group gap={4}>
                <IconLink size={14} />
                <Text size="sm">{t('testComponents.editModal.fields.linkedTest', 'Link to Standard Test')}</Text>
              </Group>
            }
            description={t('testComponents.editModal.descriptions.linkedTest', 'Link this test to a standard test name for trend tracking across different lab naming variations')}
            placeholder={t('testComponents.editModal.placeholders.linkedTest', 'Select a standard test to link to...')}
            clearable
            searchable
            comboboxProps={{ zIndex: 3001 }}
            data={canonicalTestOptions}
            value={formData.canonical_test_name || null}
            onChange={(value) => setFormData(prev => ({
              ...prev,
              canonical_test_name: value || ''
            }))}
          />

          {formData.canonical_test_name && (
            <Alert color="blue" variant="light">
              <Text size="sm">
                {t('testComponents.editModal.linkedInfo', 'This test will be grouped with other "{{testName}}" tests in trend charts.', { testName: formData.canonical_test_name })}
              </Text>
            </Alert>
          )}

          {/* Notes */}
          <Textarea
            label={t('labels.notes', 'Notes')}
            placeholder={t('testComponents.editModal.placeholders.notes', 'Additional notes about this test result')}
            rows={3}
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />

          {/* Action Buttons */}
          <Group justify="space-between" mt="md">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('buttons.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.test_name || !formData.unit || formData.value === undefined}
              loading={isSubmitting}
            >
              {t('buttons.saveChanges', 'Save Changes')}
            </Button>
          </Group>
        </Stack>
      </Box>
    </Modal>
  );
};

export default TestComponentEditModal;
