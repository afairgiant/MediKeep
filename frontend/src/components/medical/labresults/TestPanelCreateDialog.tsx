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
import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { DateInput } from '../../adapters/DateInput';
import LabResultTagsField from './LabResultTagsField';
import SameAsOrderedLink from './SameAsOrderedLink';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
import { useDateFormat } from '../../../hooks/useDateFormat';
import PractitionerSelectWithCreate from '../practitioners/PractitionerSelectWithCreate';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import InlineTestComponentEntry, {
  InlineTestComponentMethods,
} from './InlineTestComponentEntry';
import AdvancedModeSwitch from './AdvancedModeSwitch';
import { apiService } from '../../../services/api';
import { submitPendingTestComponents } from '../../../utils/labTestComponentUtils';
import {
  useTestNameAutocomplete,
  TestNameFields,
} from '../../../hooks/useTestNameAutocomplete';
import logger from '../../../services/logger';
import { useSubDialog } from '../../../contexts/SubDialogContext';
import { useNestedDialog } from '../../../hooks/useNestedDialog';

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
  onCreateSuccess: (_labResult: LabResult) => void | Promise<void>;
  practitioners: Practitioner[];
  currentPatient: Patient | null;
  /** Omit both to hide the Simple/Advanced switch (e.g. when opened from another dialog) */
  advancedMode?: boolean;
  onAdvancedModeChange?: (_checked: boolean) => void;
}

interface FormData {
  test_name: string;
  test_category: string;
  ordered_date: string;
  completed_date: string;
  practitioner_id: string;
  facility: string;
  tags: string[];
}

const EMPTY_FORM: FormData = {
  test_name: '',
  test_category: '',
  ordered_date: '',
  completed_date: '',
  practitioner_id: '',
  facility: '',
  tags: [],
};

const TestPanelCreateDialog: React.FC<TestPanelCreateDialogProps> = ({
  opened,
  onClose,
  onCreateSuccess,
  practitioners,
  currentPatient,
  advancedMode,
  onAdvancedModeChange,
}) => {
  const { t } = useTranslation(['medical', 'shared', 'common', 'labresults']);
  const { dateInputFormat, dateParser } = useDateFormat();
  const subDialog = useSubDialog();

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
  const getInlineMethods = useCallback(() => inlineTestRef.current, []);
  const handleNameFieldsChange = useCallback(
    (fields: TestNameFields) => setFormData(prev => ({ ...prev, ...fields })),
    []
  );
  const {
    nameOptions,
    handleChange: handleNameChange,
    handleOptionSubmit: handleNameOptionSubmit,
    handleClear: handleNameClear,
    reset: resetAutoPopulate,
  } = useTestNameAutocomplete({
    testName: formData.test_name,
    getInlineMethods,
    onFieldsChange: handleNameFieldsChange,
  });

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setFormData(EMPTY_FORM);
    setError(null);
    resetAutoPopulate();
    inlineTestRef.current?.clearComponents();
    onClose();
  }, [isSubmitting, onClose, resetAutoPopulate]);

  // Opened from inside another dialog: Escape closes this one only, through the guarded close
  useNestedDialog(opened && !!subDialog, handleClose);

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

    let createdLabResult: LabResult;
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
        tags: formData.tags,
        patient_id: currentPatient.id,
        status: 'ordered',
        is_panel: true,
      };

      const labResult = await apiService.createLabResult(payload);
      createdLabResult = labResult;

      await submitPendingTestComponents(
        labResult.id,
        pendingComponents,
        currentPatient.id,
        'TestPanelCreateDialog',
        t
      );

      logger.info('test_panel_created', {
        message: 'Test panel created',
        labResultId: labResult?.id,
        componentCount: pendingComponents.length,
        component: 'TestPanelCreateDialog',
      });

      setFormData(EMPTY_FORM);
      setError(null);
      resetAutoPopulate();
      inlineTestRef.current?.clearComponents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('test_panel_create_error', {
        message: 'Failed to create test panel',
        error: message,
        component: 'TestPanelCreateDialog',
      });
      setError(message || t('medical:labResults.addPanel.createError'));
      setIsSubmitting(false);
      return;
    }

    // The panel exists now, so a failing callback must not read as "create failed" (a retry
    // would duplicate it). Staying busy until it settles stops a second submit meanwhile.
    try {
      await onCreateSuccess(createdLabResult);
    } catch (err: unknown) {
      logger.error('test_panel_create_success_callback_failed', {
        message: 'Panel created but the follow-up step failed',
        error: err instanceof Error ? err.message : String(err),
        component: 'TestPanelCreateDialog',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, currentPatient, onCreateSuccess, resetAutoPopulate, t]);

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
      zIndex={subDialog?.zIndex ?? 2000}
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
          onChange={handleNameChange}
          onOptionSubmit={handleNameOptionSubmit}
          rightSection={
            formData.test_name ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleNameClear}
                aria-label={t('common:buttons.clear', 'Clear')}
                disabled={isSubmitting}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          data={nameOptions}
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
            <SameAsOrderedLink
              onClick={() =>
                setFormData(prev => ({
                  ...prev,
                  completed_date: prev.ordered_date,
                }))
              }
              disabled={isSubmitting || !formData.ordered_date}
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
          <Grid.Col span={12}>
            <LabResultTagsField
              value={formData.tags}
              onChange={tags => setFormData(prev => ({ ...prev, tags }))}
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

        <Group justify="space-between" gap="sm" mt="sm">
          {onAdvancedModeChange ? (
            <AdvancedModeSwitch
              checked={!!advancedMode}
              onChange={onAdvancedModeChange}
              disabled={isSubmitting}
            />
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={handleClose} disabled={isSubmitting}>
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} loading={isSubmitting}>
              {t('medical:labResults.addPanel.createButton')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default TestPanelCreateDialog;
