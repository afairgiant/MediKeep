import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  Grid,
  Autocomplete,
  TextInput,
  Select,
  Button,
  Group,
  Alert,
  Text,
  ActionIcon,
} from '@mantine/core';
import {
  getPanelAutocompleteOptions,
  extractPanelName,
  getPanelByOption,
  PANEL_CATEGORY_TO_FORM_CATEGORY,
} from '../../../constants/panelLibrary';
import { getTemplateRowsForPanel } from '../../../constants/panelTemplateMap';
import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { DateInput } from '../../adapters/DateInput';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
import { useDateFormat } from '../../../hooks/useDateFormat';
import PractitionerSelectWithCreate from '../practitioners/PractitionerSelectWithCreate';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import InlineTestComponentEntry, {
  InlineTestComponentMethods,
} from './InlineTestComponentEntry';
import { apiService } from '../../../services/api';
import { labTestComponentApi } from '../../../services/api/labTestComponentApi';
import { sanitizeComponentForApi, hasFilledValue, createEmptyRow, ComponentRowData } from '../../../utils/labTestComponentUtils';
import { notifications } from '@mantine/notifications';
import logger from '../../../services/logger';

interface Practitioner {
  id: number;
  name: string;
  specialty?: string | null;
}

interface Patient {
  id: number;
}

interface LabResult {
  id: number;
  test_name: string;
  [key: string]: unknown;
}

interface TestPanelCreateDialogProps {
  opened: boolean;
  onClose: () => void;
  onCreateSuccess: (_labResult: LabResult) => void;
  practitioners: Practitioner[];
  currentPatient: Patient | null;
}

interface FormData {
  test_name: string;
  test_category: string;
  ordered_date: string;
  completed_date: string;
  practitioner_id: string;
  facility: string;
}

const EMPTY_FORM: FormData = {
  test_name: '',
  test_category: '',
  ordered_date: '',
  completed_date: '',
  practitioner_id: '',
  facility: '',
};

