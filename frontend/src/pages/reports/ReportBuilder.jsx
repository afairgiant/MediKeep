import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Loader,
  Center,
  Button,
  Box,
  Progress,
  Modal,
  TextInput,
  Switch,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconDownload,
  IconSettings,
  IconFileDescription,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { PageHeader } from '../../components';
import { CategoryTabs, TemplateManager } from '../../components/reports';
import { useCustomReports } from '../../hooks/useCustomReports';
import { useReportTemplates } from '../../hooks/useReportTemplates';
import logger from '../../services/logger';
import { useTranslation } from 'react-i18next';

const ReportBuilder = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hooks for report functionality
  const {
    dataSummary,
    selectedRecords,
    reportSettings,
    loading,
    error,
    isGenerating,
    selectedCount,
    hasSelections,
    fetchDataSummary,
    toggleRecordSelection,
    toggleCategorySelection,
    clearSelections,
    updateReportSettings,
    generateReport,
    clearError,
  } = useCustomReports();

  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    isSaving,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    loadTemplateForReport,
    clearError: clearTemplatesError,
  } = useReportTemplates();

  // UI state
  const [activeTab, setActiveTab] = useState('medications');
  const [showSettingsModal, { open: openSettingsModal, close: closeSettingsModal }] = useDisclosure(false);

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
  const availableCategories = dataSummary?.categories ? Object.keys(dataSummary.categories) : [];
  
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
    'medications': t('reportBuilder.categories.medications'),
    'conditions': t('reportBuilder.categories.conditions'),
    'procedures': t('reportBuilder.categories.procedures'),
    'lab_results': t('reportBuilder.categories.lab_results'),
    'immunizations': t('reportBuilder.categories.immunizations'),
    'allergies': t('reportBuilder.categories.allergies'),
    'treatments': t('reportBuilder.categories.treatments'),
    'encounters': t('reportBuilder.categories.encounters'),
    'vitals': t('reportBuilder.categories.vitals'),
    'practitioners': t('reportBuilder.categories.practitioners'),
    'pharmacies': t('reportBuilder.categories.pharmacies'),
    'emergency_contacts': t('reportBuilder.categories.emergency_contacts'),
    'family_history': t('reportBuilder.categories.family_history'),
  };

  // Handle template save
  const handleSaveTemplate = async (templateFormData) => {
    // Convert selected records to API format
    const selectedRecordsArray = Object.entries(selectedRecords).map(([category, records]) => ({
      category,
      record_ids: Object.keys(records).map(id => parseInt(id, 10)),
    }));

    const templateData = {
      ...templateFormData,
      selected_records: selectedRecordsArray,
      report_settings: reportSettings,
    };

    return await saveTemplate(templateData);
  };

  // Handle template load
  const handleLoadTemplate = async (templateId) => {
    const template = await loadTemplateForReport(templateId);
    if (template) {
      // Clear current selections first
      clearSelections();
      
      // Load template selections (this would need to be implemented in the hook)
      notifications.show({
        title: t('reportBuilder.notifications.templateLoaded'),
        message: t('reportBuilder.notifications.templateLoadedMessage', { name: template.name }),
        color: 'blue',
        autoClose: 5000,
      });
    }
  };

  // Handle generate report
  const handleGenerateReport = async () => {
    const success = await generateReport();
    if (success) {
      // Optionally redirect or show additional UI
    }
  };

  if (loading || templatesLoading) {
    return (
      <Container size="xl" py="md">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>{t('reportBuilder.loading')}</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('reportBuilder.title')} icon={t('reportBuilder.icon')} />

      <Stack gap="lg">
        {/* Error alerts */}
        {(error || templatesError) && (
          <Alert
            variant="light"
            color="red"
            title={t('labels.error', 'Error')}
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
              <Title order={3}>{t('reportBuilder.configuration.title')}</Title>
              <Text c="dimmed" size="sm">
                {t('reportBuilder.configuration.description')}
              </Text>
            </Stack>
            
            <Group>
              {/* Template Manager - Hidden for now */}
              {/* <TemplateManager
                templates={templates}
                hasSelections={hasSelections}
                onSaveTemplate={handleSaveTemplate}
                onLoadTemplate={handleLoadTemplate}
                onDeleteTemplate={deleteTemplate}
                isSaving={isSaving}
              /> */}

              <Button
                leftSection={<IconSettings size={16} />}
                variant="outline"
                onClick={openSettingsModal}
              >
                {t('reportBuilder.buttons.settings')}
              </Button>

              {hasSelections && (
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleGenerateReport}
                  loading={isGenerating}
                  disabled={!hasSelections}
                >
                  {t('reportBuilder.buttons.generateReport', { count: selectedCount })}
                </Button>
              )}
            </Group>
          </Group>

          {/* Progress indicator */}
          {hasSelections && (
            <Box mb="md">
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>{t('reportBuilder.progress.recordsSelected')}</Text>
                <Text size="sm" c="dimmed">{selectedCount} / {dataSummary?.total_records || 0}</Text>
              </Group>
              <Progress 
                value={(selectedCount / (dataSummary?.total_records || 1)) * 100} 
                color="blue" 
                size="sm" 
              />
            </Box>
          )}

          {/* Selection controls */}
          <Group justify="space-between" mb="md">
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
              disabled={!dataSummary?.categories || Object.keys(dataSummary.categories).length === 0}
            >
              {t('reportBuilder.buttons.selectAll')}
            </Button>
            {hasSelections && (
              <Button size="xs" variant="subtle" color="red" onClick={clearSelections}>
                {t('reportBuilder.buttons.clearSelections')}
              </Button>
            )}
          </Group>
        </Paper>

        {/* Category tabs and record selection OR No data message */}
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
                <IconFileDescription size={64} stroke={1} color="var(--mantine-color-gray-5)" />
                <Stack align="center" gap="xs">
                  <Title order={3}>{t('reportBuilder.noData.title')}</Title>
                  <Text c="dimmed" ta="center">
                    {t('reportBuilder.noData.description')}
                  </Text>
                </Stack>
                <Button onClick={() => navigate('/medications')}>
                  {t('reportBuilder.buttons.addRecords')}
                </Button>
              </Stack>
            </Center>
          </Paper>
        )}
      </Stack>


      {/* Report Settings Modal */}
      <Modal
        opened={showSettingsModal}
        onClose={closeSettingsModal}
        title={t('reportBuilder.settingsModal.title')}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label={t('reportBuilder.settingsModal.reportTitle.label')}
            value={reportSettings.report_title}
            onChange={(event) => updateReportSettings({ report_title: event.target.value })}
          />

          <Stack gap="sm">
            <Switch
              label={t('reportBuilder.settingsModal.includePatientInfo.label')}
              description={t('reportBuilder.settingsModal.includePatientInfo.description')}
              checked={reportSettings.include_patient_info}
              onChange={(event) => updateReportSettings({ include_patient_info: event.currentTarget.checked })}
            />

            <Switch
              label={t('reportBuilder.settingsModal.includeProfilePicture.label')}
              description={t('reportBuilder.settingsModal.includeProfilePicture.description')}
              checked={reportSettings.include_profile_picture}
              onChange={(event) => updateReportSettings({ include_profile_picture: event.currentTarget.checked })}
            />

            <Switch
              label={t('reportBuilder.settingsModal.includeSummary.label')}
              description={t('reportBuilder.settingsModal.includeSummary.description')}
              checked={reportSettings.include_summary}
              onChange={(event) => updateReportSettings({ include_summary: event.currentTarget.checked })}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeSettingsModal}>
              {t('buttons.close')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default ReportBuilder;