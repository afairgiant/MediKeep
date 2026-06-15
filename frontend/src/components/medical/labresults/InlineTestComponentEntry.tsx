/**
 * InlineTestComponentEntry - collapsible section for adding test components
 * directly on the lab result creation form.
 *
 * Create-mode only. Collapsed by default. Exposes methods via callback-ref
 * pattern (same as DocumentManagerWithProgress).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Grid,
  Box,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  ActionIcon,
  Collapse,
  Autocomplete,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconFlask,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  getAutocompleteOptions,
  extractTestName,
  getTestByName,
  getMatchedCommonName,
} from '../../../constants/testLibrary';
import {
  CATEGORY_SELECT_OPTIONS,
  QUALITATIVE_SELECT_OPTIONS,
} from '../../../constants/labCategories';
import {
  calculateStatus,
  capitalizeStatus,
  getStatusInputColor,
  createEmptyRow,
  isSubmittableComponent,
  ComponentRowData,
} from '../../../utils/labTestComponentUtils';

export interface InlineTestComponentMethods {
  hasPendingComponents: () => boolean;
  getPendingComponents: () => ComponentRowData[];
  getComponents: () => ComponentRowData[];
  clearComponents: () => void;
  setComponents: (_rows: ComponentRowData[]) => void;
}

interface InlineTestComponentEntryProps {
  onRef?: (_methods: InlineTestComponentMethods | null) => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

function InlineTestComponentEntry({
  onRef,
  disabled = false,
  defaultExpanded = false,
}: InlineTestComponentEntryProps): React.ReactElement {
  const { t } = useTranslation(['medical', 'shared', 'labresults']);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [components, setComponents] = useState<ComponentRowData[]>([
    createEmptyRow(1),
  ]);
  const justSelectedRef = useRef<{ index: number; value: string } | null>(null);

  const getPendingComponents = useCallback((): ComponentRowData[] => {
    return components.filter(isSubmittableComponent);
  }, [components]);

  const hasPendingComponents = useCallback((): boolean => {
    return components.some(isSubmittableComponent);
  }, [components]);

  const getComponents = useCallback((): ComponentRowData[] => {
    return components;
  }, [components]);

  const clearComponents = useCallback(() => {
    setComponents([createEmptyRow(1)]);
    setExpanded(false);
  }, []);

  const applyTemplateRows = useCallback((rows: ComponentRowData[]) => {
    setComponents(rows.length > 0 ? rows : [createEmptyRow(1)]);
    if (rows.length > 0) setExpanded(true);
  }, []);

  useEffect(() => {
    onRef?.({ hasPendingComponents, getPendingComponents, getComponents, clearComponents, setComponents: applyTemplateRows });
    return () => onRef?.(null);
  }, [onRef, hasPendingComponents, getPendingComponents, getComponents, clearComponents, applyTemplateRows]);

  const updateComponent = useCallback(
    (index: number, field: string, value: unknown) => {
      setComponents(prev =>
        prev.map((comp, i) => {
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
        })
      );
    },
    []
  );

  const updateComponentFields = useCallback(
    (index: number, fields: Partial<ComponentRowData>) => {
      setComponents(prev =>
        prev.map((comp, i) => {
          if (i !== index) return comp;
          return { ...comp, ...fields };
        })
      );
    },
    []
  );

  const addRow = useCallback(() => {
    setComponents(prev => [...prev, createEmptyRow(prev.length + 1)]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setComponents(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((comp, i) => ({ ...comp, display_order: i + 1 }))
    );
  }, []);

  const pendingCount = getPendingComponents().length;

  return (
    <Paper withBorder p="md" mt="md">
      <Group
        justify="space-between"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <Group gap="xs">
          <IconFlask size={20} />
          <Text fw={500}>
            {t('labresults:form.testComponents', 'Add Tests')}
          </Text>
          {pendingCount > 0 && (
            <Badge size="sm" variant="filled" color="blue">
              {pendingCount}
            </Badge>
          )}
        </Group>
        {expanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
      </Group>

      <Collapse in={expanded}>
        <Stack gap="md" mt="md">
          {components.map((component, index) => (
            <Paper key={component._rowId} withBorder p="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text size="xs" fw={600} c="dimmed">
                    {t('labresults:testEntry.label', 'Test #{{number}}', { number: index + 1 })}
                  </Text>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={components.length === 1 || disabled}
                    title={
                      components.length === 1
                        ? t(
                            'labresults:form.cannotRemoveLastRow',
                            'Cannot remove last row'
                          )
                        : t('labresults:form.removeRow', 'Remove row')
                    }
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>

                <Grid gutter="xs">
                  <Grid.Col span={12}>
                    <Autocomplete
                      label={t('shared:fields.testName', 'Test Name')}
                      placeholder={t(
                        'labresults:form.searchTests',
                        'Type to search tests...'
                      )}
                      size="xs"
                      value={component.test_name}
                      onChange={value => {
                        if (justSelectedRef.current?.index === index) {
                          updateComponent(
                            index,
                            'test_name',
                            justSelectedRef.current.value
                          );
                          justSelectedRef.current = null;
                        } else {
                          updateComponent(index, 'test_name', value);
                        }
                      }}
                      onOptionSubmit={value => {
                        const cleanTestName = extractTestName(value);
                        justSelectedRef.current = {
                          index,
                          value: cleanTestName,
                        };

                        const libraryTest = getTestByName(cleanTestName);
                        const autoFillFields: Partial<ComponentRowData> = {
                          test_name: cleanTestName,
                          ...(libraryTest && {
                            canonical_test_name: libraryTest.test_name,
                            unit: libraryTest.default_unit,
                            category: libraryTest.category,
                            ...(libraryTest.abbreviation && {
                              abbreviation: libraryTest.abbreviation,
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
                      filter={({ options, limit }) => options.slice(0, limit)}
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
                      maxDropdownHeight={300}
                      comboboxProps={{
                        zIndex: 3003,
                        transitionProps: { duration: 0, transition: 'pop' },
                      }}
                      withScrollArea
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      label={t('labresults:form.abbreviation', 'Abbreviation')}
                      placeholder={t(
                        'labresults:form.abbreviationPlaceholder',
                        'e.g., HGB'
                      )}
                      size="xs"
                      value={component.abbreviation || ''}
                      onChange={event =>
                        updateComponent(
                          index,
                          'abbreviation',
                          event.target.value
                        )
                      }
                      disabled={disabled}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label={t('shared:fields.testCode', 'Test Code')}
                      placeholder={t(
                        'labresults:form.testCodePlaceholder',
                        'e.g., 718-7'
                      )}
                      size="xs"
                      value={component.test_code || ''}
                      onChange={event =>
                        updateComponent(index, 'test_code', event.target.value)
                      }
                      disabled={disabled}
                    />
                  </Grid.Col>

                  {component.result_type === 'textual' ? (
                    <Grid.Col span={12}>
                      <Textarea
                        label={t('labresults:textualResult.label', 'Result Text')}
                        placeholder={t(
                          'labresults:textualResult.placeholder',
                          'Enter result text (e.g. No acute findings)'
                        )}
                        size="xs"
                        value={component.textual_value || ''}
                        onChange={event =>
                          updateComponent(index, 'textual_value', event.target.value)
                        }
                        minRows={2}
                        autosize
                        maxRows={5}
                        maxLength={5000}
                        disabled={disabled}
                      />
                    </Grid.Col>
                  ) : (
                    <>
                      <Grid.Col span={component.result_type === 'qualitative' ? 6 : 4}>
                        {component.result_type === 'qualitative' ? (
                          <Select
                            label={t('labresults:form.result', 'Result')}
                            placeholder={t(
                              'labresults:form.selectResult',
                              'Select result'
                            )}
                            size="xs"
                            data={QUALITATIVE_SELECT_OPTIONS}
                            value={component.qualitative_value || null}
                            onChange={value => {
                              updateComponent(
                                index,
                                'qualitative_value',
                                value || ''
                              );
                              if (value === 'positive' || value === 'detected') {
                                updateComponent(index, 'status', 'abnormal');
                              } else if (
                                value === 'negative' ||
                                value === 'undetected'
                              ) {
                                updateComponent(index, 'status', 'normal');
                              }
                            }}
                            comboboxProps={{ zIndex: 3003 }}
                            disabled={disabled}
                          />
                        ) : (
                          <NumberInput
                            label={t('shared:labels.value', 'Value')}
                            placeholder={t('shared:labels.value', 'Value')}
                            size="xs"
                            value={component.value}
                            onChange={value =>
                              updateComponent(index, 'value', value)
                            }
                            hideControls
                            disabled={disabled}
                          />
                        )}
                      </Grid.Col>

                      {component.result_type === 'quantitative' && (
                        <Grid.Col span={4}>
                          <TextInput
                            label={t('labresults:form.unit', 'Unit')}
                            placeholder={t('labresults:form.unit', 'Unit')}
                            size="xs"
                            value={component.unit}
                            onChange={event =>
                              updateComponent(index, 'unit', event.target.value)
                            }
                            disabled={disabled}
                          />
                        </Grid.Col>
                      )}
                    </>
                  )}

                  <Grid.Col span={4}>
                    <TextInput
                      label={t('shared:fields.status', 'Status')}
                      placeholder={t(
                        'labresults:form.autoCalculated',
                        'Auto-calculated'
                      )}
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
                  </Grid.Col>

                  {component.result_type === 'quantitative' && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="xs" c="dimmed" fw={500} mb={4}>
                          {t(
                            'labresults:modal.labels.referenceRange',
                            'Reference Range'
                          )}
                        </Text>
                        <Grid gutter="xs">
                          <Grid.Col span={4}>
                            <NumberInput
                              label={t('labresults:form.refMin', 'Ref Min')}
                              placeholder={t('shared:labels.min', 'Min')}
                              size="xs"
                              value={component.ref_range_min}
                              onChange={value =>
                                updateComponent(index, 'ref_range_min', value)
                              }
                              hideControls
                              disabled={disabled}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <NumberInput
                              label={t('labresults:form.refMax', 'Ref Max')}
                              placeholder={t('shared:labels.max', 'Max')}
                              size="xs"
                              value={component.ref_range_max}
                              onChange={value =>
                                updateComponent(index, 'ref_range_max', value)
                              }
                              hideControls
                              disabled={disabled}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label={t(
                                'labresults:numericResult.refTextLabel',
                                'Ref Text'
                              )}
                              placeholder={t(
                                'labresults:numericResult.refTextPlaceholder',
                                'e.g. 4.0-5.6 or <200'
                              )}
                              size="xs"
                              value={component.ref_range_text || ''}
                              onChange={event =>
                                updateComponent(
                                  index,
                                  'ref_range_text',
                                  event.target.value
                                )
                              }
                              disabled={disabled}
                            />
                          </Grid.Col>
                        </Grid>
                      </Box>
                    </Grid.Col>
                  )}

                  <Grid.Col span={6}>
                    <Select
                      label={t('shared:labels.category', 'Category')}
                      placeholder={t(
                        'shared:labels.selectCategory',
                        'Select category'
                      )}
                      size="xs"
                      clearable
                      searchable
                      comboboxProps={{ zIndex: 3003 }}
                      data={CATEGORY_SELECT_OPTIONS}
                      value={component.category || null}
                      onChange={value =>
                        updateComponent(index, 'category', value)
                      }
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      label={t('shared:tabs.notes', 'Notes')}
                      placeholder={t(
                        'labresults:form.notesOptional',
                        'Notes (optional)'
                      )}
                      size="xs"
                      value={component.notes || ''}
                      onChange={event =>
                        updateComponent(index, 'notes', event.target.value)
                      }
                      disabled={disabled}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>
          ))}

          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={addRow}
            fullWidth
            size="xs"
            disabled={disabled}
          >
            {t('labresults:form.addAnotherTest', 'Add Another Test')}
          </Button>
        </Stack>
      </Collapse>
    </Paper>
  );
}

export default InlineTestComponentEntry;