const TestPanelCreateDialog: React.FC<TestPanelCreateDialogProps> = ({
  opened,
  onClose,
  onCreateSuccess,
  practitioners,
  currentPatient,
}) => {
  const { t } = useTranslation(['medical', 'shared', 'common', 'labresults']);
  const { dateInputFormat, dateParser } = useDateFormat();

  const categoryOptions = [
    { value: 'blood work', label: t('labresults:category.bloodWork') },
    { value: 'imaging', label: t('labresults:category.imaging') },
    { value: 'pathology', label: t('labresults:category.pathology') },
    { value: 'microbiology', label: t('labresults:category.microbiology') },
    { value: 'chemistry', label: t('labresults:category.chemistry') },
    { value: 'hepatology', label: t('labresults:category.hepatology') },
    { value: 'immunology', label: t('labresults:category.immunology') },
    { value: 'genetics', label: t('labresults:category.genetics') },
    { value: 'cardiology', label: t('labresults:category.cardiology') },
    { value: 'pulmonology', label: t('labresults:category.pulmonology') },
    { value: 'hearing', label: t('labresults:category.hearing') },
    { value: 'stomatology', label: t('labresults:category.stomatology') },
    { value: 'other', label: t('shared:fields.other') },
  ];

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inlineTestRef = useRef<InlineTestComponentMethods | null>(null);
  const [autoPopulatedRowIds, setAutoPopulatedRowIds] = useState<ReadonlySet<string>>(new Set());
  const lastAutoPopulatedOptionRef = useRef<string>('');

  const removeUnfilledAutoRows = useCallback((ids: ReadonlySet<string>): ComponentRowData[] => {
    const current = inlineTestRef.current?.getComponents() ?? [];
    const filtered = current.filter(row => !ids.has(row._rowId) || hasFilledValue(row));
    return filtered.length > 0 ? filtered : [createEmptyRow(1)];
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setFormData(EMPTY_FORM);
    setError(null);
    setAutoPopulatedRowIds(new Set());
    lastAutoPopulatedOptionRef.current = '';
    inlineTestRef.current?.clearComponents();
    onClose();
  }, [isSubmitting, onClose]);

  const handleCreate = useCallback(async () => {
    if (!formData.test_name.trim()) {
      setError(
        t('common:validation.fieldRequired', {
          field: t('medical:labResults.addPanel.panelName', 'Lab Results Panel or Type'),
          defaultValue: '{{field}} is required',
        })
      );
      return;
    }
    if (!currentPatient?.id) {
      setError(t('common:validation.noPatientSelected', 'No patient selected. Please select a patient first.'));
      return;
    }

    const pendingComponents =
      inlineTestRef.current?.getPendingComponents() ?? [];
    if (pendingComponents.length === 0) {
      setError(
        t(
          'medical:labResults.addPanel.testResultRequired',
          'At least one test result is required'
        )
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        test_name: formData.test_name.trim(),
        ordered_date: formData.ordered_date || null,
        completed_date: formData.completed_date || null,
        practitioner_id: formData.practitioner_id
          ? parseInt(formData.practitioner_id, 10)
          : null,
        test_category: formData.test_category || null,
        facility: formData.facility.trim() || null,
        patient_id: currentPatient.id,
        status: 'ordered',
        is_panel: true,
      };

      const labResult = await apiService.createLabResult(payload);

      let componentSaveError: 'partial' | 'total' | null = null;

      if (pendingComponents.length > 0) {
        const apiComponents = pendingComponents.map(row =>
          sanitizeComponentForApi(row, labResult.id)
        );
        try {
          const bulkResult = await labTestComponentApi.createBulkForLabResult(
            labResult.id,
            apiComponents,
            currentPatient.id
          );
          if (bulkResult.errors?.length > 0) {
            componentSaveError = 'partial';
            logger.error('test_panel_component_partial_failure', {
              message: 'Some test components failed to save',
              labResultId: labResult.id,
              errors: bulkResult.errors,
              component: 'TestPanelCreateDialog',
            });
          }
        } catch (bulkErr: unknown) {
          componentSaveError = 'total';
          const bulkMessage = bulkErr instanceof Error ? bulkErr.message : String(bulkErr);
          logger.error('test_panel_component_bulk_failure', {
            message: 'Bulk component creation failed after panel was created',
            labResultId: labResult.id,
            error: bulkMessage,
            component: 'TestPanelCreateDialog',
          });
        }
      }

      logger.info('test_panel_created', {
        message: 'Test panel created',
        labResultId: labResult?.id,
        componentCount: pendingComponents.length,
        component: 'TestPanelCreateDialog',
      });

      if (componentSaveError === 'total') {
        notifications.show({
          title: t('medical:labResults.addPanel.componentSaveFailedTitle', 'Test components not saved'),
          message: t(
            'medical:labResults.addPanel.componentSaveFailedMessage',
            'The panel was created but test components could not be saved. Edit the panel to add them.'
          ),
          color: 'red',
          autoClose: 8000,
        });
      } else if (componentSaveError === 'partial') {
        notifications.show({
          title: t('medical:labResults.addPanel.componentPartialSaveTitle', 'Some components not saved'),
          message: t(
            'medical:labResults.addPanel.componentPartialSaveMessage',
            'The panel was created but some test components failed to save. Edit the panel to review.'
          ),
          color: 'yellow',
          autoClose: 8000,
        });
      }

      setFormData(EMPTY_FORM);
      setError(null);
      setAutoPopulatedRowIds(new Set());
      lastAutoPopulatedOptionRef.current = '';
      inlineTestRef.current?.clearComponents();
      onCreateSuccess(labResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('test_panel_create_error', {
        message: 'Failed to create test panel',
        error: message,
        component: 'TestPanelCreateDialog',
      });
      setError(message || t('medical:labResults.addPanel.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, currentPatient, onCreateSuccess, t]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Text fw={600} size="lg">
          {t('medical:labResults.addPanel.title')}
        </Text>
      }
      size="xl"
      centered
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
      zIndex={2000}
      scrollAreaComponent="div"
    >
      <FormLoadingOverlay
        visible={isSubmitting}
        message={t('medical:labResults.addPanel.creating')}
      />

      <Stack gap="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Autocomplete
          label={t('medical:labResults.addPanel.panelName')}
          placeholder={t('medical:labResults.addPanel.panelNamePlaceholder')}
          description={t('medical:labResults.addPanel.panelNameDescription')}
          value={formData.test_name}
          onChange={value => {
            setFormData(prev => ({ ...prev, test_name: value }));
            if (autoPopulatedRowIds.size > 0 && value !== lastAutoPopulatedOptionRef.current) {
              inlineTestRef.current?.setComponents(removeUnfilledAutoRows(autoPopulatedRowIds));
              setAutoPopulatedRowIds(new Set());
              lastAutoPopulatedOptionRef.current = '';
            }
          }}
          onOptionSubmit={value => {
            lastAutoPopulatedOptionRef.current = value;
            const panelName = extractPanelName(value);
            const panel = getPanelByOption(value);
            const category = panel
              ? (PANEL_CATEGORY_TO_FORM_CATEGORY[panel.category] ?? '')
              : '';
            setFormData(prev => ({
              ...prev,
              test_name: panelName,
              test_category: category || prev.test_category,
            }));
            const cleaned = removeUnfilledAutoRows(autoPopulatedRowIds);
            const templateRows = getTemplateRowsForPanel(panelName);
            if (templateRows) {
              const combined = [
                ...cleaned.filter(r => r.test_name.trim() !== ''),
                ...templateRows,
              ];
              inlineTestRef.current?.setComponents(combined.length > 0 ? combined : templateRows);
              setAutoPopulatedRowIds(new Set(templateRows.map(r => r._rowId)));
            } else {
              inlineTestRef.current?.setComponents(cleaned);
              setAutoPopulatedRowIds(new Set());
            }
          }}
          rightSection={
            formData.test_name ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => {
                  inlineTestRef.current?.setComponents(removeUnfilledAutoRows(autoPopulatedRowIds));
                  setAutoPopulatedRowIds(new Set());
                  lastAutoPopulatedOptionRef.current = '';
                  setFormData(prev => ({ ...prev, test_name: '' }));
                }}
                aria-label={t('common:buttons.clear', 'Clear')}
                disabled={isSubmitting}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          data={getPanelAutocompleteOptions(formData.test_name)}
          limit={50}
          filter={({ options, limit }) => options.slice(0, limit)}
          maxDropdownHeight={300}
          comboboxProps={{ zIndex: 3001 }}
          required
          autoFocus
          disabled={isSubmitting}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label={t('shared:labels.orderedDate')}
              value={parseDateInput(formData.ordered_date)}
              onChange={date => {
                setFormData(prev => ({
                  ...prev,
                  ordered_date: formatDateInputChange(date),
                }));
              }}
              placeholder={dateInputFormat}
              valueFormat={dateInputFormat}
              dateParser={dateParser}
              clearable
              firstDayOfWeek={0}
              popoverProps={{ withinPortal: true, zIndex: 3000 }}
              disabled={isSubmitting}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label={t('shared:labels.completedDate')}
              value={parseDateInput(formData.completed_date)}
              onChange={date => {
                setFormData(prev => ({
                  ...prev,
                  completed_date: formatDateInputChange(date),
                }));
              }}
              placeholder={dateInputFormat}
              valueFormat={dateInputFormat}
              dateParser={dateParser}
              clearable
              firstDayOfWeek={0}
              popoverProps={{ withinPortal: true, zIndex: 3000 }}
              disabled={isSubmitting}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <PractitionerSelectWithCreate
              value={formData.practitioner_id || null}
              onChange={value =>
                setFormData(prev => ({ ...prev, practitioner_id: value || '' }))
              }
              practitioners={practitioners}
              label={t('shared:labels.orderingPractitioner')}
              placeholder={t('shared:fields.selectPractitioner')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label={t('labresults:testCategory.label')}
              value={formData.test_category || null}
              onChange={value =>
                setFormData(prev => ({ ...prev, test_category: value || '' }))
              }
              data={categoryOptions}
              placeholder={t('shared:labels.selectCategory')}
              searchable
              clearable
              comboboxProps={{ withinPortal: true, zIndex: 3001 }}
              disabled={isSubmitting}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label={t('labresults:testingFacility.label')}
              placeholder={t('labresults:testingFacility.placeholder')}
              value={formData.facility}
              onChange={e =>
                setFormData(prev => ({ ...prev, facility: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </Grid.Col>
        </Grid>

        <InlineTestComponentEntry
          onRef={methods => {
            inlineTestRef.current = methods;
          }}
          defaultExpanded
          disabled={isSubmitting}
        />

        <Group justify="flex-end" gap="sm" mt="sm">
          <Button variant="default" onClick={handleClose} disabled={isSubmitting}>
            {t('shared:fields.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleCreate} loading={isSubmitting}>
            {t('medical:labResults.addPanel.createButton')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default TestPanelCreateDialog;
