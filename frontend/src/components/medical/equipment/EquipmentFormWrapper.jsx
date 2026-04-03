import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Textarea,
  Select,
  Tabs,
  Box,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconInfoCircle, IconTool, IconCalendar, IconNotes } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
import { TagInput } from '../../common/TagInput';
import {
  EQUIPMENT_TYPE_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
} from '../../../constants/equipmentConstants';
import logger from '../../../services/logger';

const EquipmentFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingEquipment = null,
  formData,
  onInputChange,
  onSubmit,
  practitionersOptions = [],
  practitionersLoading = false,
  isLoading = false,
  statusMessage,
}) => {
  const { t } = useTranslation(['common', 'medical', 'shared']);
  const { dateInputFormat } = useDateFormat();

  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('equipment_form_wrapper_error', {
        message: 'Error in EquipmentFormWrapper',
        equipmentId: editingEquipment?.id,
        error: error.message,
        component: 'EquipmentFormWrapper',
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
      closeOnClickOutside={!isLoading && !isSubmitting}
      closeOnEscape={!isLoading && !isSubmitting}
    >
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={statusMessage?.title || t('equipment.form.saving', 'Saving equipment...')}
        submessage={statusMessage?.message}
        type={statusMessage?.type || 'loading'}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('shared:tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="device" leftSection={<IconTool size={16} />}>
                {t('medical:equipment.tabs.deviceDetails', 'Device Details')}
              </Tabs.Tab>
              <Tabs.Tab value="dates" leftSection={<IconCalendar size={16} />}>
                {t('medical:equipment.tabs.serviceDates', 'Service & Dates')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Tab 1 - Basic Info */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('equipment.form.name', 'Equipment Name')}
                      value={formData.equipment_name || ''}
                      onChange={handleTextInputChange('equipment_name')}
                      placeholder={t('equipment.form.namePlaceholder', 'e.g., ResMed AirSense 11')}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('equipment.form.type', 'Equipment Type')}
                      value={formData.equipment_type || null}
                      data={EQUIPMENT_TYPE_OPTIONS}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'equipment_type', value: value || '' } });
                      }}
                      placeholder={t('equipment.form.typePlaceholder', 'Select type')}
                      searchable
                      required
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.status', 'Status')}
                      value={formData.status || 'active'}
                      data={EQUIPMENT_STATUS_OPTIONS}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || 'active' } });
                      }}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('equipment.form.practitioner', 'Prescribed By')}
                      value={formData.practitioner_id || null}
                      data={practitionersOptions.map(prac => ({
                        value: prac.id.toString(),
                        label: `${prac.name}${prac.specialty ? ` - ${prac.specialty}` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder={t('shared:fields.selectPractitioner', 'Select practitioner')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={practitionersLoading}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Tab 2 - Device Details */}
            <Tabs.Panel value="device">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.manufacturer', 'Manufacturer')}
                      value={formData.manufacturer || ''}
                      onChange={handleTextInputChange('manufacturer')}
                      placeholder={t('equipment.form.manufacturerPlaceholder', 'e.g., ResMed, Philips')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('equipment.form.modelNumber', 'Model Number')}
                      value={formData.model_number || ''}
                      onChange={handleTextInputChange('model_number')}
                      placeholder={t('equipment.form.modelPlaceholder', 'e.g., AirSense 11')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('equipment.form.serialNumber', 'Serial Number')}
                      value={formData.serial_number || ''}
                      onChange={handleTextInputChange('serial_number')}
                      placeholder={t('equipment.form.serialPlaceholder', 'Equipment serial number')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('equipment.form.supplier', 'Supplier')}
                      value={formData.supplier || ''}
                      onChange={handleTextInputChange('supplier')}
                      placeholder={t('equipment.form.supplierPlaceholder', 'Equipment supplier')}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Tab 3 - Service & Dates */}
            <Tabs.Panel value="dates">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DateInput
                      label={t('equipment.form.prescribedDate', 'Prescribed Date')}
                      value={parseDateInput(formData.prescribed_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'prescribed_date', value: formattedDate } });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      clearable
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DateInput
                      label={t('equipment.form.lastService', 'Last Service Date')}
                      value={parseDateInput(formData.last_service_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'last_service_date', value: formattedDate } });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      clearable
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DateInput
                      label={t('equipment.form.nextService', 'Next Service Date')}
                      value={parseDateInput(formData.next_service_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'next_service_date', value: formattedDate } });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      clearable
                      minDate={parseDateInput(formData.last_service_date) || undefined}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('equipment.form.usageInstructions', 'Usage Instructions')}
                      value={formData.usage_instructions || ''}
                      onChange={handleTextInputChange('usage_instructions')}
                      placeholder={t('equipment.form.usagePlaceholder', 'How to use this equipment')}
                      rows={3}
                      autosize
                      minRows={2}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Tab 4 - Notes */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('shared:tabs.notes', 'Notes')}
                      value={formData.notes || ''}
                      onChange={handleTextInputChange('notes')}
                      placeholder={t('equipment.form.notesPlaceholder', 'Additional notes about this equipment')}
                      rows={3}
                      autosize
                      minRows={2}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TagInput
                      value={formData.tags || []}
                      onChange={(tags) => {
                        onInputChange({ target: { name: 'tags', value: tags } });
                      }}
                      label={t('shared:labels.tags', 'Tags')}
                      placeholder={t('shared:fields.addTags', 'Add tags...')}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={onClose}
              disabled={isLoading || isSubmitting}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.equipment_name?.trim() || !formData.equipment_type}
            >
              {editingEquipment
                ? t('equipment.form.update', 'Update Equipment')
                : t('equipment.form.create', 'Create Equipment')
              }
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

EquipmentFormWrapper.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  editingEquipment: PropTypes.shape({
    id: PropTypes.number,
    equipment_name: PropTypes.string,
    equipment_type: PropTypes.string,
    manufacturer: PropTypes.string,
    model_number: PropTypes.string,
    serial_number: PropTypes.string,
    prescribed_date: PropTypes.string,
    last_service_date: PropTypes.string,
    next_service_date: PropTypes.string,
    supplier: PropTypes.string,
    status: PropTypes.string,
    usage_instructions: PropTypes.string,
    notes: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    practitioner_id: PropTypes.number,
  }),
  formData: PropTypes.shape({
    equipment_name: PropTypes.string,
    equipment_type: PropTypes.string,
    manufacturer: PropTypes.string,
    model_number: PropTypes.string,
    serial_number: PropTypes.string,
    prescribed_date: PropTypes.string,
    last_service_date: PropTypes.string,
    next_service_date: PropTypes.string,
    supplier: PropTypes.string,
    status: PropTypes.string,
    usage_instructions: PropTypes.string,
    notes: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    practitioner_id: PropTypes.string,
  }).isRequired,
  onInputChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  practitionersOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      name: PropTypes.string,
      specialty: PropTypes.string,
    })
  ),
  practitionersLoading: PropTypes.bool,
  isLoading: PropTypes.bool,
  statusMessage: PropTypes.shape({
    title: PropTypes.string,
    message: PropTypes.string,
    type: PropTypes.string,
  }),
};

export default EquipmentFormWrapper;
