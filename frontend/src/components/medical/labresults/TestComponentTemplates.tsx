/**
 * TestComponentTemplates component for lab test component template selection and entry
 * Provides predefined test templates where users can enter both values and reference ranges
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Title,
  Divider,
  Paper,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Accordion,
  Alert,
  ActionIcon,
  Modal,
  ScrollArea,
  Tooltip,
  Center,
  Box,
  Autocomplete
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconFilter,
  IconTemplate,
  IconFlask,
  IconMedicalCross
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import sanitizeHtml from 'sanitize-html';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import { LabTestComponentCreate, LabTestComponent, labTestComponentApi } from '../../../services/api/labTestComponentApi';
import logger from '../../../services/logger';
import { getAutocompleteOptions, extractTestName, getTestByName } from '../../../constants/testLibrary';

interface TestTemplate {
  id: string;
  category: string;
  tests: Array<{
    test_name: string;
    abbreviation?: string;
    test_code?: string;
    unit: string;
    default_display_order?: number;
    notes?: string;
  }>;
}

interface TestComponentTemplatesProps {
  labResultId: number;
  onComponentsAdded?: (components: LabTestComponent[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

const TestComponentTemplates: React.FC<TestComponentTemplatesProps> = ({
  labResultId,
  onComponentsAdded,
  onError,
  disabled = false
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Track when an autocomplete option was just selected to prevent onChange from overwriting
  const justSelectedRef = useRef<{index: number, value: string} | null>(null);

  const handleError = useCallback((error: Error, context: string) => {
    logger.error('test_component_templates_error', {
      message: `Error in TestComponentTemplates: ${context}`,
      labResultId,
      error: error.message,
      component: 'TestComponentTemplates',
    });

    if (onError) {
      onError(error);
    }
  }, [labResultId, onError]);

  // Predefined test templates organized by category
  const testTemplates: TestTemplate[] = [
    {
      id: 'custom_entry',
      category: 'other',
      tests: [
        { test_name: '', abbreviation: '', test_code: '', unit: '', default_display_order: 1 }
      ]
    },
    {
      id: 'basic_metabolic_panel',
      category: 'chemistry',
      tests: [
        { test_name: 'Glucose', abbreviation: 'GLUC', test_code: '2345-7', unit: 'mg/dL', default_display_order: 1 },
        { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
        { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
        { test_name: 'Sodium', abbreviation: 'Na', test_code: '2951-2', unit: 'mEq/L', default_display_order: 4 },
        { test_name: 'Potassium', abbreviation: 'K', test_code: '2823-3', unit: 'mEq/L', default_display_order: 5 },
        { test_name: 'Chloride', abbreviation: 'Cl', test_code: '2075-0', unit: 'mEq/L', default_display_order: 6 },
        { test_name: 'Carbon Dioxide', abbreviation: 'CO2', test_code: '2028-9', unit: 'mEq/L', default_display_order: 7 },
      ]
    },
    {
      id: 'comprehensive_metabolic_panel',
      category: 'chemistry',
      tests: [
        { test_name: 'Glucose', abbreviation: 'GLUC', test_code: '2345-7', unit: 'mg/dL', default_display_order: 1 },
        { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
        { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
        { test_name: 'Sodium', abbreviation: 'Na', test_code: '2951-2', unit: 'mEq/L', default_display_order: 4 },
        { test_name: 'Potassium', abbreviation: 'K', test_code: '2823-3', unit: 'mEq/L', default_display_order: 5 },
        { test_name: 'Chloride', abbreviation: 'Cl', test_code: '2075-0', unit: 'mEq/L', default_display_order: 6 },
        { test_name: 'Carbon Dioxide', abbreviation: 'CO2', test_code: '2028-9', unit: 'mEq/L', default_display_order: 7 },
        { test_name: 'Total Protein', abbreviation: 'TP', test_code: '2885-2', unit: 'g/dL', default_display_order: 8 },
        { test_name: 'Albumin', abbreviation: 'ALB', test_code: '1751-7', unit: 'g/dL', default_display_order: 9 },
        { test_name: 'Total Bilirubin', abbreviation: 'TBIL', test_code: '1975-2', unit: 'mg/dL', default_display_order: 10 },
        { test_name: 'Alkaline Phosphatase', abbreviation: 'ALP', test_code: '6768-6', unit: 'U/L', default_display_order: 11 },
        { test_name: 'Alanine Aminotransferase', abbreviation: 'ALT', test_code: '1742-6', unit: 'U/L', default_display_order: 12 },
        { test_name: 'Aspartate Aminotransferase', abbreviation: 'AST', test_code: '1920-8', unit: 'U/L', default_display_order: 13 },
      ]
    },
    {
      id: 'complete_blood_count',
      category: 'hematology',
      tests: [
        { test_name: 'White Blood Cell Count', abbreviation: 'WBC', test_code: '6690-2', unit: 'K/uL', default_display_order: 1 },
        { test_name: 'Red Blood Cell Count', abbreviation: 'RBC', test_code: '789-8', unit: 'M/uL', default_display_order: 2 },
        { test_name: 'Hemoglobin', abbreviation: 'HGB', test_code: '718-7', unit: 'g/dL', default_display_order: 3 },
        { test_name: 'Hematocrit', abbreviation: 'HCT', test_code: '4544-3', unit: '%', default_display_order: 4 },
        { test_name: 'Mean Corpuscular Volume', abbreviation: 'MCV', test_code: '787-2', unit: 'fL', default_display_order: 5 },
        { test_name: 'Mean Corpuscular Hemoglobin', abbreviation: 'MCH', test_code: '785-6', unit: 'pg', default_display_order: 6 },
        { test_name: 'Mean Corpuscular Hemoglobin Concentration', abbreviation: 'MCHC', test_code: '786-4', unit: 'g/dL', default_display_order: 7 },
        { test_name: 'Platelet Count', abbreviation: 'PLT', test_code: '777-3', unit: 'K/uL', default_display_order: 8 },
      ]
    },
    {
      id: 'lipid_panel',
      category: 'chemistry',
      tests: [
        { test_name: 'Total Cholesterol', abbreviation: 'CHOL', test_code: '2093-3', unit: 'mg/dL', default_display_order: 1 },
        { test_name: 'Triglycerides', abbreviation: 'TRIG', test_code: '2571-8', unit: 'mg/dL', default_display_order: 2 },
        { test_name: 'HDL Cholesterol', abbreviation: 'HDL', test_code: '2085-9', unit: 'mg/dL', default_display_order: 3 },
        { test_name: 'LDL Cholesterol', abbreviation: 'LDL', test_code: '18262-6', unit: 'mg/dL', default_display_order: 4 },
        { test_name: 'Non-HDL Cholesterol', abbreviation: 'Non-HDL', test_code: '43396-1', unit: 'mg/dL', default_display_order: 5 },
      ]
    },
    {
      id: 'thyroid_function',
      category: 'endocrinology',
      tests: [
        { test_name: 'Thyroid Stimulating Hormone', abbreviation: 'TSH', test_code: '3016-3', unit: 'mIU/L', default_display_order: 1 },
        { test_name: 'Free Thyroxine', abbreviation: 'FT4', test_code: '3024-7', unit: 'ng/dL', default_display_order: 2 },
        { test_name: 'Free Triiodothyronine', abbreviation: 'FT3', test_code: '3051-0', unit: 'pg/mL', default_display_order: 3 },
      ]
    },
    {
      id: 'liver_function',
      category: 'hepatology',
      tests: [
        { test_name: 'Alanine Aminotransferase', abbreviation: 'ALT', test_code: '1742-6', unit: 'U/L', default_display_order: 1 },
        { test_name: 'Aspartate Aminotransferase', abbreviation: 'AST', test_code: '1920-8', unit: 'U/L', default_display_order: 2 },
        { test_name: 'Alkaline Phosphatase', abbreviation: 'ALP', test_code: '6768-6', unit: 'U/L', default_display_order: 3 },
        { test_name: 'Gamma-glutamyl Transferase', abbreviation: 'GGT', test_code: '2324-2', unit: 'U/L', default_display_order: 4 },
        { test_name: 'Total Bilirubin', abbreviation: 'TBIL', test_code: '1975-2', unit: 'mg/dL', default_display_order: 5 },
        { test_name: 'Direct Bilirubin', abbreviation: 'DBIL', test_code: '1968-7', unit: 'mg/dL', default_display_order: 6 },
        { test_name: 'Albumin', abbreviation: 'ALB', test_code: '1751-7', unit: 'g/dL', default_display_order: 7 },
        { test_name: 'Total Protein', abbreviation: 'TP', test_code: '2885-2', unit: 'g/dL', default_display_order: 8 },
        { test_name: 'Somatomedin C', abbreviation: 'IGF-1', test_code: '2484-4', unit: 'ng/mL', default_display_order: 9 },
      ]
    },
    {
      id: 'kidney_function',
      category: 'chemistry',
      tests: [
        { test_name: 'Urea', abbreviation: 'UREA', test_code: '3091-6', unit: 'mg/dL', default_display_order: 1 },
        { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
        { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
        { test_name: 'Estimated GFR', abbreviation: 'eGFR', unit: 'mL/min/1.73m²', default_display_order: 4 },
      ]
    }
  ];

  // Form state for entering test values and reference ranges
  const [formValues, setFormValues] = useState<{
    components: Array<{
      test_name: string;
      abbreviation?: string;
      test_code?: string;
      value: number | '';
      unit: string;
      ref_range_min: number | '';
      ref_range_max: number | '';
      ref_range_text?: string;
      status?: string;
      category?: string;
      display_order?: number;
      notes?: string;
    }>;
  }>({
    components: []
  });

  // Auto-calculate status based on value and reference range
  const calculateStatus = useCallback((
    value: number | '',
    refMin: number | '',
    refMax: number | ''
  ): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value !== 'number' || isNaN(value)) return undefined;

    // If no reference range is provided, can't determine status
    if ((refMin === '' || refMin === null || refMin === undefined) &&
        (refMax === '' || refMax === null || refMax === undefined)) return undefined;

    const min = typeof refMin === 'number' ? refMin : undefined;
    const max = typeof refMax === 'number' ? refMax : undefined;

    // Both min and max defined
    if (min !== undefined && max !== undefined) {
      if (value < min) return 'low';
      if (value > max) return 'high';
      return 'normal';
    }
    // Only min defined
    if (min !== undefined && max === undefined) {
      if (value < min) return 'low';
      return 'normal';
    }
    // Only max defined
    if (max !== undefined && min === undefined) {
      if (value > max) return 'high';
      return 'normal';
    }

    return undefined;
  }, []);

  const validateForm = useCallback(() => {
    // Check if at least one component has a value filled in
    const filledComponents = formValues.components.filter(component => {
      return component.value !== '' && component.value !== null && component.value !== undefined &&
             typeof component.value === 'number' && !isNaN(component.value);
    });

    return filledComponents.length > 0;
  }, [formValues.components]);

  const updateComponent = (index: number, field: string, value: any) => {
    setFormValues(prev => ({
      components: prev.components.map((comp, i) => {
        if (i === index) {
          const updatedComp = { ...comp, [field]: value };

          // Auto-calculate status when value or ranges change
          if (field === 'value' || field === 'ref_range_min' || field === 'ref_range_max') {
            const newStatus = calculateStatus(
              field === 'value' ? value : updatedComp.value,
              field === 'ref_range_min' ? value : updatedComp.ref_range_min,
              field === 'ref_range_max' ? value : updatedComp.ref_range_max
            );
            updatedComp.status = newStatus;
          }

          return updatedComp;
        }
        return comp;
      })
    }));
  };

  const addCustomRow = useCallback(() => {
    setFormValues(prev => ({
      components: [
        ...prev.components,
        {
          test_name: '',
          abbreviation: '',
          test_code: '',
          value: '' as number | '',
          unit: '',
          ref_range_min: '' as number | '',
          ref_range_max: '' as number | '',
          ref_range_text: '',
          status: '',
          display_order: prev.components.length + 1,
          notes: ''
        }
      ]
    }));
  }, []);

  const removeCustomRow = useCallback((index: number) => {
    setFormValues(prev => ({
      components: prev.components.filter((_, i) => i !== index)
    }));
  }, []);

  const filteredTemplates = testTemplates.filter(template => {
    const matchesSearch = searchQuery === '' ||
      template.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tests.some(test =>
        test.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (test.abbreviation && test.abbreviation.toLowerCase().includes(searchQuery.toLowerCase()))
      );

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = useCallback((template: TestTemplate) => {
    setSelectedTemplate(template);

    // Initialize form with template data
    const components = template.tests.map(test => ({
      test_name: test.test_name,
      abbreviation: test.abbreviation || '',
      test_code: test.test_code || '',
      value: '' as number | '',
      unit: test.unit,
      ref_range_min: '' as number | '',
      ref_range_max: '' as number | '',
      ref_range_text: '',
      status: '',
      category: template.category, // Set category from template
      display_order: test.default_display_order,
      notes: test.notes || ''
    }));

    setFormValues({ components });
    setIsModalOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    logger.debug('template_submit_clicked', {
      componentCount: formValues.components.length,
      component: 'TestComponentTemplates'
    });

    const isValid = validateForm();
    logger.debug('template_validation_result', {
      isValid,
      componentCount: formValues.components.length,
      component: 'TestComponentTemplates'
    });

    if (!isValid) {
      logger.warn('template_validation_failed', {
        componentCount: formValues.components.length,
        component: 'TestComponentTemplates'
      });

      notifications.show({
        title: 'No Tests Entered',
        message: 'Please enter test values for at least one test component before submitting.',
        color: 'red',
        autoClose: 5000
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { components } = formValues;

      // Filter to only include components with values (allow partial template entry)
      const filledComponents = components.filter(component => {
        const hasValue = component.value !== '' && component.value !== null && component.value !== undefined &&
                        typeof component.value === 'number' && !isNaN(component.value);

        // For custom entry, also require test_name and unit
        if (selectedTemplate?.id === 'custom_entry') {
          const hasRequiredFields = component.test_name.trim() !== '' && component.unit.trim() !== '';
          return hasValue && hasRequiredFields;
        }

        return hasValue;
      });

      logger.info('template_submitting_components', {
        totalComponents: components.length,
        filledComponents: filledComponents.length,
        component: 'TestComponentTemplates'
      });

      // Sanitize function to prevent XSS using sanitize-html library
      const sanitizeInput = (input: string | undefined): string | null => {
        if (!input) return null;
        // Use sanitize-html to safely remove all HTML tags and scripts
        const sanitized = sanitizeHtml(input, {
          allowedTags: [], // Strip all HTML tags
          allowedAttributes: {} // Strip all attributes
        }).trim();
        return sanitized || null;
      };

      // Convert form data to API format with sanitization
      const componentsToCreate: LabTestComponentCreate[] = filledComponents.map(component => ({
        lab_result_id: labResultId,
        test_name: sanitizeInput(component.test_name) || '',
        abbreviation: sanitizeInput(component.abbreviation),
        test_code: sanitizeInput(component.test_code),
        value: component.value as number,
        unit: sanitizeInput(component.unit) || '',
        ref_range_min: component.ref_range_min === '' ? null : component.ref_range_min as number,
        ref_range_max: component.ref_range_max === '' ? null : component.ref_range_max as number,
        ref_range_text: sanitizeInput(component.ref_range_text),
        status: (component.status as "normal" | "high" | "low" | "critical" | "abnormal" | "borderline" | null) || null,
        category: (component.category as "chemistry" | "hematology" | "hepatology" | "endocrinology" | "immunology" | "microbiology" | "toxicology" | "genetics" | "molecular" | "pathology" | "lipids" | "other" | null) || null,
        display_order: component.display_order || null,
        notes: sanitizeInput(component.notes)
      }));

      // Call the API to create components in bulk
      const response = await labTestComponentApi.createBulkForLabResult(
        labResultId,
        componentsToCreate,
        null // patientId is handled by the API
      );

      notifications.show({
        title: 'Success!',
        message: `Successfully added ${response.created_count} test component${response.created_count !== 1 ? 's' : ''} from ${getTemplateDisplayName(selectedTemplate?.id || '')}`,
        color: 'green',
        autoClose: 4000
      });

      if (onComponentsAdded) {
        onComponentsAdded(response.components);
      }

      setIsModalOpen(false);
      setSelectedTemplate(null);
      setFormValues({ components: [] });
    } catch (error) {
      handleError(error as Error, 'submit_template');
      notifications.show({
        title: 'Error',
        message: 'Failed to add test components. Please try again.',
        color: 'red'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formValues, labResultId, selectedTemplate, onComponentsAdded, handleError, validateForm]);

  const getCategoryDisplayName = (category: string): string => {
    const categoryNames: Record<string, string> = {
      chemistry: 'Chemistry',
      hematology: 'Hematology',
      hepatology: 'Hepatology',
      immunology: 'Immunology',
      microbiology: 'Microbiology',
      endocrinology: 'Endocrinology',
      toxicology: 'Toxicology',
      genetics: 'Genetics',
      molecular: 'Molecular',
      pathology: 'Pathology',
      other: 'Other Tests'
    };
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryColor = (category: string): string => {
    const categoryColors: Record<string, string> = {
      chemistry: 'blue',
      hematology: 'red',
      hepatology: 'lime',
      immunology: 'green',
      microbiology: 'yellow',
      endocrinology: 'purple',
      toxicology: 'orange',
      genetics: 'teal',
      molecular: 'cyan',
      pathology: 'pink',
      other: 'gray'
    };
    return categoryColors[category] || 'gray';
  };

  const getTemplateDisplayName = (templateId: string): string => {
    const templateNames: Record<string, string> = {
      custom_entry: 'Custom Entry',
      basic_metabolic_panel: 'Basic Metabolic Panel (BMP)',
      comprehensive_metabolic_panel: 'Comprehensive Metabolic Panel (CMP)',
      complete_blood_count: 'Complete Blood Count (CBC)',
      lipid_panel: 'Lipid Panel',
      thyroid_function: 'Thyroid Function Tests',
      liver_function: 'Liver Function Panel',
      kidney_function: 'Kidney Function Panel'
    };
    return templateNames[templateId] || templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconTemplate size={20} />
            <Title order={4}>Test Templates</Title>
          </Group>
          <Badge variant="light" color="blue">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </Badge>
        </Group>

        {/* Search and Filter */}
        <Group gap="md">
          <TextInput
            placeholder="Search templates..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by category"
            leftSection={<IconFilter size={16} />}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Categories' },
              { value: 'chemistry', label: 'Chemistry' },
              { value: 'hematology', label: 'Hematology' },
              { value: 'hepatology', label: 'Hepatology' },
              { value: 'endocrinology', label: 'Endocrinology' },
              { value: 'immunology', label: 'Immunology' },
              { value: 'microbiology', label: 'Microbiology' },
            ]}
            style={{ minWidth: 180 }}
          />
        </Group>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <Center p="xl">
            <Stack align="center" gap="md">
              <IconFlask size={48} color="var(--mantine-color-gray-5)" />
              <Text size="lg" c="dimmed">No templates found</Text>
              <Text size="sm" c="dimmed" ta="center">
                Try adjusting your search or filter criteria
              </Text>
            </Stack>
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {filteredTemplates.map((template) => (
              <Card key={template.id} withBorder shadow="sm" radius="md" p="md">
                <Stack gap="sm">
                  {/* Template Header */}
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">
                        {getTemplateDisplayName(template.id)}
                      </Text>
                      <Badge
                        variant="light"
                        color={getCategoryColor(template.category)}
                        size="xs"
                      >
                        {getCategoryDisplayName(template.category)}
                      </Badge>
                    </Stack>
                  </Group>

                  {/* Test Count */}
                  <Group gap="xs">
                    <IconMedicalCross size={14} />
                    <Text size="xs" c="dimmed">
                      {template.tests.length} test{template.tests.length !== 1 ? 's' : ''}
                    </Text>
                  </Group>

                  {/* Test Preview */}
                  <Stack gap={2}>
                    {template.tests.slice(0, 3).map((test, index) => (
                      <Text key={index} size="xs" c="dimmed">
                        • {test.test_name} ({test.unit})
                      </Text>
                    ))}
                    {template.tests.length > 3 && (
                      <Text size="xs" c="dimmed" fs="italic">
                        + {template.tests.length - 3} more...
                      </Text>
                    )}
                  </Stack>

                  {/* Use Button */}
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => handleTemplateSelect(template)}
                    disabled={disabled}
                    fullWidth
                  >
                    Use Template
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Template Entry Modal */}
        <Modal
          opened={isModalOpen}
          onClose={() => !isSubmitting && setIsModalOpen(false)}
          title={
            <Group gap="xs">
              <IconTemplate size={20} />
              <Text fw={600}>
                {selectedTemplate ? getTemplateDisplayName(selectedTemplate.id) : 'Template Entry'}
              </Text>
            </Group>
          }
          size="calc(100vw - 80px)"
          centered
          zIndex={3002}
          styles={{
            body: {
              maxHeight: 'calc(100vh - 150px)',
              position: 'relative'
            }
          }}
        >
          <Box style={{ position: 'relative' }}>
            <FormLoadingOverlay
              visible={isSubmitting}
              message="Adding test components..."
              submessage="Please wait while we process your entries"
            />

            <Stack gap="md">
              {selectedTemplate && (
                <Alert color="blue" title={selectedTemplate.id === 'custom_entry' ? 'Custom Entry' : 'Template Instructions'}>
                  {selectedTemplate.id === 'custom_entry' ? (
                    <>
                      Enter your own test components. Fill in the test name, unit, value, and optional reference ranges.
                      Click "Add Another Test" to add more rows as needed.
                    </>
                  ) : (
                    <>
                      Enter the test values and reference ranges for each test below.
                      Reference ranges should match what your lab provides. Leave tests blank if not performed.
                    </>
                  )}
                </Alert>
              )}

              <ScrollArea h="calc(100vh - 350px)" type="auto">
                <Stack gap="xs">
                  {/* Table Header */}
                  <Paper withBorder p="xs" bg="gray.1">
                    <Group gap="xs" wrap="nowrap">
                      <Box style={{ width: '180px', minWidth: '180px' }}>
                        <Text size="xs" fw={600}>Test Name</Text>
                      </Box>
                      {selectedTemplate?.id === 'custom_entry' && (
                        <>
                          <Box style={{ width: '100px', minWidth: '100px' }}>
                            <Text size="xs" fw={600}>Abbreviation</Text>
                          </Box>
                          <Box style={{ width: '100px', minWidth: '100px' }}>
                            <Text size="xs" fw={600}>Test Code</Text>
                          </Box>
                        </>
                      )}
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>Unit</Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>Value</Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>Min Range</Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>Max Range</Text>
                      </Box>
                      <Box style={{ width: '120px', minWidth: '120px' }}>
                        <Text size="xs" fw={600}>Status</Text>
                      </Box>
                      <Box style={{ flex: 1, minWidth: '120px' }}>
                        <Text size="xs" fw={600}>Notes</Text>
                      </Box>
                      {selectedTemplate?.id === 'custom_entry' && (
                        <Box style={{ width: '180px', minWidth: '180px' }}>
                          <Text size="xs" fw={600}>Category</Text>
                        </Box>
                      )}
                      {selectedTemplate?.id === 'custom_entry' && (
                        <Box style={{ width: '50px', minWidth: '50px' }}>
                          <Text size="xs" fw={600}>Action</Text>
                        </Box>
                      )}
                    </Group>
                  </Paper>

                  {/* Table Rows */}
                  {formValues.components.map((component: any, index: number) => (
                    <Paper key={index} withBorder p="xs">
                      <Group gap="xs" wrap="nowrap" align="center">
                        <Box style={{ width: '180px', minWidth: '180px' }}>
                          {selectedTemplate?.id === 'custom_entry' ? (
                            <Autocomplete
                              placeholder="Type to search tests..."
                              size="xs"
                              value={component.test_name}
                              onChange={(value) => {
                                // Check if this onChange is from a selection
                                if (justSelectedRef.current?.index === index) {
                                  // Use the clean value from the selection
                                  updateComponent(index, 'test_name', justSelectedRef.current.value);
                                  justSelectedRef.current = null; // Clear flag
                                } else {
                                  // Normal typing - allow any value
                                  updateComponent(index, 'test_name', value);
                                }
                              }}
                              onOptionSubmit={(value) => {
                                // This fires when user selects from dropdown (clicks or presses Enter)
                                const cleanTestName = extractTestName(value);

                                // Set flag so onChange knows this was a selection
                                justSelectedRef.current = { index, value: cleanTestName };

                                // Update test name to clean version (without abbreviation)
                                updateComponent(index, 'test_name', cleanTestName);

                                // Auto-fill unit, category, abbreviation when selecting from library
                                const libraryTest = getTestByName(cleanTestName);

                                if (libraryTest) {
                                  // Always overwrite when selecting from dropdown (not just when empty)
                                  updateComponent(index, 'unit', libraryTest.default_unit);
                                  updateComponent(index, 'category', libraryTest.category);
                                  if (libraryTest.abbreviation) {
                                    updateComponent(index, 'abbreviation', libraryTest.abbreviation);
                                  }
                                }
                              }}
                              data={getAutocompleteOptions(component.test_name || '', 200)}
                              limit={200}
                              maxDropdownHeight={400}
                              comboboxProps={{
                                zIndex: 3003,
                                transitionProps: { duration: 0, transition: 'pop' }
                              }}
                              withScrollArea={true}
                            />
                          ) : (
                            <Stack gap={2}>
                              <Text size="sm" fw={500}>{component.test_name}</Text>
                              {component.abbreviation && (
                                <Badge variant="light" size="xs" style={{ maxWidth: 'fit-content' }}>
                                  {component.abbreviation}
                                </Badge>
                              )}
                            </Stack>
                          )}
                        </Box>
                        {selectedTemplate?.id === 'custom_entry' && (
                          <>
                            <Box style={{ width: '100px', minWidth: '100px' }}>
                              <TextInput
                                placeholder="e.g., HGB"
                                size="xs"
                                value={component.abbreviation || ''}
                                onChange={(event) => updateComponent(index, 'abbreviation', event.target.value)}
                              />
                            </Box>
                            <Box style={{ width: '100px', minWidth: '100px' }}>
                              <TextInput
                                placeholder="e.g., 718-7"
                                size="xs"
                                value={component.test_code || ''}
                                onChange={(event) => updateComponent(index, 'test_code', event.target.value)}
                              />
                            </Box>
                          </>
                        )}
                        <Box style={{ width: '100px', minWidth: '100px' }}>
                          {selectedTemplate?.id === 'custom_entry' ? (
                            <TextInput
                              placeholder="Unit"
                              size="xs"
                              value={component.unit}
                              onChange={(event) => updateComponent(index, 'unit', event.target.value)}
                            />
                          ) : (
                            <Text size="sm" c="dimmed">{component.unit}</Text>
                          )}
                        </Box>
                        <Box style={{ width: '100px', minWidth: '100px' }}>
                          <NumberInput
                            placeholder="Value"
                            required
                            size="xs"
                            value={component.value}
                            onChange={(value) => updateComponent(index, 'value', value)}
                            hideControls
                          />
                        </Box>
                        <Box style={{ width: '100px', minWidth: '100px' }}>
                          <NumberInput
                            placeholder="Min"
                            size="xs"
                            value={component.ref_range_min}
                            onChange={(value) => updateComponent(index, 'ref_range_min', value)}
                            hideControls
                          />
                        </Box>
                        <Box style={{ width: '100px', minWidth: '100px' }}>
                          <NumberInput
                            placeholder="Max"
                            size="xs"
                            value={component.ref_range_max}
                            onChange={(value) => updateComponent(index, 'ref_range_max', value)}
                            hideControls
                          />
                        </Box>
                        <Box style={{ width: '120px', minWidth: '120px' }}>
                          <TextInput
                            placeholder="Auto-calculated"
                            size="xs"
                            value={
                              component.status
                                ? component.status.charAt(0).toUpperCase() + component.status.slice(1)
                                : ''
                            }
                            readOnly
                            styles={{
                              input: {
                                backgroundColor: '#f8f9fa',
                                color: component.status === 'high' || component.status === 'critical'
                                  ? '#fa5252'
                                  : component.status === 'low'
                                  ? '#fd7e14'
                                  : component.status === 'normal'
                                  ? '#51cf66'
                                  : '#868e96',
                                fontWeight: 500,
                                cursor: 'default'
                              }
                            }}
                          />
                        </Box>
                        <Box style={{ flex: 1, minWidth: '120px' }}>
                          <TextInput
                            placeholder="Notes (optional)"
                            size="xs"
                            value={component.notes}
                            onChange={(event) => updateComponent(index, 'notes', event.target.value)}
                          />
                        </Box>
                        {selectedTemplate?.id === 'custom_entry' && (
                          <Box style={{ width: '180px', minWidth: '180px' }}>
                            <Select
                              placeholder="Select category"
                              size="xs"
                              clearable
                              searchable
                              comboboxProps={{ zIndex: 3003 }}
                              data={[
                                { value: 'chemistry', label: 'Blood Chemistry & Metabolic' },
                                { value: 'hematology', label: 'Blood Counts & Cells' },
                                { value: 'hepatology', label: 'Liver Enzymes & Function' },
                                { value: 'lipids', label: 'Cholesterol & Lipids' },
                                { value: 'endocrinology', label: 'Hormones & Thyroid' },
                                { value: 'immunology', label: 'Immune System & Antibodies' },
                                { value: 'microbiology', label: 'Infections & Cultures' },
                                { value: 'toxicology', label: 'Drug & Toxin Screening' },
                                { value: 'genetics', label: 'Genetic Testing' },
                                { value: 'molecular', label: 'Molecular & DNA Tests' },
                                { value: 'pathology', label: 'Tissue & Biopsy Analysis' },
                                { value: 'other', label: 'Other Tests' },
                              ]}
                              value={component.category || null}
                              onChange={(value) => updateComponent(index, 'category', value)}
                            />
                          </Box>
                        )}
                        {selectedTemplate?.id === 'custom_entry' && (
                          <Box style={{ width: '50px', minWidth: '50px' }}>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => removeCustomRow(index)}
                              disabled={formValues.components.length === 1}
                              title={formValues.components.length === 1 ? "Cannot remove last row" : "Remove row"}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Box>
                        )}
                      </Group>
                    </Paper>
                  ))}

                  {/* Add Row Button for Custom Entry */}
                  {selectedTemplate?.id === 'custom_entry' && (
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={addCustomRow}
                      fullWidth
                      size="xs"
                    >
                      Add Another Test
                    </Button>
                  )}
                </Stack>
              </ScrollArea>

              {/* Action Buttons */}
              <Group justify="space-between" mt="md">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {(() => {
                    const filledCount = formValues.components.filter(c =>
                      c.value !== '' && c.value !== null && c.value !== undefined &&
                      typeof c.value === 'number' && !isNaN(c.value)
                    ).length;
                    const totalCount = formValues.components.length;

                    if (filledCount === 0) {
                      return `Add Tests (0/${totalCount} filled)`;
                    } else if (filledCount === totalCount) {
                      return `Add ${filledCount} Test${filledCount !== 1 ? 's' : ''}`;
                    } else {
                      return `Add ${filledCount} of ${totalCount} Test${filledCount !== 1 ? 's' : ''}`;
                    }
                  })()}
                </Button>
              </Group>
            </Stack>
          </Box>
        </Modal>
      </Stack>
    </Paper>
  );
};

export default TestComponentTemplates;