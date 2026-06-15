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
  Paper,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Alert,
  ActionIcon,
  Modal,
  ScrollArea,
  Center,
  Box,
  Autocomplete,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconSearch,
  IconFilter,
  IconTemplate,
  IconFlask,
  IconMedicalCross,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import {
  LabTestComponentCreate,
  LabTestComponent,
  labTestComponentApi,
} from '../../../services/api/labTestComponentApi';
import {
  getCategoryDisplayName,
  getCategoryColor,
  CATEGORY_SELECT_OPTIONS,
  QUALITATIVE_SELECT_OPTIONS,
} from '../../../constants/labCategories';
import logger from '../../../services/logger';
import {
  getAutocompleteOptions,
  extractTestName,
  getTestByName,
  getMatchedCommonName,
} from '../../../constants/testLibrary';
import {
  calculateStatus,
  capitalizeStatus,
  createEmptyRow,
  getStatusInputColor,
  hasFilledValue,
  sanitizeComponentForApi,
  ComponentRowData,
} from '../../../utils/labTestComponentUtils';
import { TestTemplate, PANEL_TEMPLATES } from '../../../constants/panelTemplateMap';

interface TestComponentTemplatesProps {
  labResultId: number;
  onComponentsAdded?: (_components: LabTestComponent[]) => void;
  onError?: (_error: Error) => void;
  disabled?: boolean;
}

