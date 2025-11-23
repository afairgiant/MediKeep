import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Divider,
  Grid,
  Paper,
  ActionIcon,
  Title,
  Card,
  Box,
} from '@mantine/core';
import { 
  IconEdit, 
  IconCalendar,
  IconHeart,
  IconActivity,
  IconThermometer,
  IconWeight,
  IconLungs,
  IconDroplet,
  IconNotes,
  IconMapPin,
  IconDevices,
  IconMoodSad,
  IconTrendingUp,
  IconUser,
} from '@tabler/icons-react';
import { formatDate, formatDateTime } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import StatusBadge from '../StatusBadge';
import logger from '../../../services/logger';

// BMI conversion factor for imperial units (pounds and inches)
const BMI_IMPERIAL_CONVERSION_FACTOR = 703;

const VitalViewModal = ({
  isOpen,
  onClose,
  vital,
  onEdit,
  practitioners = [],
  navigate,
}) => {
  const { t } = useTranslation('common');

  if (!isOpen || !vital) return null;

  const handleEdit = () => {
    onEdit(vital);
    onClose();
  };

  const practitioner = practitioners.find(p => p.id === vital.practitioner_id);

  // Helper functions from VitalsList
  const getBPDisplay = (systolic, diastolic) => {
    if (!systolic || !diastolic) return t('labels.notAvailable', 'N/A');
    return `${systolic}/${diastolic}`;
  };

  const getBMIDisplay = (weight, height) => {
    if (!weight || !height) return t('labels.notAvailable', 'N/A');
    // BMI calculation using imperial units: weight(lbs) / (height(inches))^2 * 703
    const bmi = (weight / (height * height)) * BMI_IMPERIAL_CONVERSION_FACTOR;
    return bmi ? bmi.toFixed(1) : t('labels.notAvailable', 'N/A');
  };

  // Vital sections configuration from VitalsList
  const vitalSections = [
    {
      title: t('vitals.modal.basicInfo', 'Basic Information'),
      icon: IconCalendar,
      items: [
        {
          label: t('vitals.modal.recordedDate', 'Recorded Date'),
          value: formatDateTime(vital.recorded_date),
          icon: IconCalendar,
        },
        {
          label: t('vitals.card.location', 'Location'),
          value: vital.location || t('labels.notSpecified', 'Not specified'),
          icon: IconMapPin,
        },
        {
          label: t('vitals.modal.deviceUsed', 'Device Used'),
          value: vital.device_used || t('labels.notSpecified', 'Not specified'),
          icon: IconDevices,
        },
      ],
    },
    {
      title: t('vitals.modal.vitalSigns', 'Vital Signs'),
      icon: IconHeart,
      items: [
        {
          label: t('vitals.stats.bloodPressure', 'Blood Pressure'),
          value: getBPDisplay(vital.systolic_bp, vital.diastolic_bp),
          icon: IconHeart,
          unit: t('vitals.units.mmHg', 'mmHg'),
        },
        {
          label: t('vitals.stats.heartRate', 'Heart Rate'),
          value: vital.heart_rate || t('labels.notAvailable', 'N/A'),
          icon: IconActivity,
          unit: vital.heart_rate ? t('vitals.units.bpm', 'BPM') : '',
        },
        {
          label: t('vitals.stats.temperature', 'Temperature'),
          value: vital.temperature || t('labels.notAvailable', 'N/A'),
          icon: IconThermometer,
          unit: vital.temperature ? t('vitals.units.fahrenheit', '°F') : '',
        },
        {
          label: t('vitals.modal.respiratoryRate', 'Respiratory Rate'),
          value: vital.respiratory_rate || t('labels.notAvailable', 'N/A'),
          icon: IconLungs,
          unit: vital.respiratory_rate ? t('vitals.units.perMin', '/min') : '',
        },
        {
          label: t('vitals.card.oxygenSaturation', 'Oxygen Saturation'),
          value: vital.oxygen_saturation || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.oxygen_saturation ? '%' : '',
        },
      ],
    },
    {
      title: t('vitals.modal.physicalMeasurements', 'Physical Measurements'),
      icon: IconWeight,
      items: [
        {
          label: t('vitals.stats.weight', 'Weight'),
          value: vital.weight || t('labels.notAvailable', 'N/A'),
          icon: IconWeight,
          unit: vital.weight ? t('vitals.units.lbs', 'lbs') : '',
        },
        {
          label: t('vitals.modal.height', 'Height'),
          value: vital.height || t('labels.notAvailable', 'N/A'),
          icon: IconTrendingUp,
          unit: vital.height ? t('vitals.units.inches', 'inches') : '',
        },
        {
          label: t('vitals.stats.bmi', 'BMI'),
          value: getBMIDisplay(vital.weight, vital.height),
          icon: IconTrendingUp,
        },
      ],
    },
    {
      title: t('vitals.modal.additionalMeasurements', 'Additional Measurements'),
      icon: IconDroplet,
      items: [
        {
          label: t('vitals.modal.bloodGlucose', 'Blood Glucose'),
          value: vital.blood_glucose || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.blood_glucose ? t('vitals.units.mgdl', 'mg/dL') : '',
        },
        {
          label: t('vitals.modal.a1c', 'A1C'),
          value: vital.a1c || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.a1c ? '%' : '',
        },
        {
          label: t('vitals.modal.painScale', 'Pain Scale'),
          value: vital.pain_scale !== null ? `${vital.pain_scale}/10` : t('labels.notAvailable', 'N/A'),
          icon: IconMoodSad,
        },
      ],
    },
  ];

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text fw={600} size="lg">
            {t('vitals.modal.title', 'Vital Signs Details')}
          </Text>
          {vital.status && <StatusBadge status={vital.status} />}
        </Group>
      }
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Stack gap="lg">
        {/* Vital Signs Sections */}
        {vitalSections.map((section, index) => {
          const SectionIcon = section.icon;
          return (
            <Paper key={index} shadow="sm" p="md" radius="md">
              <Group gap="sm" mb="md">
                <ActionIcon variant="light" size="md" radius="md">
                  <SectionIcon size={18} />
                </ActionIcon>
                <Title order={4}>{section.title}</Title>
              </Group>

              <Grid>
                {section.items.map((item, itemIndex) => {
                  const ItemIcon = item.icon;
                  return (
                    <Grid.Col key={itemIndex} span={{ base: 12, sm: 6 }}>
                      <Card shadow="xs" p="sm" radius="md" withBorder>
                        <Group gap="sm">
                          <ItemIcon
                            size={16}
                            color="var(--mantine-color-blue-6)"
                          />
                          <Box flex={1}>
                            <Text size="xs" c="dimmed" fw={500}>
                              {item.label}
                            </Text>
                            <Group gap="xs" align="baseline">
                              <Text size="sm" fw={600}>
                                {item.value}
                              </Text>
                              {item.unit && (
                                <Text size="xs" c="dimmed">
                                  {item.unit}
                                </Text>
                              )}
                            </Group>
                          </Box>
                        </Group>
                      </Card>
                    </Grid.Col>
                  );
                })}
              </Grid>
            </Paper>
          );
        })}

        {/* Notes Section */}
        {vital.notes && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconNotes size={18} />
              </ActionIcon>
              <Title order={4}>{t('vitals.modal.notes', 'Notes')}</Title>
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {vital.notes}
            </Text>
          </Paper>
        )}

        {/* Practitioner Information */}
        {vital.practitioner_id && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconUser size={18} />
              </ActionIcon>
              <Title order={4}>{t('vitals.modal.recordedBy', 'Recorded By')}</Title>
            </Group>
            <Card shadow="xs" p="sm" radius="md" withBorder>
              {practitioner ? (
                <>
                  <Text
                    size="sm"
                    fw={600}
                    c="blue"
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigateToEntity('practitioner', vital.practitioner_id, navigate)}
                  >
                    {practitioner.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {practitioner.specialty} • {practitioner.practice}
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('vitals.modal.practitionerId', 'Practitioner ID')}: {vital.practitioner_id}
                </Text>
              )}
            </Card>
          </Paper>
        )}

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

export default VitalViewModal;