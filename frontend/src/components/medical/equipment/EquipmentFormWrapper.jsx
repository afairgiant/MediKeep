import React from 'react';
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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
import { TagInput } from '../../common/TagInput';
import {
  EQUIPMENT_TYPE_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
} from '../../../constants/equipmentConstants';

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
}) => {
  const { t } = useTranslation('common');

  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(e);
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <FormLoadingOverlay
        visible={isLoading}
        message={t('equipment.form.saving', 'Saving equipment...')}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Grid>
            {/* Basic Info */}
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

            {/* Status and Practitioner */}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label={t('equipment.form.status', 'Status')}
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
                placeholder={t('equipment.form.practitionerPlaceholder', 'Select practitioner')}
                searchable
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                disabled={practitionersLoading}
              />
            </Grid.Col>

            {/* Manufacturer Details */}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={t('equipment.form.manufacturer', 'Manufacturer')}
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

            {/* Dates */}
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <DateInput
                label={t('equipment.form.prescribedDate', 'Prescribed Date')}
                value={parseDateInput(formData.prescribed_date)}
                onChange={(date) => {
                  const formattedDate = formatDateInputChange(date);
                  onInputChange({ target: { name: 'prescribed_date', value: formattedDate } });
                }}
                placeholder={t('equipment.form.datePlaceholder', 'Select date')}
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
                placeholder={t('equipment.form.datePlaceholder', 'Select date')}
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
                placeholder={t('equipment.form.datePlaceholder', 'Select date')}
                clearable
                minDate={parseDateInput(formData.last_service_date) || undefined}
                popoverProps={{ withinPortal: true, zIndex: 3000 }}
              />
            </Grid.Col>

            {/* Usage Instructions */}
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

            {/* Notes */}
            <Grid.Col span={12}>
              <Textarea
                label={t('equipment.form.notes', 'Notes')}
                value={formData.notes || ''}
                onChange={handleTextInputChange('notes')}
                placeholder={t('equipment.form.notesPlaceholder', 'Additional notes about this equipment')}
                rows={3}
                autosize
                minRows={2}
              />
            </Grid.Col>

            {/* Tags */}
            <Grid.Col span={12}>
              <TagInput
                value={formData.tags || []}
                onChange={(tags) => {
                  onInputChange({ target: { name: 'tags', value: tags } });
                }}
                label={t('equipment.form.tags', 'Tags')}
                placeholder={t('equipment.form.tagsPlaceholder', 'Add tags...')}
              />
            </Grid.Col>
          </Grid>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading}>
              {t('buttons.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading}
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
};

export default EquipmentFormWrapper;
