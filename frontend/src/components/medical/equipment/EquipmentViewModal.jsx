import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Box,
  SimpleGrid,
  Title,
  Paper,
  Tabs,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconTool,
  IconCalendar,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../StatusBadge';
import { useDateFormat } from '../../../hooks/useDateFormat';
import {
  getEquipmentTypeLabel,
  getEquipmentStatusColor,
} from '../../../constants/equipmentConstants';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import ViewModalFooter from '../../shared/ViewModalFooter';
import NotesView from '../../shared/NotesView';
import logger from '../../../services/logger';
import { rememberEditTab } from '../../../utils/editTabHandoff';

const EquipmentViewModal = ({
  isOpen,
  onClose,
  equipment,
  onEdit,
  practitioners = [],
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'medical', 'shared']);
  const { formatDate } = useDateFormat();
  const [activeTab, setActiveTab] = useState('basic');

  // Start on the first tab each time the modal opens or shows other equipment
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
  }, [isOpen, equipment?.id]);

  if (!isOpen || !equipment) return null;

  const handleEdit = () => {
    // The Edit form opens on the tab that is open here
    rememberEditTab('equipment', activeTab);
    onEdit(equipment);
    onClose();
  };

  const getPractitionerName = practitionerId => {
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
      size="xl"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper
          withBorder
          p="md"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">
                {equipment.equipment_name}
              </Title>
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

        {/* Same tabs, in the same order, as the Edit form */}
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
            <Tabs.Tab
              value="documents"
              leftSection={<IconFileText size={16} />}
            >
              {t('shared:tabs.documents', 'Documents')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('shared:tabs.notes', 'Notes')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Basic Info Tab */}
          <Tabs.Panel value="basic">
            <Box mt="md">
              <Title order={4} mb="sm">
                {t('shared:labels.basicInformation', 'Basic Information')}
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('shared:labels.equipmentName', 'Equipment Name')}
                  </Text>
                  <Text size="sm">{equipment.equipment_name}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('equipment.viewModal.type', 'Equipment Type')}
                  </Text>
                  <Text
                    size="sm"
                    c={equipment.equipment_type ? 'inherit' : 'dimmed'}
                  >
                    {getEquipmentTypeLabel(equipment.equipment_type) ||
                      t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('shared:fields.status', 'Status')}
                  </Text>
                  <StatusBadge
                    status={equipment.status}
                    color={getEquipmentStatusColor(equipment.status)}
                  />
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('equipment.viewModal.prescribedBy', 'Prescribed By')}
                  </Text>
                  <Text
                    size="sm"
                    c={equipment.practitioner_id ? 'inherit' : 'dimmed'}
                  >
                    {equipment.practitioner_id
                      ? equipment.practitioner?.name ||
                        getPractitionerName(equipment.practitioner_id) ||
                        `Practitioner #${equipment.practitioner_id}`
                      : t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
              </SimpleGrid>
              {equipment.tags && equipment.tags.length > 0 && (
                <Box mt="lg">
                  <Title order={4} mb="sm">
                    {t('shared:labels.tags', 'Tags')}
                  </Title>
                  <Group gap="xs">
                    {equipment.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="light"
                        color="blue"
                        size="sm"
                        radius="md"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                </Box>
              )}
            </Box>
          </Tabs.Panel>

          {/* Device Details Tab */}
          <Tabs.Panel value="device">
            <Box mt="md">
              <Title order={4} mb="sm">
                {t(
                  'equipment.viewModal.manufacturerDetails',
                  'Manufacturer Details'
                )}
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('shared:fields.manufacturer', 'Manufacturer')}
                  </Text>
                  <Text
                    size="sm"
                    c={equipment.manufacturer ? 'inherit' : 'dimmed'}
                  >
                    {equipment.manufacturer ||
                      t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('equipment.viewModal.modelNumber', 'Model Number')}
                  </Text>
                  <Text
                    size="sm"
                    c={equipment.model_number ? 'inherit' : 'dimmed'}
                  >
                    {equipment.model_number ||
                      t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('shared:labels.serialNumber', 'Serial Number')}
                  </Text>
                  <Text
                    size="sm"
                    c={equipment.serial_number ? 'inherit' : 'dimmed'}
                  >
                    {equipment.serial_number ||
                      t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    {t('shared:labels.supplier', 'Supplier')}
                  </Text>
                  <Text size="sm" c={equipment.supplier ? 'inherit' : 'dimmed'}>
                    {equipment.supplier ||
                      t('shared:labels.notSpecified', 'Not specified')}
                  </Text>
                </Stack>
              </SimpleGrid>
            </Box>
          </Tabs.Panel>

          {/* Service & Dates Tab */}
          <Tabs.Panel value="dates">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">
                    {t('equipment.viewModal.dates', 'Important Dates')}
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t(
                          'equipment.viewModal.prescribedDate',
                          'Prescribed Date'
                        )}
                      </Text>
                      <Text
                        size="sm"
                        c={equipment.prescribed_date ? 'inherit' : 'dimmed'}
                      >
                        {equipment.prescribed_date
                          ? formatDate(equipment.prescribed_date)
                          : t('shared:labels.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('equipment.viewModal.lastService', 'Last Service')}
                      </Text>
                      <Text
                        size="sm"
                        c={equipment.last_service_date ? 'inherit' : 'dimmed'}
                      >
                        {equipment.last_service_date
                          ? formatDate(equipment.last_service_date)
                          : t('shared:labels.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('equipment.viewModal.nextService', 'Next Service')}
                      </Text>
                      <Text
                        size="sm"
                        c={equipment.next_service_date ? 'inherit' : 'dimmed'}
                      >
                        {equipment.next_service_date
                          ? formatDate(equipment.next_service_date)
                          : t('shared:labels.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {equipment.usage_instructions && (
                  <div>
                    <Title order={4} mb="sm">
                      {t(
                        'equipment.viewModal.usageInstructions',
                        'Usage Instructions'
                      )}
                    </Title>
                    <NotesView value={equipment.usage_instructions} />
                  </div>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <DocumentManagerWithProgress
                entityType="medical-equipment"
                entityId={equipment.id}
                onError={error => {
                  logger.error('equipment_view_document_error', {
                    message: 'Document manager error in equipment view',
                    equipmentId: equipment.id,
                    error,
                    component: 'EquipmentViewModal',
                  });
                }}
              />
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">
                    {t('shared:tabs.notes', 'Notes')}
                  </Title>
                  <NotesView
                    value={equipment.notes}
                    emptyText={t(
                      'shared:labels.noNotesAvailable',
                      'No notes available'
                    )}
                  />
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        <ViewModalFooter
          onClose={onClose}
          onEdit={handleEdit}
          disableEdit={disableEdit}
          disableEditTooltip={disableEditTooltip}
        />
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
  disableEdit: PropTypes.bool,
  disableEditTooltip: PropTypes.string,
  practitioners: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      name: PropTypes.string,
    })
  ),
};

export default EquipmentViewModal;
