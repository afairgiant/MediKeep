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

const ReportBuilder = () => {
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
    logger.info('REPORT BUILDER: useEffect called, about to fetch data');
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

  // Category display names mapping
  const categoryDisplayNames = {
    'medications': 'Medications',
    'conditions': 'Conditions',
    'procedures': 'Procedures',
    'lab_results': 'Lab Results',
    'immunizations': 'Immunizations',
    'allergies': 'Allergies',
    'treatments': 'Treatments',
    'encounters': 'Visits',
    'vitals': 'Vitals',
    'practitioners': 'Practitioners',
    'pharmacies': 'Pharmacies',
    'emergency_contacts': 'Emergency Contacts',
    'family_history': 'Family History',
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
        title: 'Template Loaded',
        message: `Template "${template.name}" has been loaded.`,
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
            <Text>Loading report builder...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title="Custom Report Builder" icon="📊" />

      <Stack gap="lg">
        {/* Error alerts */}
        {(error || templatesError) && (
          <Alert
            variant="light"
            color="red"
            title="Error"
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
              <Title order={3}>Report Configuration</Title>
              <Text c="dimmed" size="sm">
                Select medical records to include in your custom report
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
                Settings
              </Button>

              {hasSelections && (
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleGenerateReport}
                  loading={isGenerating}
                  disabled={!hasSelections}
                >
                  Generate Report ({selectedCount} records)
                </Button>
              )}
            </Group>
          </Group>

          {/* Progress indicator */}
          {hasSelections && (
            <Box mb="md">
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>Records Selected</Text>
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
              Select All Records
            </Button>
            {hasSelections && (
              <Button size="xs" variant="subtle" color="red" onClick={clearSelections}>
                Clear All Selections
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
                  <Title order={3}>No Medical Data Available</Title>
                  <Text c="dimmed" ta="center">
                    Add some medical records first to use the report builder.
                  </Text>
                </Stack>
                <Button onClick={() => navigate('/medications')}>
                  Add Medical Records
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
        title="Report Settings"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Report Title"
            value={reportSettings.report_title}
            onChange={(event) => updateReportSettings({ report_title: event.target.value })}
          />
          
          <Stack gap="sm">
            <Switch
              label="Include Patient Information"
              description="Add demographic and contact information"
              checked={reportSettings.include_patient_info}
              onChange={(event) => updateReportSettings({ include_patient_info: event.currentTarget.checked })}
            />
            
            <Switch
              label="Include Summary Statistics"
              description="Add overview and statistics section"
              checked={reportSettings.include_summary}
              onChange={(event) => updateReportSettings({ include_summary: event.currentTarget.checked })}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeSettingsModal}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default ReportBuilder;