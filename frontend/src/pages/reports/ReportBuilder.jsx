import { useState, useEffect, useMemo } from 'react';
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
    generateReport,
    clearError,
    addVitalChart,
    removeVitalChart,
    updateVitalChartDates,
    addLabTestChart,
    removeLabTestChart,
    updateLabTestChartDates,
  } = useCustomReports();

  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    fetchTemplates,
    loadTemplateForReport,
    clearError: clearTemplatesError,
  } = useReportTemplates();

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

  // Handle URL parameter for template loading
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const templateId = searchParams.get('template');

    if (templateId && templates.length > 0) {
      const template = templates.find(t => t.id.toString() === templateId);
      if (template) {
        loadTemplateForReport(parseInt(templateId, 10));
      }
    }
  }, [location.search, templates, loadTemplateForReport]);

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

  if (loading || templatesLoading) {
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
                onClick={clearSelections}
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
