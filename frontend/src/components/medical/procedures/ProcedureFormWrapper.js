import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Textarea,
  Select,
  Text,
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconStethoscope,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';

const ProcedureFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem = null,
  practitioners = [],
  isLoading = false,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  // Get today's date for date picker constraints
  const today = getTodayEndOfDay();

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleDocumentManagerRef = (methods) => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in procedures ${editingItem ? 'edit' : 'create'}`,
      procedureId: editingItem?.id,
      error: error,
      component: 'ProcedureFormWrapper',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('procedures_upload_completed', {
      message: 'File upload completed in procedures form',
      procedureId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'ProcedureFormWrapper',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('procedure_form_submit_error', {
        message: 'Error submitting procedure form',
        procedureId: editingItem?.id,
        error: error.message,
        component: 'ProcedureFormWrapper',
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={statusMessage || "Saving procedure..."} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                Clinical Details
              </Tabs.Tab>
              {editingItem && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  Documents
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                Notes
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Procedure Name"
                      value={formData.procedure_name || ''}
                      onChange={handleTextInputChange('procedure_name')}
                      placeholder="Enter procedure name"
                      required
                      description="Name of the procedure"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Procedure Type"
                      value={formData.procedure_type || ''}
                      onChange={handleTextInputChange('procedure_type')}
                      placeholder="e.g., Surgical, Diagnostic"
                      description="Type or category of procedure"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Procedure Code"
                      value={formData.procedure_code || ''}
                      onChange={handleTextInputChange('procedure_code')}
                      placeholder="e.g., CPT code"
                      description="Medical billing code"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Procedure Date"
                      value={parseDateInput(formData.date)}
                      onChange={(value) => {
                        const dateString = value ? value.toISOString().split('T')[0] : '';
                        onInputChange({ target: { name: 'date', value: dateString } });
                      }}
                      placeholder="Select procedure date"
                      description="When the procedure was performed"
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Status"
                      value={formData.status || null}
                      data={[
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'in-progress', label: 'In Progress' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'postponed', label: 'Postponed' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder="Select status"
                      description="Current procedure status"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Practitioner"
                      value={formData.practitioner_id || null}
                      data={practitioners.map(prac => ({
                        value: prac.id.toString(),
                        label: `${prac.name}${prac.specialty ? ` - ${prac.specialty}` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder="Select practitioner"
                      description="Healthcare provider performing procedure"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Setting"
                      value={formData.procedure_setting || ''}
                      onChange={handleTextInputChange('procedure_setting')}
                      placeholder="e.g., Inpatient, Outpatient"
                      description="Where the procedure was performed"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Facility"
                      value={formData.facility || ''}
                      onChange={handleTextInputChange('facility')}
                      placeholder="e.g., Hospital name"
                      description="Medical facility"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label="Duration (minutes)"
                      value={formData.procedure_duration || ''}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'procedure_duration', value: value || '' } });
                      }}
                      placeholder="Enter duration"
                      description="How long the procedure took"
                      min={0}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Description"
                      value={formData.description || ''}
                      onChange={handleTextInputChange('description')}
                      placeholder="Describe the procedure"
                      description="Brief description of the procedure"
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Tags
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add tags to categorize and organize procedures
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder="Add tags..."
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Clinical Details Tab */}
            <Tabs.Panel value="clinical">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Anesthesia Type"
                      value={formData.anesthesia_type || ''}
                      onChange={handleTextInputChange('anesthesia_type')}
                      placeholder="e.g., General, Local, Regional"
                      description="Type of anesthesia used"
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Anesthesia Notes"
                      value={formData.anesthesia_notes || ''}
                      onChange={handleTextInputChange('anesthesia_notes')}
                      placeholder="Enter anesthesia details and notes"
                      description="Additional anesthesia information"
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Complications"
                      value={formData.procedure_complications || ''}
                      onChange={handleTextInputChange('procedure_complications')}
                      placeholder="Document any complications"
                      description="Any issues or complications that occurred"
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingItem && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="procedure"
                    entityId={editingItem.id}
                    mode="edit"
                    config={{
                      acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                      maxSize: 10 * 1024 * 1024, // 10MB
                      maxFiles: 10
                    }}
                    onUploadPendingFiles={handleDocumentManagerRef}
                    showProgressModal={true}
                    onUploadComplete={handleDocumentUploadComplete}
                    onError={handleDocumentError}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label="Clinical Notes"
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder="Enter clinical notes, observations, or additional details"
                  description="Additional information about this procedure"
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading || isSubmitting}>
              Cancel
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.procedure_name?.trim()}
            >
              {editingItem ? 'Update' : 'Create'} Procedure
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ProcedureFormWrapper;
