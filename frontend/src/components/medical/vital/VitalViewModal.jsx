import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Grid,
  Paper,
  ActionIcon,
  Title,
  Card,
  Box,
  Tooltip,
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
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import {
  convertForDisplay,
  unitLabels,
  convertHeight,
} from '../../../utils/unitConversion';
import { navigateToEntity } from '../../../utils/linkNavigation';
import StatusBadge from '../StatusBadge';

// BMI conversion factor for imperial units (pounds and inches)
const BMI_IMPERIAL_CONVERSION_FACTOR = 703;

const VitalViewModal = ({
  isOpen,
  onClose,
  vital,
  onEdit,
  practitioners = [],
  navigate,
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { formatDate, formatDateTime } = useDateFormat();
  const { unitSystem } = useUserPreferences();

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
      title: t('shared:labels.basicInformation', 'Basic Information'),
      icon: IconCalendar,
      items: [
        {
          label: t('shared:labels.recordedDate', 'Recorded Date'),
          value: formatDateTime(vital.recorded_date),
          icon: IconCalendar,
        },
        {
          label: t('shared:labels.location', 'Location'),
          value:
            vital.location || t('shared:labels.notSpecified', 'Not specified'),
          icon: IconMapPin,
        },
        {
          label: t('vitals:modal.deviceUsed', 'Device Used'),
          value:
            vital.device_used ||
            t('shared:labels.notSpecified', 'Not specified'),
          icon: IconDevices,
        },
      ],
    },
    {
      title: t('shared:categories.vital_signs', 'Vital Signs'),
      icon: IconHeart,
      items: [
        {
          label: t('vitals:stats.bloodPressure', 'Blood Pressure'),
          value: getBPDisplay(vital.systolic_bp, vital.diastolic_bp),
          icon: IconHeart,
          unit: t('vitals:units.mmHg', 'mmHg'),
        },
        {
          label: t('vitals:stats.heartRate', 'Heart Rate'),
          value: vital.heart_rate || t('labels.notAvailable', 'N/A'),
          icon: IconActivity,
          unit: vital.heart_rate ? t('vitals:units.bpm', 'BPM') : '',
        },
        {
          label: t('vitals:stats.temperature', 'Temperature'),
          value: vital.temperature
            ? (convertForDisplay(
                vital.temperature,
                'temperature',
                unitSystem
              )?.toFixed(1) ?? vital.temperature)
            : t('labels.notAvailable', 'N/A'),
          icon: IconThermometer,
          unit: vital.temperature ? unitLabels[unitSystem].temperature : '',
        },
        {
          label: t('vitals:modal.respiratoryRate', 'Respiratory Rate'),
          value: vital.respiratory_rate || t('labels.notAvailable', 'N/A'),
          icon: IconLungs,
          unit: vital.respiratory_rate ? t('vitals:units.perMin', '/min') : '',
        },
        {
          label: t('vitals:card.oxygenSaturation', 'Oxygen Saturation'),
          value: vital.oxygen_saturation || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.oxygen_saturation ? '%' : '',
        },
      ],
    },
    {
      title: t('vitals:modal.physicalMeasurements', 'Physical Measurements'),
      icon: IconWeight,
      items: [
        {
          label: t('vitals:stats.weight', 'Weight'),
          value: vital.weight
            ? (convertForDisplay(vital.weight, 'weight', unitSystem)?.toFixed(
                1
              ) ?? vital.weight)
            : t('labels.notAvailable', 'N/A'),
          icon: IconWeight,
          unit: vital.weight ? unitLabels[unitSystem].weight : '',
        },
        {
          label: t('shared:labels.height', 'Height'),
          value: vital.height
            ? ((unitSystem === 'imperial'
                ? convertHeight.inchesToFeetInches(vital.height)
                : convertForDisplay(
                    vital.height,
                    'height',
                    unitSystem
                  )?.toFixed(1)) ?? vital.height)
            : t('labels.notAvailable', 'N/A'),
          icon: IconTrendingUp,
          unit:
            vital.height && unitSystem === 'metric'
              ? unitLabels[unitSystem].height
              : '',
        },
        {
          label: t('vitals:stats.bmi', 'BMI'),
          value: getBMIDisplay(vital.weight, vital.height),
          icon: IconTrendingUp,
        },
      ],
    },
    {
      title: t(
        'vitals:modal.additionalMeasurements',
        'Additional Measurements'
      ),
      icon: IconDroplet,
      items: [
        {
          label: t('vitals:modal.bloodGlucose', 'Blood Glucose'),
          value: vital.blood_glucose || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.blood_glucose ? t('vitals:units.mgdl', 'mg/dL') : '',
        },
        ...(vital.blood_glucose
          ? [
              {
                label: t('vitals:modal.glucoseContext', 'Measurement Type'),
                value: vital.glucose_context
                  ? t(
                      `vitals.glucoseContext.${vital.glucose_context}`,
                      vital.glucose_context
                    )
                  : t('shared:labels.notSpecified', 'Not specified'),
                icon: IconDroplet,
              },
            ]
          : []),
        {
          label: t('vitals:modal.a1c', 'A1C'),
          value: vital.a1c || t('labels.notAvailable', 'N/A'),
          icon: IconDroplet,
          unit: vital.a1c ? '%' : '',
        },
        {
          label: t('vitals:modal.painScale', 'Pain Scale'),
          value:
            vital.pain_scale !== null
              ? `${vital.pain_scale}/10`
              : t('labels.notAvailable', 'N/A'),
          icon: IconMoodSad,
        },
      ],
    },
  ];

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('vitals:modal.title', 'Vital Signs Details')}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        },
      }}
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
                {t('shared:categories.vital_signs', 'Vital Signs')}
              </Title>
              <Group gap="xs">
                {vital.recorded_date && (
                  <Badge variant="light" color="blue" size="sm">
                    {formatDate(vital.recorded_date)}
                  </Badge>
                )}
                {vital.location && (
                  <Badge variant="light" color="gray" size="sm">
                    {vital.location}
                  </Badge>
                )}
                {vital.status && <StatusBadge status={vital.status} />}
              </Group>
            </div>
            {vital.systolic_bp && vital.diastolic_bp && (
              <Badge variant="filled" color="red" size="lg">
                {getBPDisplay(vital.systolic_bp, vital.diastolic_bp)}{' '}
                {t('vitals:units.mmHg')}
              </Badge>
            )}
          </Group>
        </Paper>

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
              <Title order={4}>{t('shared:tabs.notes', 'Notes')}</Title>
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
              <Title order={4}>
                {t('shared:labels.recordedBy', 'Recorded By')}
              </Title>
            </Group>
            <Card shadow="xs" p="sm" radius="md" withBorder>
              {practitioner ? (
                <>
                  <Text
                    size="sm"
                    fw={600}
                    c="blue"
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() =>
                      navigateToEntity(
                        'practitioner',
                        vital.practitioner_id,
                        navigate
                      )
                    }
                  >
                    {practitioner.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {practitioner.specialty}
                    {practitioner.practice ? ` • ${practitioner.practice}` : ''}
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('vitals:modal.practitionerId', 'Practitioner ID')}:{' '}
                  {vital.practitioner_id}
                </Text>
              )}
            </Card>
          </Paper>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('shared:labels.close', 'Close')}
          </Button>
          <Tooltip
            label={disableEditTooltip}
            disabled={!disableEdit || !disableEditTooltip}
          >
            <span>
              <Button
                variant="filled"
                onClick={handleEdit}
                leftSection={<IconEdit size={16} />}
                disabled={disableEdit}
              >
                {t('shared:labels.edit', 'Edit')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
};

export default VitalViewModal;
