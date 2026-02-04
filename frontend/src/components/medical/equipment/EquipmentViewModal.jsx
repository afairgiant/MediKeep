import React from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Box,
  SimpleGrid,
  Title,
  Paper,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../StatusBadge';
import { useDateFormat } from '../../../hooks/useDateFormat';
import {
  getEquipmentTypeLabel,
  getEquipmentStatusColor,
} from '../../../constants/equipmentConstants';

const EquipmentViewModal = ({
  isOpen,
  onClose,
  equipment,
  onEdit,
  practitioners = [],
}) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();

  if (!isOpen || !equipment) return null;

  const handleEdit = () => {
    onEdit(equipment);
    onClose();
  };

  const getPractitionerName = (practitionerId) => {
    if (!practitionerId || !practitioners || practitioners.length === 0) {
      return null;
    }
    const practitioner = practitioners.find(p => p.id === practitionerId);
    return practitioner ? practitioner.name : null;
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('equipment.viewModal.title', 'Equipment Details')}
      size="lg"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{equipment.equipment_name}</Title>
              <Group gap="xs">
                {equipment.equipment_type && (
                  <Badge variant="light" color="blue" size="sm">
                    {getEquipmentTypeLabel(equipment.equipment_type)}
                  </Badge>
                )}
                <StatusBadge
                  status={equipment.status}
                  color={getEquipmentStatusColor(equipment.status)}
                />
              </Group>
            </div>
            {equipment.prescribed_date && (
              <Badge variant="light" color="gray" size="lg">
                {formatDate(equipment.prescribed_date)}
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Equipment Details */}
        <Box>
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Title order={4} mb="sm">{t('equipment.viewModal.basicInfo', 'Basic Information')}</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.name', 'Equipment Name')}</Text>
                  <Text size="sm">{equipment.equipment_name}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.type', 'Equipment Type')}</Text>
                  <Text size="sm" c={equipment.equipment_type ? 'inherit' : 'dimmed'}>
                    {getEquipmentTypeLabel(equipment.equipment_type) || t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.status', 'Status')}</Text>
                  <StatusBadge status={equipment.status} color={getEquipmentStatusColor(equipment.status)} />
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.prescribedBy', 'Prescribed By')}</Text>
                  <Text size="sm" c={equipment.practitioner_id ? 'inherit' : 'dimmed'}>
                    {equipment.practitioner_id
                      ? (equipment.practitioner?.name || getPractitionerName(equipment.practitioner_id) || `Practitioner #${equipment.practitioner_id}`)
                      : t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
              </SimpleGrid>
            </div>

            {/* Manufacturer Details */}
            <div>
              <Title order={4} mb="sm">{t('equipment.viewModal.manufacturerDetails', 'Manufacturer Details')}</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.manufacturer', 'Manufacturer')}</Text>
                  <Text size="sm" c={equipment.manufacturer ? 'inherit' : 'dimmed'}>
                    {equipment.manufacturer || t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.modelNumber', 'Model Number')}</Text>
                  <Text size="sm" c={equipment.model_number ? 'inherit' : 'dimmed'}>
                    {equipment.model_number || t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.serialNumber', 'Serial Number')}</Text>
                  <Text size="sm" c={equipment.serial_number ? 'inherit' : 'dimmed'}>
                    {equipment.serial_number || t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.supplier', 'Supplier')}</Text>
                  <Text size="sm" c={equipment.supplier ? 'inherit' : 'dimmed'}>
                    {equipment.supplier || t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
              </SimpleGrid>
            </div>

            {/* Dates */}
            <div>
              <Title order={4} mb="sm">{t('equipment.viewModal.dates', 'Important Dates')}</Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.prescribedDate', 'Prescribed Date')}</Text>
                  <Text size="sm" c={equipment.prescribed_date ? 'inherit' : 'dimmed'}>
                    {equipment.prescribed_date ? formatDate(equipment.prescribed_date) : t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.lastService', 'Last Service')}</Text>
                  <Text size="sm" c={equipment.last_service_date ? 'inherit' : 'dimmed'}>
                    {equipment.last_service_date ? formatDate(equipment.last_service_date) : t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">{t('equipment.viewModal.nextService', 'Next Service')}</Text>
                  <Text size="sm" c={equipment.next_service_date ? 'inherit' : 'dimmed'}>
                    {equipment.next_service_date ? formatDate(equipment.next_service_date) : t('labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
              </SimpleGrid>
            </div>

            {/* Usage Instructions */}
            {equipment.usage_instructions && (
              <div>
                <Title order={4} mb="sm">{t('equipment.viewModal.usageInstructions', 'Usage Instructions')}</Title>
                <Text size="sm">{equipment.usage_instructions}</Text>
              </div>
            )}

            {/* Notes */}
            {equipment.notes && (
              <div>
                <Title order={4} mb="sm">{t('equipment.viewModal.notes', 'Notes')}</Title>
                <Text size="sm">{equipment.notes}</Text>
              </div>
            )}

            {/* Tags */}
            {equipment.tags && equipment.tags.length > 0 && (
              <div>
                <Title order={4} mb="sm">{t('equipment.viewModal.tags', 'Tags')}</Title>
                <Group gap="xs">
                  {equipment.tags.map((tag, index) => (
                    <Badge key={index} variant="light" color="blue" size="sm" radius="md">
                      {tag}
                    </Badge>
                  ))}
                </Group>
              </div>
            )}
          </Stack>
        </Box>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('buttons.close', 'Close')}
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            {t('buttons.edit', 'Edit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

EquipmentViewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  equipment: PropTypes.shape({
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
    practitioner: PropTypes.shape({
      id: PropTypes.number,
      name: PropTypes.string,
    }),
  }),
  onEdit: PropTypes.func.isRequired,
  practitioners: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      name: PropTypes.string,
    })
  ),
};

export default EquipmentViewModal;
