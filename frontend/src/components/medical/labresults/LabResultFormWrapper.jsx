import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Autocomplete,
  NumberInput,
  Textarea,
  Select,
  Text,
  Paper,
  Badge,
  ActionIcon,
  Collapse,
} from '@mantine/core';
import { DateInput } from '../../adapters/DateInput';
import {
  IconInfoCircle,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconFileUpload,
  IconNotes,
  IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useLinkPanelDescription } from '../../../hooks/useLinkPanelDescription';
import { useDateFormat } from '../../../hooks/useDateFormat';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { useTestNameAutocomplete } from '../../../hooks/useTestNameAutocomplete';
import {
  parseDateInput,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import PractitionerSelectWithCreate from '../practitioners/PractitionerSelectWithCreate';
import LabResultTagsField from './LabResultTagsField';
import RecordVisitsCard from '../../shared/RecordVisitsCard';
import LabResultLinkTabButtons from './LabResultLinkTabs';
import LabResultRecordLinksCard from './LabResultRecordLinksCard';
import TestComponentsTab from './TestComponentsTab';
import InlineTestComponentEntry from './InlineTestComponentEntry';
import AdvancedModeSwitch from './AdvancedModeSwitch';
import SameAsOrderedLink from './SameAsOrderedLink';
import {
  linksToPending,
  pendingToLinks,
} from '../../../constants/labResultRecordLinks';
import logger from '../../../services/logger';
import { getRememberedEditTab } from '../../../utils/editTabHandoff';

const LabResultFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners = [],
  isLoading = false,
  onDocumentManagerRef,
  onPendingRelationshipsRef,
  onPendingComponentsRef,
  onSwitchToQuickImport,
  onFileUploadComplete,
  onError,
  // Saved links of the lab results, for the numbers on the link tabs
  labResultConditions = {},
  fetchLabResultConditions,
  // Visits card
  patientId,
  labResultMedications = {},
  fetchLabResultMedications,
  labResultProcedures = {},
  fetchLabResultProcedures,
  labResultTreatments = {},
  fetchLabResultTreatments,
  navigate,
  isGroupedResult = false,
  postCreate = false,
  advancedCreate = false,
  onAdvancedModeChange,
  children,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const linkPanelDescription = useLinkPanelDescription();
  const { dateInputFormat, dateParser } = useDateFormat();
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Collapsible numeric-result section (edit mode, non-panel): expanded by default
  // since it's the leading section when there's no component data yet.
  const [numericResultExpanded, setNumericResultExpanded] = useState(true);
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Pending relationships for create mode (stored locally until lab result is saved)
  const [pendingConditions, setPendingConditions] = useState([]);
  const [pendingEncounters, setPendingEncounters] = useState([]);
  const [pendingMedications, setPendingMedications] = useState([]);
  const [pendingProcedures, setPendingProcedures] = useState([]);
  const [pendingTreatments, setPendingTreatments] = useState([]);
  const [savedLinkCounts, setSavedLinkCounts] = useState({});

  // Notes and create-mode relationship linking are only shown once the record exists
  // (edit mode) or when the user has opted into the advanced create form.
  const showAdvancedTabs = !!editingItem || advancedCreate;
  // The mode toggle itself only makes sense during a true create (not edit/post-create).
  const showAdvancedToggle = !editingItem && !!onAdvancedModeChange;

  // A component-less result (!isGroupedResult) is either a legacy single-value
  // result - one that has its one-and-only result recorded directly on value/
  // labs_result, never as a component (#1025 follow-up) - or a new-style
  // result whose components haven't been added yet, or were all deleted.
  // isGroupedResult alone can't tell these apart (both currently have zero
  // components); the flat fields can, since only a legacy result has them.
  // Read from editingItem (the saved record), not formData (live, mutable
  // form state): formData changes on every keystroke, so deriving this from
  // it would flip the Tests section's visibility mid-edit - e.g. clearing
  // the Lab Result field before entering a value would make it pop in
  // unprompted. isGroupedResult is already stable for the same reason.
  const hasFlatResultValue =
    editingItem?.value !== '' &&
    editingItem?.value !== null &&
    editingItem?.value !== undefined;
  const hasFlatLabsResult = !!(
    editingItem?.labs_result && editingItem.labs_result.trim()
  );
  const isLegacySingleResult =
    !isGroupedResult && (hasFlatResultValue || hasFlatLabsResult);

  const statusOptions = [
    { value: 'ordered', label: t('labresults:status.ordered') },
    { value: 'in-progress', label: t('labresults:status.inProgress') },
    { value: 'completed', label: t('labresults:status.completed') },
    { value: 'cancelled', label: t('labresults:status.cancelled') },
  ];

  const categoryOptions = [
    { value: 'blood work', label: t('labresults:category.bloodWork') },
    { value: 'hematology', label: t('labresults:category.hematology') },
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

  const testTypeOptions = [
    { value: 'routine', label: t('labresults:testType.routine') },
    { value: 'urgent', label: t('labresults:testType.urgent') },
    { value: 'emergency', label: t('labresults:testType.emergency') },
    { value: 'follow-up', label: t('labresults:testType.followUp') },
    { value: 'screening', label: t('labresults:testType.screening') },
  ];

  const labResultOptions = [
    { value: 'normal', label: t('labresults:result.normal'), color: 'green' },
    { value: 'abnormal', label: t('labresults:result.abnormal'), color: 'red' },
    { value: 'critical', label: t('labresults:result.critical'), color: 'red' },
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

  const getResultBadge = result => {
    const option = labResultOptions.find(opt => opt.value === result);
    if (!option) return null;
    return (
      <Badge color={option.color} variant="light" size="sm">
        {option.label}
      </Badge>
    );
  };

  const handleCompletedSameAsOrdered = () => {
    onInputChange({
      target: { name: 'completed_date', value: formData.ordered_date || '' },
    });
  };

  const handleDocumentManagerRef = methods => {
    if (onDocumentManagerRef) onDocumentManagerRef(methods);
  };

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in lab results ${editingItem ? 'edit' : 'create'}`,
      labResultId: editingItem?.id,
      error,
      component: 'LabResultFormWrapper',
    });
    if (onError) onError(error);
  };

  const handleDocumentUploadComplete = (
    success,
    completedCount,
    failedCount
  ) => {
    logger.info('lab_results_upload_completed', {
      message: 'File upload completed in lab results form',
      labResultId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'LabResultFormWrapper',
    });
    if (onFileUploadComplete)
      onFileUploadComplete(success, completedCount, failedCount);
  };

  useEffect(() => {
    if (isOpen) setActiveTab(getRememberedEditTab('labResults', 'basic'));
    if (!isOpen) {
      setIsSubmitting(false);
      setPendingConditions([]);
      setPendingEncounters([]);
      setPendingMedications([]);
      setPendingProcedures([]);
      setPendingTreatments([]);
      setSavedLinkCounts({});
      // Links changed in the link cards are not known to the page's lists
      if (linkedLabResultIdRef.current) {
        const id = linkedLabResultIdRef.current;
        linkedLabResultIdRef.current = null;
        const fetchers = fetchSavedLinksRef.current;
        fetchers.conditions?.(id);
        fetchers.medications?.(id);
        fetchers.procedures?.(id);
        fetchers.treatments?.(id);
      }
    }
  }, [isOpen]);

  // Latest pending relationships, read live by the methods object below so that
  // adding/removing an item doesn't re-notify the parent (which would re-render it).
  const pendingRelationshipsRef = useRef({
    pendingConditions,
    pendingEncounters,
    pendingMedications,
    pendingProcedures,
    pendingTreatments,
  });
  pendingRelationshipsRef.current = {
    pendingConditions,
    pendingEncounters,
    pendingMedications,
    pendingProcedures,
    pendingTreatments,
  };

  // Expose pending relationships ref to parent (same pattern as onDocumentManagerRef).
  // Only re-registers when the callback identity changes, not on every pending edit.
  useEffect(() => {
    if (onPendingRelationshipsRef) {
      onPendingRelationshipsRef({
        hasPendingRelationships: () =>
          pendingRelationshipsRef.current.pendingConditions.length > 0 ||
          pendingRelationshipsRef.current.pendingEncounters.length > 0 ||
          pendingRelationshipsRef.current.pendingMedications.length > 0 ||
          pendingRelationshipsRef.current.pendingProcedures.length > 0 ||
          pendingRelationshipsRef.current.pendingTreatments.length > 0,
        getPendingRelationships: () => ({
          conditions: pendingRelationshipsRef.current.pendingConditions,
          encounters: pendingRelationshipsRef.current.pendingEncounters,
          medications: pendingRelationshipsRef.current.pendingMedications,
          procedures: pendingRelationshipsRef.current.pendingProcedures,
          treatments: pendingRelationshipsRef.current.pendingTreatments,
        }),
      });
    }
  }, [onPendingRelationshipsRef]);

  // InlineTestComponentEntry's onRef fires on every keystroke (its methods depend on
  // component state), so hold the latest methods in a ref and expose a stable wrapper
  // to the parent — same "read live, register once" approach as pendingRelationshipsRef
  // below, avoiding a parent re-render on every pending test-row edit.
  const inlineComponentsMethodsRef = useRef(null);
  const handleInlineComponentsRef = useCallback(methods => {
    inlineComponentsMethodsRef.current = methods;
  }, []);

  // Test-name suggestions (create mode only): picking a panel/test fills the
  // category and pre-populates the staged component rows, matching the quick
  // TestPanelCreateDialog. Edit/post-create records use the plain input since
  // their components are managed through the API.
  const showNameAutocomplete = !editingItem && !postCreate;
  const getInlineMethods = useCallback(
    () => inlineComponentsMethodsRef.current,
    []
  );
  const handleNameFieldsChange = useCallback(
    fields => {
      Object.entries(fields).forEach(([name, value]) => {
        onInputChange({ target: { name, value } });
      });
    },
    [onInputChange]
  );
  const {
    nameOptions,
    handleChange: handleNameChange,
    handleOptionSubmit: handleNameOptionSubmit,
    handleClear: handleNameClear,
  } = useTestNameAutocomplete({
    testName: formData.test_name || '',
    getInlineMethods,
    onFieldsChange: handleNameFieldsChange,
  });

  useEffect(() => {
    if (onPendingComponentsRef) {
      onPendingComponentsRef({
        hasPendingComponents: () =>
          inlineComponentsMethodsRef.current?.hasPendingComponents() ?? false,
        getPendingComponents: () =>
          inlineComponentsMethodsRef.current?.getPendingComponents() ?? [],
      });
    }
  }, [onPendingComponentsRef]);

  // Pending encounter helpers
  // The Visits card works with {entityId, relevanceNote, purpose}; the pending list
  // (and the save step in the page) keeps the API field names.
  const pendingVisitLinks = useMemo(
    () =>
      pendingEncounters.map(pe => ({
        entityId: pe.encounter_id,
        relevanceNote: pe.relevance_note,
        purpose: pe.purpose,
      })),
    [pendingEncounters]
  );

  // Numbers shown on the linked-record tabs: the saved links of an existing lab result,
  // or the links chosen so far in the Add form
  const savedLabResultId = editingItem?.id;
  const linkCounts = savedLabResultId
    ? {
        conditions:
          savedLinkCounts.conditions ??
          labResultConditions[savedLabResultId]?.length,
        medications:
          savedLinkCounts.medications ??
          labResultMedications[savedLabResultId]?.length,
        procedures:
          savedLinkCounts.procedures ??
          labResultProcedures[savedLabResultId]?.length,
        treatments:
          savedLinkCounts.treatments ??
          labResultTreatments[savedLabResultId]?.length,
      }
    : {
        conditions: pendingConditions.length,
        medications: pendingMedications.length,
        procedures: pendingProcedures.length,
        treatments: pendingTreatments.length,
      };

  // The saved links are loaded when the dialog opens so the tabs can show their numbers
  useEffect(() => {
    if (!isOpen || !savedLabResultId) return;
    fetchLabResultConditions?.(savedLabResultId);
    fetchLabResultMedications?.(savedLabResultId);
    fetchLabResultProcedures?.(savedLabResultId);
    fetchLabResultTreatments?.(savedLabResultId);
    // The fetch functions are recreated on every render of the page; only opening, or a
    // different lab result, should load the links again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, savedLabResultId]);

  const handlePendingVisitsChange = useCallback(next => {
    setPendingEncounters(
      next.map(link => ({
        encounter_id: link.entityId,
        purpose: link.purpose || null,
        relevance_note: link.relevanceNote || null,
      }))
    );
  }, []);

  // The link cards work with {entityId, relevanceNote, purpose, expectedFrequency};
  // the pending lists (and the save step in the page) keep the API field names.
  const pendingLinkGroups = useMemo(
    () => ({
      conditions: pendingToLinks('conditions', pendingConditions),
      medications: pendingToLinks('medications', pendingMedications),
      procedures: pendingToLinks('procedures', pendingProcedures),
      treatments: pendingToLinks('treatments', pendingTreatments),
    }),
    [
      pendingConditions,
      pendingMedications,
      pendingProcedures,
      pendingTreatments,
    ]
  );

  const handlePendingLinksChange = useCallback((key, next) => {
    const setters = {
      conditions: setPendingConditions,
      medications: setPendingMedications,
      procedures: setPendingProcedures,
      treatments: setPendingTreatments,
    };
    setters[key](linksToPending(key, next));
  }, []);

  // Saved link counts, kept current by the link cards as links are added or removed.
  // The page's own lists are refreshed when the dialog closes.
  const linkedLabResultIdRef = useRef(null);
  const fetchSavedLinksRef = useRef({});
  fetchSavedLinksRef.current = {
    conditions: fetchLabResultConditions,
    medications: fetchLabResultMedications,
    procedures: fetchLabResultProcedures,
    treatments: fetchLabResultTreatments,
  };
  const savedIdRef = useRef(null);
  savedIdRef.current = editingItem?.id ?? null;
  const handleSavedLinkCount = useCallback((key, count) => {
    linkedLabResultIdRef.current = savedIdRef.current;
    setSavedLinkCounts(prev =>
      prev[key] === count ? prev : { ...prev, [key]: count }
    );
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('lab_result_form_wrapper_error', {
        message: 'Error in LabResultFormWrapper',
        labResultId: editingItem?.id,
        error: error.message,
        component: 'LabResultFormWrapper',
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // One card per kind of record, the same card in the Add and Edit forms
  const renderLinksCard = linkKey => (
    <LabResultRecordLinksCard
      linkKey={linkKey}
      labResultId={editingItem?.id}
      description={linkPanelDescription(linkKey, 'labResult')}
      patientId={patientId}
      pendingLinks={pendingLinkGroups[linkKey]}
      onPendingChange={next => handlePendingLinksChange(linkKey, next)}
      onCountChange={handleSavedLinkCount}
      navigate={navigate}
    />
  );

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading && !isSubmitting}
      closeOnEscape={!isLoading && !isSubmitting}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="basic"
                leftSection={<IconInfoCircle size={16} />}
              >
                {t('shared:tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab
                value="results"
                leftSection={<IconChartBar size={16} />}
              >
                {t('labresults:tabs.resultsStatus')}
              </Tabs.Tab>
              {showAdvancedTabs && (
                <LabResultLinkTabButtons
                  labResultId={savedLabResultId}
                  counts={linkCounts}
                  pendingVisitLinks={pendingVisitLinks}
                  activeTab={activeTab}
                  onSelectTab={setActiveTab}
                />
              )}
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingItem
                  ? t('shared:tabs.documents')
                  : t('shared:tabs.addFiles')}
              </Tabs.Tab>
              {showAdvancedTabs && (
                <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                  {t('shared:tabs.notes')}
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: isGroupedResult ? 12 : 8 }}>
                    {showNameAutocomplete ? (
                      <Autocomplete
                        label={t('shared:fields.testName')}
                        value={formData.test_name || ''}
                        onChange={handleNameChange}
                        onOptionSubmit={handleNameOptionSubmit}
                        data={nameOptions}
                        limit={50}
                        filter={({ options, limit }) => options.slice(0, limit)}
                        maxDropdownHeight={300}
                        placeholder={t('labresults:testName.placeholder')}
                        description={t('labresults:testName.description')}
                        comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                        rightSection={
                          formData.test_name ? (
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              onClick={handleNameClear}
                              aria-label={t('common:buttons.clear', 'Clear')}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          ) : null
                        }
                        required
                      />
                    ) : (
                      <TextInput
                        label={t('shared:fields.testName')}
                        value={formData.test_name || ''}
                        onChange={handleTextInputChange('test_name')}
                        placeholder={t('labresults:testName.placeholder')}
                        description={t('labresults:testName.description')}
                        required
                      />
                    )}
                  </Grid.Col>
                  {!isGroupedResult && (
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label={t('shared:fields.testCode')}
                        value={formData.test_code || ''}
                        onChange={handleTextInputChange('test_code')}
                        placeholder={t('labresults:testCode.placeholder')}
                        description={t('labresults:testCode.description')}
                      />
                    </Grid.Col>
                  )}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('labresults:testCategory.label')}
                      value={formData.test_category || null}
                      data={categoryOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'test_category', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:labels.selectCategory')}
                      description={t('labresults:testCategory.description')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  {!isGroupedResult && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={t('labresults:testTypeField.label')}
                        value={formData.test_type || null}
                        data={testTypeOptions}
                        onChange={value => {
                          onInputChange({
                            target: { name: 'test_type', value: value || '' },
                          });
                        }}
                        placeholder={t('labresults:testTypeField.placeholder')}
                        description={t('labresults:testTypeField.description')}
                        clearable
                        comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      />
                    </Grid.Col>
                  )}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('labresults:testingFacility.label')}
                      value={formData.facility || ''}
                      onChange={handleTextInputChange('facility')}
                      placeholder={t('labresults:testingFacility.placeholder')}
                      description={t('labresults:testingFacility.description')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <PractitionerSelectWithCreate
                      value={
                        formData.practitioner_id
                          ? String(formData.practitioner_id)
                          : null
                      }
                      onChange={value => {
                        onInputChange({
                          target: {
                            name: 'practitioner_id',
                            value: value || '',
                          },
                        });
                      }}
                      practitioners={practitioners}
                      label={t('shared:labels.orderingPractitioner')}
                      placeholder={t('shared:fields.selectPractitioner')}
                      description={t(
                        'labresults:orderingPractitioner.description'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:labels.orderedDate')}
                      value={parseDateInput(formData.ordered_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'ordered_date',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t('labresults:orderedDate.description')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:labels.completedDate')}
                      value={parseDateInput(formData.completed_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'completed_date',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t('labresults:completedDate.description')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                    <SameAsOrderedLink
                      onClick={handleCompletedSameAsOrdered}
                      disabled={!formData.ordered_date}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <LabResultTagsField
                      value={formData.tags || []}
                      onChange={tags => {
                        onInputChange({
                          target: { name: 'tags', value: tags },
                        });
                      }}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Results & Status Tab */}
            <Tabs.Panel value="results">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('labresults:testStatus.label')}
                      value={formData.status || null}
                      data={statusOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'status', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:fields.selectStatus')}
                      description={t('labresults:testStatus.description')}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  {!isGroupedResult && (
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={t('shared:labels.labResult')}
                        value={formData.labs_result || null}
                        data={labResultOptions}
                        onChange={value => {
                          onInputChange({
                            target: { name: 'labs_result', value: value || '' },
                          });
                        }}
                        placeholder={t('labresults:labResult.placeholder')}
                        description={t('labresults:labResult.description')}
                        clearable
                        comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      />
                    </Grid.Col>
                  )}
                  {formData.status && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          {t('labresults:form.statusIndicator')}
                        </Text>
                        <Badge
                          color={getStatusColor(formData.status)}
                          variant="light"
                          size="sm"
                        >
                          {statusOptions.find(
                            opt => opt.value === formData.status
                          )?.label || formData.status}
                        </Badge>
                      </Box>
                    </Grid.Col>
                  )}
                  {!isGroupedResult && formData.labs_result && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          {t('labresults:form.resultIndicator')}
                        </Text>
                        {getResultBadge(formData.labs_result)}
                      </Box>
                    </Grid.Col>
                  )}
                  {editingItem ? (
                    <>
                      {/* Singleton results (non-panel): direct numeric value editing,
                          collapsible. Leads when there's no component data yet; hidden
                          entirely once the result has components (isGroupedResult) —
                          components take over as the sole editor at that point. */}
                      {!isGroupedResult && (
                        <Grid.Col span={12}>
                          <Paper withBorder p="sm" radius="md">
                            <Group
                              justify="space-between"
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setNumericResultExpanded(prev => !prev)
                              }
                            >
                              <Text size="sm" fw={500}>
                                {t(
                                  'labresults:numericResult.sectionLabel',
                                  'Numeric Result (optional)'
                                )}
                              </Text>
                              {numericResultExpanded ? (
                                <IconChevronUp size={18} />
                              ) : (
                                <IconChevronDown size={18} />
                              )}
                            </Group>
                            <Collapse in={numericResultExpanded}>
                              <Text size="xs" c="dimmed" mb="sm" mt="sm">
                                {t(
                                  'labresults:numericResult.sectionDescription',
                                  'Enter a measured value and reference range to enable trend charting for stacked results.'
                                )}
                              </Text>
                              <Grid>
                                <Grid.Col span={{ base: 12, sm: 6 }}>
                                  <NumberInput
                                    label={t(
                                      'labresults:numericResult.valueLabel',
                                      'Value'
                                    )}
                                    value={formData.value ?? ''}
                                    onChange={val =>
                                      onInputChange({
                                        target: {
                                          name: 'value',
                                          value: val === '' ? null : val,
                                        },
                                      })
                                    }
                                    placeholder={t(
                                      'labresults:numericResult.valuePlaceholder',
                                      'e.g. 6.2'
                                    )}
                                    decimalScale={6}
                                    allowDecimal
                                    clearable
                                  />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, sm: 6 }}>
                                  <TextInput
                                    label={t(
                                      'labresults:numericResult.unitLabel',
                                      'Unit'
                                    )}
                                    value={formData.unit || ''}
                                    onChange={e =>
                                      onInputChange({
                                        target: {
                                          name: 'unit',
                                          value: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder={t(
                                      'labresults:numericResult.unitPlaceholder',
                                      'e.g. mg/dL, mmol/L'
                                    )}
                                    maxLength={50}
                                  />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, sm: 4 }}>
                                  <NumberInput
                                    label={t(
                                      'labresults:numericResult.refMinLabel',
                                      'Range min'
                                    )}
                                    value={formData.ref_range_min ?? ''}
                                    onChange={val =>
                                      onInputChange({
                                        target: {
                                          name: 'ref_range_min',
                                          value: val === '' ? null : val,
                                        },
                                      })
                                    }
                                    placeholder={t(
                                      'labresults:numericResult.refMinPlaceholder',
                                      'e.g. 4.0'
                                    )}
                                    decimalScale={6}
                                    allowDecimal
                                    clearable
                                  />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, sm: 4 }}>
                                  <NumberInput
                                    label={t(
                                      'labresults:numericResult.refMaxLabel',
                                      'Range max'
                                    )}
                                    value={formData.ref_range_max ?? ''}
                                    onChange={val =>
                                      onInputChange({
                                        target: {
                                          name: 'ref_range_max',
                                          value: val === '' ? null : val,
                                        },
                                      })
                                    }
                                    placeholder={t(
                                      'labresults:numericResult.refMaxPlaceholder',
                                      'e.g. 5.6'
                                    )}
                                    decimalScale={6}
                                    allowDecimal
                                    clearable
                                  />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, sm: 4 }}>
                                  <TextInput
                                    label={t(
                                      'labresults:numericResult.refTextLabel',
                                      'Range text'
                                    )}
                                    value={formData.ref_range_text || ''}
                                    onChange={e =>
                                      onInputChange({
                                        target: {
                                          name: 'ref_range_text',
                                          value: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder={t(
                                      'labresults:numericResult.refTextPlaceholder',
                                      'e.g. 4.0-5.6 or <200'
                                    )}
                                    description={t(
                                      'labresults:numericResult.refTextDescription',
                                      'Overrides min/max in display'
                                    )}
                                    maxLength={100}
                                  />
                                </Grid.Col>
                              </Grid>
                            </Collapse>
                          </Paper>
                        </Grid.Col>
                      )}
                      {/* API-backed components editor. Hidden only for a legacy
                          single-value result (isLegacySingleResult - #1025 follow-up):
                          its one-and-only result already lives on value/labs_result
                          above, so an "Add Test" block below it read as broken/
                          extraneous rather than useful. Shown for every new-style
                          result, including one with zero components right now -
                          either because none have been added yet, or all were
                          deleted - since for those, unlike a legacy result, Add Test
                          is the only way to give the result any content at all. */}
                      {!isLegacySingleResult && (
                        <Grid.Col span={12}>
                          <TestComponentsTab
                            key={`test-components-${editingItem.id}`}
                            labResultId={editingItem.id}
                            isViewMode={false}
                            orderedDate={formData.ordered_date}
                            onError={onError}
                          />
                        </Grid.Col>
                      )}
                    </>
                  ) : (
                    /* New (create mode): stage components locally before the record exists */
                    <Grid.Col span={12}>
                      <InlineTestComponentEntry
                        onRef={handleInlineComponentsRef}
                      />
                      {onSwitchToQuickImport && (
                        <Button
                          variant="subtle"
                          mt="sm"
                          leftSection={<IconFileUpload size={16} />}
                          onClick={onSwitchToQuickImport}
                        >
                          {t('labresults:bulkImport', 'Bulk Import')}
                        </Button>
                      )}
                    </Grid.Col>
                  )}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="lab-result"
                  entityId={editingItem?.id || null}
                  mode={editingItem ? 'edit' : 'create'}
                  onUploadPendingFiles={handleDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={handleDocumentUploadComplete}
                  onError={handleDocumentError}
                />
              </Box>
            </Tabs.Panel>

            {/* Linked-record tabs - edit mode, or create mode when advanced */}
            {showAdvancedTabs && (
              <>
                <Tabs.Panel value="rel-conditions">
                  <Box mt="md">
                    {activeTab === 'rel-conditions' &&
                      renderLinksCard('conditions')}
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="rel-visits">
                  <Box mt="md">
                    {activeTab === 'rel-visits' && (
                      <RecordVisitsCard
                        recordType="labResults"
                        recordId={editingItem?.id}
                        description={linkPanelDescription('visits', 'labResult')}
                        patientId={patientId}
                        pendingLinks={pendingVisitLinks}
                        onPendingChange={handlePendingVisitsChange}
                        navigate={navigate}
                      />
                    )}
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="rel-medications">
                  <Box mt="md">
                    {activeTab === 'rel-medications' &&
                      renderLinksCard('medications')}
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="rel-procedures">
                  <Box mt="md">
                    {activeTab === 'rel-procedures' &&
                      renderLinksCard('procedures')}
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="rel-treatments">
                  <Box mt="md">
                    {activeTab === 'rel-treatments' &&
                      renderLinksCard('treatments')}
                  </Box>
                </Tabs.Panel>
              </>
            )}

            {/* Notes Tab */}
            {showAdvancedTabs && (
              <Tabs.Panel value="notes">
                <Box mt="md">
                  <Textarea
                    label={t('shared:fields.additionalNotes')}
                    value={formData.notes || ''}
                    onChange={handleTextInputChange('notes')}
                    placeholder={t('labresults:additionalNotes.placeholder')}
                    description={t('labresults:additionalNotes.description')}
                    rows={5}
                    minRows={3}
                    autosize
                    maxLength={5000}
                  />
                </Box>
              </Tabs.Panel>
            )}
          </Tabs>

          {/* Form Actions */}
          <Group
            justify={showAdvancedToggle ? 'space-between' : 'flex-end'}
            gap="sm"
          >
            {showAdvancedToggle && (
              <AdvancedModeSwitch
                checked={advancedCreate}
                onChange={onAdvancedModeChange}
                disabled={isLoading || isSubmitting}
              />
            )}
            <Group gap="sm">
              <Button
                variant="default"
                onClick={onClose}
                disabled={isLoading || isSubmitting}
              >
                {postCreate
                  ? t('shared:labels.close')
                  : t('shared:fields.cancel')}
              </Button>
              <SubmitButton
                loading={isLoading || isSubmitting}
                disabled={!formData.test_name?.trim()}
              >
                {postCreate
                  ? t('common:buttons.save')
                  : `${editingItem ? t('common:buttons.update') : t('common:buttons.create')} ${t('shared:categories.lab_results')}`}
              </SubmitButton>
            </Group>
          </Group>
        </Stack>
      </form>

      {children}
    </Modal>
  );
};

export default LabResultFormWrapper;
