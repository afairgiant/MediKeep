import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Center,
  Badge,
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Button,
  Box,
  Progress,
  Modal,
  TextInput,
  Switch,
  SegmentedControl,
} from '@mantine/core';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import {
  IconAlertTriangle,
  IconDownload,
  IconSettings,
  IconFileDescription,
  IconChartLine,
  IconNotes,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { PageHeader } from '../../components';
import { CategoryTabs } from '../../components/reports';
import TrendChartSelector from '../../components/reports/TrendChartSelector';
import TemplateManager from '../../components/reports/TemplateManager';
import { useCustomReports } from '../../hooks/useCustomReports';
import { useReportTemplates } from '../../hooks/useReportTemplates';
import logger from '../../services/logger';
import { useTranslation } from 'react-i18next';

const ReportBuilder = () => {
  const { t } = useTranslation(['reports', 'common', 'shared']);
  const navigate = useNavigate();
  const location = useLocation();

  // Hooks for report functionality
  const {
    dataSummary,
    selectedRecords,
    reportSettings,
    trendCharts,
    loading,
    error,
    isGenerating,
    selectedCount,
    hasSelections,
    trendChartCount,
    fetchDataSummary,
    toggleRecordSelection,
    toggleCategorySelection,
    clearSelections,
    updateReportSettings,
    applyTemplate,
    generateReport,
    clearError,
    addVitalChart,
    removeVitalChart,
    updateVitalChartDates,
    addLabTestChart,
    removeLabTestChart,
    updateLabTestChartDates,
    getSelectedRecordsForAPI,
  } = useCustomReports();

  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    isSaving: isSavingTemplate,
    fetchTemplates,
    loadTemplateForReport,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    clearError: clearTemplatesError,
  } = useReportTemplates();

  // Track which template (if any) is currently loaded into the builder,
  // so the user can choose between "Update this one" and "Save as new".
  const [loadedTemplate, setLoadedTemplate] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('medications');
  const [activeSegment, setActiveSegment] = useState('records');
  const [
    showSettingsModal,
    { open: openSettingsModal, close: closeSettingsModal },
  ] = useDisclosure(false);

  // Initialize data on mount
  useEffect(() => {
    fetchDataSummary();
    fetchTemplates();
  }, [fetchDataSummary, fetchTemplates]);

  // Load a template into the builder: fetch, apply to state, remember it so
  // the user can choose to update it or save-as-new later.
  const handleLoadTemplate = useCallback(
    async templateId => {
      const template = await loadTemplateForReport(templateId);
      if (template) {
        applyTemplate(template, dataSummary);
        setLoadedTemplate(template);
      }
    },
    [applyTemplate, dataSummary, loadTemplateForReport]
  );

  // If arriving with ?template=<id>, apply that template once both the data
  // summary and the template list have loaded.
  const [urlTemplateApplied, setUrlTemplateApplied] = useState(false);
  useEffect(() => {
    if (urlTemplateApplied || !dataSummary) return;
    const searchParams = new URLSearchParams(location.search);
    const templateId = searchParams.get('template');
    if (!templateId) return;

    const parsedId = parseInt(templateId, 10);
    if (Number.isFinite(parsedId)) {
      handleLoadTemplate(parsedId);
      setUrlTemplateApplied(true);
    }
  }, [location.search, dataSummary, handleLoadTemplate, urlTemplateApplied]);

  // Get available categories from data summary
  const availableCategories = useMemo(
    () =>
      dataSummary?.categories ? Object.keys(dataSummary.categories) : [],
    [dataSummary?.categories]
  );

  // Debug logging for development
  useEffect(() => {
    if (dataSummary) {
      logger.debug('report_builder_data_summary', 'Data summary loaded', {
        totalRecords: dataSummary.total_records,
        categoriesCount: availableCategories.length,
        component: 'ReportBuilder',
      });
    }
  }, [dataSummary, availableCategories]);

  // Category display names mapping
  const categoryDisplayNames = {
    medications: t('shared:categories.medications'),
    conditions: t('shared:categories.conditions'),
    procedures: t('shared:categories.procedures'),
    lab_results: t('shared:categories.lab_results'),
    immunizations: t('shared:categories.immunizations'),
    allergies: t('shared:categories.allergies'),
    treatments: t('shared:categories.treatments'),
    encounters: t('shared:tabs.visits'),
    vitals: t('shared:categories.vitals'),
    practitioners: t('shared:categories.practitioners'),
    pharmacies: t('shared:categories.pharmacies'),
    emergency_contacts: t('shared:categories.emergency_contacts'),
    family_history: t('shared:categories.family_history'),
    symptoms: t('shared:categories.symptoms'),
    injuries: t('shared:categories.injuries'),
    insurance: t('shared:categories.insurance'),
  };

  // Snapshot the builder's current state into a payload the templates API
  // accepts. Used by both "Save as new" and "Update current".
  const buildTemplatePayload = useCallback(
    metadata => ({
      name: metadata.name?.trim() || '',
      description: metadata.description?.trim() || null,
      is_public: !!metadata.is_public,
      shared_with_family: !!metadata.shared_with_family,
      selected_records: getSelectedRecordsForAPI(),
      trend_charts:
        trendChartCount > 0
          ? {
              vital_charts: trendCharts.vital_charts,
              lab_test_charts: trendCharts.lab_test_charts,
            }
          : null,
      report_settings: {
        report_title: reportSettings.report_title,
        include_patient_info: reportSettings.include_patient_info,
        include_profile_picture: reportSettings.include_profile_picture,
        include_summary: reportSettings.include_summary,
        date_range: reportSettings.date_range,
      },
    }),
    [
      getSelectedRecordsForAPI,
      trendChartCount,
      trendCharts.vital_charts,
      trendCharts.lab_test_charts,
      reportSettings.report_title,
      reportSettings.include_patient_info,
      reportSettings.include_profile_picture,
      reportSettings.include_summary,
      reportSettings.date_range,
    ]
  );

  // "Save as new" — fresh template from the save modal.
  const handleSaveTemplate = useCallback(
    async metadata => {
      const payload = buildTemplatePayload(metadata);
      const result = await saveTemplate(payload);
      if (result?.success && result.template_id) {
        // Adopt the new template as the "currently loaded" one, so subsequent
        // edits update it rather than creating another new template.
        setLoadedTemplate({
          ...payload,
          id: result.template_id,
        });
        return true;
      }
      return false;
    },
    [buildTemplatePayload, saveTemplate]
  );

  // "Update current" — overwrite the loaded template with current builder
  // state, preserving existing metadata (name, description, sharing flags).
  const handleUpdateCurrent = useCallback(async () => {
    if (!loadedTemplate) return false;
    const payload = buildTemplatePayload({
      name: loadedTemplate.name,
      description: loadedTemplate.description,
      is_public: loadedTemplate.is_public,
      shared_with_family: loadedTemplate.shared_with_family,
    });
    const result = await updateTemplate(loadedTemplate.id, payload);
    if (result?.success) {
      setLoadedTemplate(prev => (prev ? { ...prev, ...payload } : prev));
      return true;
    }
    return false;
  }, [buildTemplatePayload, loadedTemplate, updateTemplate]);

  // Metadata-only edit from the pencil-icon modal. Preserves the template's
  // existing selections/trend_charts/settings (they're passed through in the
  // payload the modal hands us).
  const handleUpdateTemplateMetadata = useCallback(
    async (templateId, payload) => {
      const result = await updateTemplate(templateId, payload);
      if (
        result?.success &&
        loadedTemplate &&
        loadedTemplate.id === templateId
      ) {
        // Keep the in-memory loaded template in sync so the menu label
        // reflects the new name immediately.
        setLoadedTemplate(prev => (prev ? { ...prev, ...payload } : prev));
      }
      return !!result?.success;
    },
    [updateTemplate, loadedTemplate]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId, templateName) => {
      const result = await deleteTemplate(templateId, templateName);
      if (result?.success && loadedTemplate?.id === templateId) {
        setLoadedTemplate(null);
      }
      return !!result?.success;
    },
    [deleteTemplate, loadedTemplate]
  );

  // When the user clears selections, also forget the loaded template — they
  // are explicitly starting from scratch, so "Update current" shouldn't
  // target a template whose selections are no longer represented.
  const handleClearSelections = useCallback(() => {
    clearSelections();
    setLoadedTemplate(null);
  }, [clearSelections]);

  // Build generate button label
  const getGenerateButtonLabel = () => {
    if (selectedCount > 0 && trendChartCount > 0) {
      return t('builder.buttons.generateReportWithCharts', {
        recordCount: selectedCount,
        chartCount: trendChartCount,
      });
    }
    if (trendChartCount > 0) {
      return t('builder.buttons.generateReportChartsOnly', {
        chartCount: trendChartCount,
      });
    }
    return t('builder.buttons.generateReport', { count: selectedCount });
  };

  // Only block the whole page on the initial data load. Once dataSummary is
  // present, subsequent background loads (template fetch/delete) shouldn't
  // blank the UI.
  if (!dataSummary && (loading || templatesLoading)) {
    return (
      <MedicalPageLoading
        message={t('builder.loading', 'Loading reports...')}
      />
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('builder.title')} icon={t('builder.icon')} />

      <Stack gap="lg">
        {/* Error alerts */}
        {(error || templatesError) && (
          <Alert
            variant="light"
            color="red"
            title={t('shared:labels.error', 'Error')}
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => {
              clearError();
              clearTemplatesError();
            }}
          >
            {error || templatesError}
          </Alert>
        )}

        {/* Report controls */}
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Stack gap={4}>
              <Title order={3}>{t('builder.configuration.title')}</Title>
              <Text c="dimmed" size="sm">
                {t('builder.configuration.description')}
              </Text>
            </Stack>

            <Group>
              <TemplateManager
                templates={templates}
                hasSelections={hasSelections}
                loadedTemplateId={loadedTemplate?.id ?? null}
                loadedTemplateName={loadedTemplate?.name ?? ''}
                isSaving={isSavingTemplate}
                onSaveTemplate={handleSaveTemplate}
                onLoadTemplate={handleLoadTemplate}
                onUpdateTemplate={handleUpdateTemplateMetadata}
                onUpdateCurrent={handleUpdateCurrent}
                onDeleteTemplate={handleDeleteTemplate}
              />

              <Button
                leftSection={<IconSettings size={16} />}
                variant="outline"
                onClick={openSettingsModal}
              >
                {t('shared:labels.settings')}
              </Button>

              {hasSelections && (
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={generateReport}
                  loading={isGenerating}
                  disabled={!hasSelections}
                >
                  {getGenerateButtonLabel()}
                </Button>
              )}
            </Group>
          </Group>

          {/* Progress indicator */}
          {hasSelections && (
            <Box mb="md">
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {t('builder.progress.recordsSelected')}
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedCount} {t('shared:labels.medicalRecords', 'records')}
                  {trendChartCount > 0 &&
                    `, ${trendChartCount} ${t('shared:labels.trendCharts', 'charts').toLowerCase()}`}
                </Text>
              </Group>
              <Progress
                value={
                  (selectedCount /
                    Math.max(dataSummary?.total_records || 1, 1)) *
                  100
                }
                color="blue"
                size="sm"
              />
            </Box>
          )}

          {/* Selection controls */}
          <Group justify="space-between" mb="md">
            {activeSegment === 'records' && (
              <Button
                size="xs"
                variant="subtle"
                color="blue"
                onClick={() => {
                  // Select all records from all categories
                  availableCategories.forEach(category => {
                    const categoryData = dataSummary?.categories?.[category];
                    if (categoryData?.records) {
                      toggleCategorySelection(category, categoryData.records);
                    }
                  });
                }}
                disabled={
                  !dataSummary?.categories ||
                  Object.keys(dataSummary.categories).length === 0
                }
              >
                {t('builder.buttons.selectAll')}
              </Button>
            )}
            {hasSelections && (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={handleClearSelections}
              >
                {t('builder.buttons.clearSelections')}
              </Button>
            )}
          </Group>
        </Paper>

        {/* Segment control for switching between Records and Trend Charts */}
        <SegmentedControl
          value={activeSegment}
          onChange={setActiveSegment}
          data={[
            {
              value: 'records',
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconNotes size={16} />
                  <span>{t('shared:labels.medicalRecords')}</span>
                  {selectedCount > 0 && (
                    <Badge size="xs" variant="filled" color="blue">
                      {selectedCount}
                    </Badge>
                  )}
                </Group>
              ),
            },
            {
              value: 'trendCharts',
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconChartLine size={16} />
                  <span>{t('shared:labels.trendCharts')}</span>
                  {trendChartCount > 0 && (
                    <Badge size="xs" variant="filled" color="teal">
                      {trendChartCount}
                    </Badge>
                  )}
                </Group>
              ),
            },
          ]}
          fullWidth
          size="md"
        />

        {/* Medical Records segment */}
        {activeSegment === 'records' && (
          <>
            {availableCategories.length > 0 ? (
              <Paper shadow="sm" radius="md" withBorder>
                <CategoryTabs
                  categories={availableCategories}
                  dataSummary={dataSummary}
                  selectedRecords={selectedRecords}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onToggleRecord={toggleRecordSelection}
                  onToggleCategory={toggleCategorySelection}
                  categoryDisplayNames={categoryDisplayNames}
                />
              </Paper>
            ) : (
              <Paper shadow="sm" p="xl" radius="md">
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <IconFileDescription
                      size={64}
                      stroke={1}
                      color="var(--mantine-color-gray-5)"
                    />
                    <Stack align="center" gap="xs">
                      <Title order={3}>{t('builder.noData.title')}</Title>
                      <Text c="dimmed" ta="center">
                        {t('builder.noData.description')}
                      </Text>
                    </Stack>
                    <Button onClick={() => navigate('/medications')}>
                      {t('builder.buttons.addRecords')}
                    </Button>
                  </Stack>
                </Center>
              </Paper>
            )}
          </>
        )}

        {/* Trend Charts segment */}
        {activeSegment === 'trendCharts' && (
          <Paper shadow="sm" radius="md" withBorder>
            <TrendChartSelector
              trendCharts={trendCharts}
              addVitalChart={addVitalChart}
              removeVitalChart={removeVitalChart}
              updateVitalChartDates={updateVitalChartDates}
              addLabTestChart={addLabTestChart}
              removeLabTestChart={removeLabTestChart}
              updateLabTestChartDates={updateLabTestChartDates}
              trendChartCount={trendChartCount}
            />
          </Paper>
        )}
      </Stack>

      {/* Report Settings Modal */}
      <Modal
        opened={showSettingsModal}
        onClose={closeSettingsModal}
        title={t('builder.settingsModal.title')}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label={t('builder.settingsModal.reportTitle.label')}
            value={reportSettings.report_title}
            onChange={event =>
              updateReportSettings({ report_title: event.target.value })
            }
          />

          <Stack gap="sm">
            <Switch
              label={t('builder.settingsModal.includePatientInfo.label')}
              description={t(
                'builder.settingsModal.includePatientInfo.description'
              )}
              checked={reportSettings.include_patient_info}
              onChange={event =>
                updateReportSettings({
                  include_patient_info: event.currentTarget.checked,
                })
              }
            />

            <Switch
              label={t('builder.settingsModal.includeProfilePicture.label')}
              description={t(
                'builder.settingsModal.includeProfilePicture.description'
              )}
              checked={reportSettings.include_profile_picture}
              onChange={event =>
                updateReportSettings({
                  include_profile_picture: event.currentTarget.checked,
                })
              }
            />

            <Switch
              label={t('builder.settingsModal.includeSummary.label')}
              description={t(
                'builder.settingsModal.includeSummary.description'
              )}
              checked={reportSettings.include_summary}
              onChange={event =>
                updateReportSettings({
                  include_summary: event.currentTarget.checked,
                })
              }
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeSettingsModal}>
              {t('shared:labels.close')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default ReportBuilder;