function TestComponentTemplates({
  labResultId,
  onComponentsAdded,
  onError,
  disabled = false,
}: TestComponentTemplatesProps): React.ReactElement {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Track when an autocomplete option was just selected to prevent onChange from overwriting
  const justSelectedRef = useRef<{ index: number; value: string } | null>(null);

  const handleError = useCallback(
    (error: Error, context: string) => {
      logger.error('test_component_templates_error', {
        message: `Error in TestComponentTemplates: ${context}`,
        labResultId,
        error: error.message,
        component: 'TestComponentTemplates',
      });

      if (onError) {
        onError(error);
      }
    },
    [labResultId, onError]
  );

  const customEntry: TestTemplate = {
    id: 'custom_entry',
    category: 'other',
    tests: [{ test_name: '', abbreviation: '', test_code: '', unit: '', default_display_order: 1 }],
  };
  const testTemplates: TestTemplate[] = [customEntry, ...PANEL_TEMPLATES];

  // Form state for entering test values and reference ranges
  const [formValues, setFormValues] = useState<{
    components: ComponentRowData[];
  }>({
    components: [],
  });

  const validateForm = useCallback(() => {
    return formValues.components.some(hasFilledValue);
  }, [formValues.components]);

  const updateComponent = (index: number, field: string, value: unknown) => {
    setFormValues(prev => ({
      components: prev.components.map((comp, i) => {
        if (i !== index) return comp;

        const updatedComp = { ...comp, [field]: value };

        if (
          field === 'value' ||
          field === 'ref_range_min' ||
          field === 'ref_range_max'
        ) {
          updatedComp.status = calculateStatus(
            field === 'value' ? (value as number | '') : updatedComp.value,
            field === 'ref_range_min'
              ? (value as number | '')
              : updatedComp.ref_range_min,
            field === 'ref_range_max'
              ? (value as number | '')
              : updatedComp.ref_range_max
          );
        }

        return updatedComp;
      }),
    }));
  };

  const updateComponentFields = (
    index: number,
    fields: Partial<ComponentRowData>
  ) => {
    setFormValues(prev => ({
      components: prev.components.map((comp, i) => {
        if (i !== index) return comp;
        return { ...comp, ...fields };
      }),
    }));
  };

  const addCustomRow = useCallback(() => {
    setFormValues(prev => ({
      components: [
        ...prev.components,
        createEmptyRow(prev.components.length + 1),
      ],
    }));
  }, []);

  const removeCustomRow = useCallback((index: number) => {
    setFormValues(prev => ({
      components: prev.components.filter((_, i) => i !== index),
    }));
  }, []);

  const filteredTemplates = testTemplates.filter(template => {
    const matchesSearch =
      searchQuery === '' ||
      template.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tests.some(
        test =>
          test.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (test.abbreviation &&
            test.abbreviation.toLowerCase().includes(searchQuery.toLowerCase()))
      );

    const matchesCategory =
      categoryFilter === 'all' || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = useCallback((template: TestTemplate) => {
    setSelectedTemplate(template);

    // Initialize form with template data, using createEmptyRow as base for stable _rowId
    const components = template.tests.map((test, idx) => ({
      ...createEmptyRow(test.default_display_order ?? idx + 1),
      test_name: test.test_name,
      abbreviation: test.abbreviation || '',
      test_code: test.test_code || '',
      unit: test.unit,
      category: template.category,
      display_order: test.default_display_order,
      notes: test.notes || '',
      result_type:
        test.result_type || ('quantitative' as 'quantitative' | 'qualitative' | 'textual'),
    }));

    setFormValues({ components });
    setIsModalOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    logger.debug('template_submit_clicked', {
      componentCount: formValues.components.length,
      component: 'TestComponentTemplates',
    });

    const isValid = validateForm();
    logger.debug('template_validation_result', {
      isValid,
      componentCount: formValues.components.length,
      component: 'TestComponentTemplates',
    });

    if (!isValid) {
      logger.warn('template_validation_failed', {
        componentCount: formValues.components.length,
        component: 'TestComponentTemplates',
      });

      notifications.show({
        title: 'No Tests Entered',
        message:
          'Please enter test values for at least one test component before submitting.',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { components } = formValues;

      // Filter to only include components with values (allow partial template entry)
      const filledComponents = components.filter(component => {
        if (!hasFilledValue(component)) return false;
        if (component.result_type === 'qualitative') {
          return component.test_name.trim() !== '';
        }
        if (selectedTemplate?.id === 'custom_entry') {
          return (
            component.test_name.trim() !== '' && component.unit.trim() !== ''
          );
        }
        return true;
      });

      logger.info('template_submitting_components', {
        totalComponents: components.length,
        filledComponents: filledComponents.length,
        component: 'TestComponentTemplates',
      });

      // Convert form data to API format with sanitization using shared utility
      const componentsToCreate: LabTestComponentCreate[] = filledComponents.map(
        component => sanitizeComponentForApi(component, labResultId)
      );

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
        autoClose: 4000,
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
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formValues,
    labResultId,
    selectedTemplate,
    onComponentsAdded,
    handleError,
    validateForm,
  ]);

  const getTemplateDisplayName = (templateId: string): string => {
    const templateNames: Record<string, string> = {
      custom_entry: 'Custom Entry',
      basic_metabolic_panel: 'Basic Metabolic Panel (BMP)',
      comprehensive_metabolic_panel: 'Comprehensive Metabolic Panel (CMP)',
      complete_blood_count: 'Complete Blood Count (CBC)',
      lipid_panel: 'Lipid Panel',
      thyroid_function: 'Thyroid Function Tests',
      liver_function: 'Liver Function Panel',
      kidney_function: 'Kidney Function Panel',
      infectious_disease_panel: 'Infectious Disease Panel',
      autoimmune_panel: 'Autoimmune Panel',
      viral_serology_panel: 'Viral Serology Panel',
    };
    return (
      templateNames[templateId] ||
      templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconTemplate size={20} />
            <Title order={4}>{t('labresults:templates.title')}</Title>
          </Group>
          <Badge variant="light" color="blue">
            {t('labresults:templates.templateCount', {
              count: filteredTemplates.length,
            })}
          </Badge>
        </Group>

        {/* Search and Filter */}
        <Group gap="md">
          <TextInput
            placeholder="Search templates..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={event => setSearchQuery(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by category"
            leftSection={<IconFilter size={16} />}
            value={categoryFilter}
            onChange={value => setCategoryFilter(value || 'all')}
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
              <Text size="lg" c="dimmed">
                {t('labresults:templates.noTemplates')}
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                {t('labresults:templates.noTemplatesDescription')}
              </Text>
            </Stack>
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {filteredTemplates.map(template => (
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
                      {t('labresults:templates.testCount', {
                        count: template.tests.length,
                      })}
                    </Text>
                  </Group>

                  {/* Test Preview */}
                  <Stack gap={2}>
                    {template.tests.slice(0, 3).map((test, index) => (
                      <Text key={index} size="xs" c="dimmed">
                        • {test.test_name}{' '}
                        {test.result_type === 'qualitative'
                          ? '(Qualitative)'
                          : test.result_type === 'textual'
                            ? '(Textual)'
                            : test.unit
                              ? `(${test.unit})`
                              : ''}
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
                    {t('labresults:templates.useTemplate')}
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
                {selectedTemplate
                  ? getTemplateDisplayName(selectedTemplate.id)
                  : 'Template Entry'}
              </Text>
            </Group>
          }
          size="calc(100vw - 80px)"
          centered
          zIndex={3002}
          styles={{
            body: {
              maxHeight: 'calc(100vh - 150px)',
              position: 'relative',
            },
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
                <Alert
                  color="blue"
                  title={
                    selectedTemplate.id === 'custom_entry'
                      ? t('labresults:templates.customEntry')
                      : t('labresults:templates.templateInstructions')
                  }
                >
                  {selectedTemplate.id === 'custom_entry' ? (
                    <>{t('labresults:templates.customEntryInstructions')}</>
                  ) : (
                    <>{t('labresults:templates.templateInstructionsText')}</>
                  )}
                </Alert>
              )}

              <ScrollArea h="calc(100vh - 350px)" type="auto">
                <Stack gap="xs">
                  {/* Table Header */}
                  <Paper withBorder p="xs" bg="var(--color-bg-secondary)">
                    <Group gap="xs" wrap="nowrap">
                      <Box style={{ width: '180px', minWidth: '180px' }}>
                        <Text size="xs" fw={600}>
                          {t('shared:fields.testName')}
                        </Text>
                      </Box>
                      {selectedTemplate?.id === 'custom_entry' && (
                        <>
                          <Box style={{ width: '100px', minWidth: '100px' }}>
                            <Text size="xs" fw={600}>
                              {t(
                                'labresults:testComponents.editModal.fields.abbreviation'
                              )}
                            </Text>
                          </Box>
                          <Box style={{ width: '100px', minWidth: '100px' }}>
                            <Text size="xs" fw={600}>
                              {t('shared:fields.testCode')}
                            </Text>
                          </Box>
                        </>
                      )}
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>
                          {t('labresults:testComponents.editModal.fields.unit')}
                        </Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>
                          {t('shared:labels.value')}
                        </Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>
                          {t(
                            'labresults:testComponents.editModal.fields.minimum'
                          )}
                        </Text>
                      </Box>
                      <Box style={{ width: '100px', minWidth: '100px' }}>
                        <Text size="xs" fw={600}>
                          {t(
                            'labresults:testComponents.editModal.fields.maximum'
                          )}
                        </Text>
                      </Box>
                      <Box style={{ width: '120px', minWidth: '120px' }}>
                        <Text size="xs" fw={600}>
                          {t('shared:fields.status')}
                        </Text>
                      </Box>
                      <Box style={{ flex: 1, minWidth: '120px' }}>
                        <Text size="xs" fw={600}>
                          {t('shared:tabs.notes')}
                        </Text>
                      </Box>
                      {selectedTemplate?.id === 'custom_entry' && (
                        <Box style={{ width: '180px', minWidth: '180px' }}>
                          <Text size="xs" fw={600}>
                            {t('shared:labels.category')}
                          </Text>
                        </Box>
                      )}
                      {selectedTemplate?.id === 'custom_entry' && (
                        <Box style={{ width: '50px', minWidth: '50px' }}>
                          <Text size="xs" fw={600}>
                            {t('shared:labels.actions')}
                          </Text>
                        </Box>
                      )}
                    </Group>
                  </Paper>

                  {/* Table Rows */}
                  {formValues.components.map(
                    (component: any, index: number) => (
                      <Paper key={index} withBorder p="xs">
                        <Group gap="xs" wrap="nowrap" align="center">
                          <Box style={{ width: '180px', minWidth: '180px' }}>
                            {selectedTemplate?.id === 'custom_entry' ? (
                              <Autocomplete
                                placeholder="Type to search tests..."
                                size="xs"
                                value={component.test_name}
                                onChange={value => {
                                  // Check if this onChange is from a selection
                                  if (
                                    justSelectedRef.current?.index === index
                                  ) {
                                    // Use the clean value from the selection
                                    updateComponent(
                                      index,
                                      'test_name',
                                      justSelectedRef.current.value
                                    );
                                    justSelectedRef.current = null; // Clear flag
                                  } else {
                                    // Normal typing - allow any value
                                    updateComponent(index, 'test_name', value);
                                  }
                                }}
                                onOptionSubmit={value => {
                                  const cleanTestName = extractTestName(value);
                                  justSelectedRef.current = {
                                    index,
                                    value: cleanTestName,
                                  };

                                  const libraryTest =
                                    getTestByName(cleanTestName);
                                  const autoFillFields: Partial<ComponentRowData> =
                                    {
                                      test_name: cleanTestName,
                                      ...(libraryTest && {
                                        canonical_test_name: libraryTest.test_name,
                                        unit: libraryTest.default_unit,
                                        category: libraryTest.category,
                                        ...(libraryTest.abbreviation && {
                                          abbreviation:
                                            libraryTest.abbreviation,
                                        }),
                                        ...(libraryTest.result_type && {
                                          result_type: libraryTest.result_type,
                                        }),
                                      }),
                                    };
                                  updateComponentFields(index, autoFillFields);
                                }}
                                data={getAutocompleteOptions(
                                  component.test_name || '',
                                  200
                                )}
                                limit={200}
                                filter={({ options, limit }) =>
                                  options.slice(0, limit)
                                }
                                renderOption={({ option }) => {
                                  const matched = getMatchedCommonName(
                                    extractTestName(option.value),
                                    component.test_name || ''
                                  );
                                  return (
                                    <Stack gap={0}>
                                      <Text size="sm">{option.value}</Text>
                                      {matched && (
                                        <Text size="xs" c="dimmed">
                                          {t(
                                            'labresults:form.matchedCommonName',
                                            'matched: {{name}}',
                                            { name: matched }
                                          )}
                                        </Text>
                                      )}
                                    </Stack>
                                  );
                                }}
                                maxDropdownHeight={400}
                                comboboxProps={{
                                  zIndex: 3003,
                                  transitionProps: {
                                    duration: 0,
                                    transition: 'pop',
                                  },
                                }}
                                withScrollArea={true}
                              />
                            ) : (
                              <Stack gap={2}>
                                <Text size="sm" fw={500}>
                                  {component.test_name}
                                </Text>
                                {component.abbreviation && (
                                  <Badge
                                    variant="light"
                                    size="xs"
                                    style={{ maxWidth: 'fit-content' }}
                                  >
                                    {component.abbreviation}
                                  </Badge>
                                )}
                              </Stack>
                            )}
                          </Box>
                          {selectedTemplate?.id === 'custom_entry' && (
                            <>
                              <Box
                                style={{ width: '100px', minWidth: '100px' }}
                              >
                                <TextInput
                                  placeholder="e.g., HGB"
                                  size="xs"
                                  value={component.abbreviation || ''}
                                  onChange={event =>
                                    updateComponent(
                                      index,
                                      'abbreviation',
                                      event.target.value
                                    )
                                  }
                                />
                              </Box>
                              <Box
                                style={{ width: '100px', minWidth: '100px' }}
                              >
                                <TextInput
                                  placeholder="e.g., 718-7"
                                  size="xs"
                                  value={component.test_code || ''}
                                  onChange={event =>
                                    updateComponent(
                                      index,
                                      'test_code',
                                      event.target.value
                                    )
                                  }
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
                                onChange={event =>
                                  updateComponent(
                                    index,
                                    'unit',
                                    event.target.value
                                  )
                                }
                              />
                            ) : (
                              <Text size="sm" c="dimmed">
                                {component.unit}
                              </Text>
                            )}
                          </Box>
                          {component.result_type === 'textual' ? (
                            <Box style={{ width: '300px', minWidth: '300px' }}>
                              <Textarea
                                placeholder="Enter result text..."
                                size="xs"
                                value={component.textual_value || ''}
                                onChange={event =>
                                  updateComponent(
                                    index,
                                    'textual_value',
                                    event.target.value
                                  )
                                }
                                minRows={1}
                                autosize
                                maxRows={3}
                                maxLength={5000}
                              />
                            </Box>
                          ) : (
                            <Box style={{ width: '100px', minWidth: '100px' }}>
                              {component.result_type === 'qualitative' ? (
                                <Select
                                  placeholder="Result"
                                  size="xs"
                                  data={QUALITATIVE_SELECT_OPTIONS}
                                  value={component.qualitative_value || null}
                                  onChange={value => {
                                    updateComponent(
                                      index,
                                      'qualitative_value',
                                      value || ''
                                    );
                                    if (
                                      value === 'positive' ||
                                      value === 'detected'
                                    ) {
                                      updateComponent(
                                        index,
                                        'status',
                                        'abnormal'
                                      );
                                    } else if (
                                      value === 'negative' ||
                                      value === 'undetected'
                                    ) {
                                      updateComponent(index, 'status', 'normal');
                                    }
                                  }}
                                  comboboxProps={{ zIndex: 3003 }}
                                />
                              ) : (
                                <NumberInput
                                  placeholder="Value"
                                  required
                                  size="xs"
                                  value={component.value}
                                  onChange={value =>
                                    updateComponent(index, 'value', value)
                                  }
                                  hideControls
                                />
                              )}
                            </Box>
                          )}
                          {component.result_type === 'quantitative' && (
                            <>
                              <Box
                                style={{ width: '100px', minWidth: '100px' }}
                              >
                                <NumberInput
                                  placeholder="Min"
                                  size="xs"
                                  value={component.ref_range_min}
                                  onChange={value =>
                                    updateComponent(
                                      index,
                                      'ref_range_min',
                                      value
                                    )
                                  }
                                  hideControls
                                />
                              </Box>
                              <Box
                                style={{ width: '100px', minWidth: '100px' }}
                              >
                                <NumberInput
                                  placeholder="Max"
                                  size="xs"
                                  value={component.ref_range_max}
                                  onChange={value =>
                                    updateComponent(
                                      index,
                                      'ref_range_max',
                                      value
                                    )
                                  }
                                  hideControls
                                />
                              </Box>
                            </>
                          )}
                          <Box style={{ width: '120px', minWidth: '120px' }}>
                            <TextInput
                              placeholder="Auto-calculated"
                              size="xs"
                              value={capitalizeStatus(component.status)}
                              readOnly
                              styles={{
                                input: {
                                  backgroundColor: 'var(--color-bg-secondary)',
                                  color: getStatusInputColor(component.status),
                                  fontWeight: 500,
                                  cursor: 'default',
                                },
                              }}
                            />
                          </Box>
                          <Box style={{ flex: 1, minWidth: '120px' }}>
                            <TextInput
                              placeholder="Notes (optional)"
                              size="xs"
                              value={component.notes}
                              onChange={event =>
                                updateComponent(
                                  index,
                                  'notes',
                                  event.target.value
                                )
                              }
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
                                data={CATEGORY_SELECT_OPTIONS}
                                value={component.category || null}
                                onChange={value =>
                                  updateComponent(index, 'category', value)
                                }
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
                                title={
                                  formValues.components.length === 1
                                    ? 'Cannot remove last row'
                                    : 'Remove row'
                                }
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Box>
                          )}
                        </Group>
                      </Paper>
                    )
                  )}

                  {/* Add Row Button for Custom Entry */}
                  {selectedTemplate?.id === 'custom_entry' && (
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={addCustomRow}
                      fullWidth
                      size="xs"
                    >
                      {t('labresults:templates.addAnotherTest')}
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
                  {t('shared:fields.cancel')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {(() => {
                    const filledCount =
                      formValues.components.filter(hasFilledValue).length;
                    const totalCount = formValues.components.length;

                    if (filledCount === 0)
                      return t('labresults:templates.addTests', {
                        filled: 0,
                        total: totalCount,
                      });
                    if (filledCount === totalCount)
                      return t('labresults:templates.addTestsAll', {
                        count: filledCount,
                      });
                    return t('labresults:templates.addTestsPartial', {
                      filled: filledCount,
                      total: totalCount,
                      count: filledCount,
                    });
                  })()}
                </Button>
              </Group>
            </Stack>
          </Box>
        </Modal>
      </Stack>
    </Paper>
  );
}

export default TestComponentTemplates;
