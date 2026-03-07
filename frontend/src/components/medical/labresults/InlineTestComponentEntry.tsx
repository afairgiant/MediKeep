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
  TextInput,
  NumberInput,
  Select,
  ActionIcon,
  Collapse,
  Autocomplete,
  Badge,
} from '@mantine/core';
import { IconPlus, IconTrash, IconChevronDown, IconChevronUp, IconFlask } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { getAutocompleteOptions, extractTestName, getTestByName } from '../../../constants/testLibrary';
import { CATEGORY_SELECT_OPTIONS, QUALITATIVE_SELECT_OPTIONS } from '../../../constants/labCategories';
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
  clearComponents: () => void;
}

interface InlineTestComponentEntryProps {
  onRef?: (methods: InlineTestComponentMethods | null) => void;
  disabled?: boolean;
}

function InlineTestComponentEntry({
  onRef,
  disabled = false,
}: InlineTestComponentEntryProps): React.ReactElement {
  const { t } = useTranslation('medical');
  const [expanded, setExpanded] = useState(false);
  const [components, setComponents] = useState<ComponentRowData[]>([createEmptyRow(1)]);
  const justSelectedRef = useRef<{ index: number; value: string } | null>(null);

  const getPendingComponents = useCallback((): ComponentRowData[] => {
    return components.filter(isSubmittableComponent);
  }, [components]);

  const hasPendingComponents = useCallback((): boolean => {
    return components.some(isSubmittableComponent);
  }, [components]);

  const clearComponents = useCallback(() => {
    setComponents([createEmptyRow(1)]);
    setExpanded(false);
  }, []);

  useEffect(() => {
    onRef?.({ hasPendingComponents, getPendingComponents, clearComponents });
    return () => onRef?.(null);
  }, [onRef, hasPendingComponents, getPendingComponents, clearComponents]);

  const updateComponent = useCallback((index: number, field: string, value: unknown) => {
    setComponents(prev => prev.map((comp, i) => {
      if (i !== index) return comp;

      const updatedComp = { ...comp, [field]: value };

      if (field === 'value' || field === 'ref_range_min' || field === 'ref_range_max') {
        updatedComp.status = calculateStatus(
          field === 'value' ? value as number | '' : updatedComp.value,
          field === 'ref_range_min' ? value as number | '' : updatedComp.ref_range_min,
          field === 'ref_range_max' ? value as number | '' : updatedComp.ref_range_max
        );
      }

      return updatedComp;
    }));
  }, []);

  const updateComponentFields = useCallback((index: number, fields: Partial<ComponentRowData>) => {
    setComponents(prev => prev.map((comp, i) => {
      if (i !== index) return comp;
      return { ...comp, ...fields };
    }));
  }, []);

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
            {t('labResults.form.testComponents', 'Test Components (Optional)')}
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
          <Text size="sm" c="dimmed">
            {t('labResults.form.testComponentsDescription', 'Optionally add individual test values. You can also add more later.')}
          </Text>

          {components.map((component, index) => (
            <Paper key={component._rowId} withBorder p="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text size="xs" fw={600} c="dimmed">
                    {`#${index + 1}`}
                  </Text>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={components.length === 1 || disabled}
                    title={components.length === 1
                      ? t('labResults.form.cannotRemoveLastRow', 'Cannot remove last row')
                      : t('labResults.form.removeRow', 'Remove row')
                    }
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>

                <Grid gutter="xs">
                  <Grid.Col span={12}>
                    <Autocomplete
                      label={t('labResults.form.testName', 'Test Name')}
                      placeholder={t('labResults.form.searchTests', 'Type to search tests...')}
                      size="xs"
                      value={component.test_name}
                      onChange={(value) => {
                        if (justSelectedRef.current?.index === index) {
                          updateComponent(index, 'test_name', justSelectedRef.current.value);
                          justSelectedRef.current = null;
                        } else {
                          updateComponent(index, 'test_name', value);
                        }
                      }}
                      onOptionSubmit={(value) => {
                        const cleanTestName = extractTestName(value);
                        justSelectedRef.current = { index, value: cleanTestName };

                        const libraryTest = getTestByName(cleanTestName);
                        const autoFillFields: Partial<ComponentRowData> = {
                          test_name: cleanTestName,
                          ...(libraryTest && {
                            unit: libraryTest.default_unit,
                            category: libraryTest.category,
                            ...(libraryTest.abbreviation && { abbreviation: libraryTest.abbreviation }),
                            ...(libraryTest.result_type && { result_type: libraryTest.result_type }),
                          }),
                        };
                        updateComponentFields(index, autoFillFields);
                      }}
                      data={getAutocompleteOptions(component.test_name || '', 200)}
                      limit={200}
                      maxDropdownHeight={300}
                      comboboxProps={{
                        zIndex: 3003,
                        transitionProps: { duration: 0, transition: 'pop' }
                      }}
                      withScrollArea
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      label={t('labResults.form.abbreviation', 'Abbreviation')}
                      placeholder={t('labResults.form.abbreviationPlaceholder', 'e.g., HGB')}
                      size="xs"
                      value={component.abbreviation || ''}
                      onChange={(event) => updateComponent(index, 'abbreviation', event.target.value)}
                      disabled={disabled}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label={t('labResults.form.testCode', 'Test Code')}
                      placeholder={t('labResults.form.testCodePlaceholder', 'e.g., 718-7')}
                      size="xs"
                      value={component.test_code || ''}
                      onChange={(event) => updateComponent(index, 'test_code', event.target.value)}
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={component.result_type === 'qualitative' ? 6 : 4}>
                    <TextInput
                      label={t('labResults.form.unit', 'Unit')}
                      placeholder={t('labResults.form.unit', 'Unit')}
                      size="xs"
                      value={component.unit}
                      onChange={(event) => updateComponent(index, 'unit', event.target.value)}
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={component.result_type === 'qualitative' ? 6 : 4}>
                    {component.result_type === 'qualitative' ? (
                      <Select
                        label={t('labResults.form.result', 'Result')}
                        placeholder={t('labResults.form.selectResult', 'Select result')}
                        size="xs"
                        data={QUALITATIVE_SELECT_OPTIONS}
                        value={component.qualitative_value || null}
                        onChange={(value) => {
                          updateComponent(index, 'qualitative_value', value || '');
                          if (value === 'positive' || value === 'detected') {
                            updateComponent(index, 'status', 'abnormal');
                          } else if (value === 'negative' || value === 'undetected') {
                            updateComponent(index, 'status', 'normal');
                          }
                        }}
                        comboboxProps={{ zIndex: 3003 }}
                        disabled={disabled}
                      />
                    ) : (
                      <NumberInput
                        label={t('labResults.form.value', 'Value')}
                        placeholder={t('labResults.form.value', 'Value')}
                        size="xs"
                        value={component.value}
                        onChange={(value) => updateComponent(index, 'value', value)}
                        hideControls
                        disabled={disabled}
                      />
                    )}
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <TextInput
                      label={t('labResults.form.status', 'Status')}
                      placeholder={t('labResults.form.autoCalculated', 'Auto-calculated')}
                      size="xs"
                      value={capitalizeStatus(component.status)}
                      readOnly
                      styles={{
                        input: {
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: getStatusInputColor(component.status),
                          fontWeight: 500,
                          cursor: 'default'
                        }
                      }}
                    />
                  </Grid.Col>

                  {component.result_type !== 'qualitative' && (
                    <>
                      <Grid.Col span={6}>
                        <NumberInput
                          label={t('labResults.form.refMin', 'Ref Min')}
                          placeholder={t('labResults.form.min', 'Min')}
                          size="xs"
                          value={component.ref_range_min}
                          onChange={(value) => updateComponent(index, 'ref_range_min', value)}
                          hideControls
                          disabled={disabled}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <NumberInput
                          label={t('labResults.form.refMax', 'Ref Max')}
                          placeholder={t('labResults.form.max', 'Max')}
                          size="xs"
                          value={component.ref_range_max}
                          onChange={(value) => updateComponent(index, 'ref_range_max', value)}
                          hideControls
                          disabled={disabled}
                        />
                      </Grid.Col>
                    </>
                  )}

                  <Grid.Col span={6}>
                    <Select
                      label={t('labResults.form.category', 'Category')}
                      placeholder={t('labResults.form.selectCategory', 'Select category')}
                      size="xs"
                      clearable
                      searchable
                      comboboxProps={{ zIndex: 3003 }}
                      data={CATEGORY_SELECT_OPTIONS}
                      value={component.category || null}
                      onChange={(value) => updateComponent(index, 'category', value)}
                      disabled={disabled}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      label={t('labResults.form.notes', 'Notes')}
                      placeholder={t('labResults.form.notesOptional', 'Notes (optional)')}
                      size="xs"
                      value={component.notes || ''}
                      onChange={(event) => updateComponent(index, 'notes', event.target.value)}
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
            {t('labResults.form.addAnotherTest', 'Add Another Test')}
          </Button>
        </Stack>
      </Collapse>
    </Paper>
  );
}

export default InlineTestComponentEntry;
