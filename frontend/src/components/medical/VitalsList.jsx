/**
 * VitalsList Component - Enhanced Version with Mantine UI
 * Displays a list of patient vital signs with options to edit/delete/view details
 */
import logger from '../../services/logger';


import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Table,
  Button,
  Group,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Badge,
  Paper,
  Box,
  Flex,
  UnstyledButton,
  rem,
  Modal,
  Title,
  Divider,
  Grid,
  Card,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconAlertTriangle,
  IconRefresh,
  IconActivity,
  IconEye,
  IconCalendar,
  IconHeart,
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
import { vitalsService } from '../../services/medical/vitalsService';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import {
  formatMeasurement,
  convertForDisplay,
  unitLabels,
} from '../../utils/unitConversion';
import {
  formatDate as formatDateHelper,
  formatDateTime,
} from '../../utils/helpers';

const VitalsList = ({
  patientId,
  onEdit,
  onDelete,
  onView,
  onRefresh,
  vitalsData,
  loading,
  error,
  showActions = true,
  limit = 10,
}) => {
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();
  // Use passed data if available, otherwise load internally
  const [internalVitals, setInternalVitals] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'recorded_date',
    direction: 'desc',
  });
  const [selectedVital, setSelectedVital] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadVitals = useCallback(async () => {
    // Only load internally if no data is passed via props
    if (vitalsData !== undefined) return;

    try {
      setInternalLoading(true);
      setInternalError(null);
      let response;
      if (patientId) {
        response = await vitalsService.getPatientVitals(patientId, { limit });
      } else {
        response = await vitalsService.getVitals({ limit });
      }

      // Extract the data array from the response
      const data = response?.data || response;

      setInternalVitals(Array.isArray(data) ? data : []);
    } catch (err) {
      setInternalError(err.message || 'Failed to load vitals');
      setInternalVitals([]);
    } finally {
      setInternalLoading(false);
    }
  }, [patientId, limit, vitalsData]);

  useEffect(() => {
    loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    if (onRefresh && vitalsData === undefined) {
      loadVitals();
    }
  }, [onRefresh, loadVitals, vitalsData]);

  // Use passed data or internal data
  const vitals = vitalsData !== undefined ? vitalsData : internalVitals;
  const isLoading = loading !== undefined ? loading : internalLoading;
  const currentError = error !== undefined ? error : internalError;

  const handleDelete = async vitalsId => {
    if (
      !window.confirm('Are you sure you want to delete this vitals record?')
    ) {
      return;
    }

    // If external delete handler is provided and we're using external data, use it
    if (onDelete && vitalsData !== undefined) {
      try {
        await onDelete(vitalsId);
      } catch (err) {
        // Error handling is done by the parent component
        logger.error('Delete failed:', err);
      }
      return;
    }

    // Otherwise, handle deletion internally
    try {
      await vitalsService.deleteVitals(vitalsId);
      toast.success('Vitals record deleted successfully');
      loadVitals(); // Refresh the list
    } catch (err) {
      toast.error(
        err.response?.data?.detail || 'Failed to delete vitals record'
      );
    }
  };

  const handleViewDetails = vital => {
    if (onView) {
      // Use external view handler if provided
      onView(vital);
    } else {
      // Fall back to internal modal
      setSelectedVital(vital);
      setShowDetailsModal(true);
    }
  };

  const formatDate = dateString => {
    return formatDateHelper(dateString);
  };

  const formatTime = dateString => {
    return formatDateTime(dateString);
  };

  const getBPDisplay = (systolic, diastolic) => {
    if (!systolic || !diastolic) return 'N/A';
    return `${systolic}/${diastolic}`;
  };

  const getBMIDisplay = (weight, height) => {
    if (!weight || !height) return 'N/A';
    const bmi = vitalsService.calculateBMI(weight, height);
    return bmi ? bmi.toString() : 'N/A';
  };

  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedVitals = () => {
    if (!sortConfig.key || !vitals) return vitals || [];
    if (!Array.isArray(vitals)) return [];

    return [...vitals].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special sorting cases
      if (
        sortConfig.key === 'recorded_date' ||
        sortConfig.key === 'created_at'
      ) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortConfig.key === 'bp') {
        // Sort by systolic blood pressure
        aValue = a.systolic_bp || 0;
        bValue = b.systolic_bp || 0;
      } else if (sortConfig.key === 'bmi') {
        // Calculate BMI for sorting
        aValue =
          a.weight && a.height
            ? vitalsService.calculateBMI(a.weight, a.height)
            : 0;
        bValue =
          b.weight && b.height
            ? vitalsService.calculateBMI(b.weight, b.height)
            : 0;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = columnKey => {
    if (sortConfig.key !== columnKey) {
      return <IconSelector size={14} />;
    }
    return sortConfig.direction === 'asc' ? (
      <IconChevronUp size={14} />
    ) : (
      <IconChevronDown size={14} />
    );
  };

  const ThComponent = ({ children, sorted, onSort }) => (
    <UnstyledButton
      onClick={onSort}
      style={{
        width: '100%',
        padding: rem(8),
        fontWeight: 500,
        fontSize: rem(14),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'var(--mantine-color-text)',
      }}
    >
      <Text fw={500} size="sm">
        {children}
      </Text>
      {getSortIcon(sorted)}
    </UnstyledButton>
  );

  // Detailed view modal content
  const renderVitalDetails = () => {
    if (!selectedVital) return null;

    const vitalSections = [
      {
        title: 'Basic Information',
        icon: IconCalendar,
        items: [
          {
            label: 'Recorded Date',
            value: formatTime(selectedVital.recorded_date),
            icon: IconCalendar,
          },
          {
            label: 'Location',
            value: selectedVital.location || 'Not specified',
            icon: IconMapPin,
          },
          {
            label: 'Device Used',
            value: selectedVital.device_used || 'Not specified',
            icon: IconDevices,
          },
        ],
      },
      {
        title: 'Vital Signs',
        icon: IconHeart,
        items: [
          {
            label: 'Blood Pressure',
            value: getBPDisplay(
              selectedVital.systolic_bp,
              selectedVital.diastolic_bp
            ),
            icon: IconHeart,
            unit: 'mmHg',
          },
          {
            label: 'Heart Rate',
            value: selectedVital.heart_rate || 'N/A',
            icon: IconActivity,
            unit: selectedVital.heart_rate ? 'BPM' : '',
          },
          {
            label: 'Temperature',
            value: selectedVital.temperature
              ? formatMeasurement(
                  convertForDisplay(selectedVital.temperature, 'temperature', unitSystem),
                  'temperature',
                  unitSystem,
                  false
                )
              : 'N/A',
            icon: IconThermometer,
            unit: selectedVital.temperature
              ? unitLabels[unitSystem].temperature
              : '',
          },
          {
            label: 'Respiratory Rate',
            value: selectedVital.respiratory_rate || 'N/A',
            icon: IconLungs,
            unit: selectedVital.respiratory_rate ? '/min' : '',
          },
          {
            label: 'Oxygen Saturation',
            value: selectedVital.oxygen_saturation || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.oxygen_saturation ? '%' : '',
          },
        ],
      },
      {
        title: 'Physical Measurements',
        icon: IconWeight,
        items: [
          {
            label: 'Weight',
            value: selectedVital.weight
              ? formatMeasurement(
                  convertForDisplay(selectedVital.weight, 'weight', unitSystem),
                  'weight',
                  unitSystem,
                  false
                )
              : 'N/A',
            icon: IconWeight,
            unit: selectedVital.weight
              ? unitLabels[unitSystem].weight
              : '',
          },
          {
            label: 'Height',
            value: selectedVital.height || 'N/A',
            icon: IconTrendingUp,
            unit: selectedVital.height ? 'inches' : '',
          },
          {
            label: 'BMI',
            value: getBMIDisplay(selectedVital.weight, selectedVital.height),
            icon: IconTrendingUp,
          },
        ],
      },
      {
        title: 'Additional Measurements',
        icon: IconDroplet,
        items: [
          {
            label: 'Blood Glucose',
            value: selectedVital.blood_glucose || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.blood_glucose ? 'mg/dL' : '',
          },
          {
            label: 'A1C',
            value: selectedVital.a1c || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.a1c ? '%' : '',
          },
          {
            label: 'Pain Scale',
            value:
              selectedVital.pain_scale !== null
                ? `${selectedVital.pain_scale}/10`
                : 'N/A',
            icon: IconMoodSad,
          },
        ],
      },
    ];

    return (
      <Stack gap="lg">
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
                    <Grid.Col key={itemIndex} span={6}>
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
        {selectedVital.notes && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconNotes size={18} />
              </ActionIcon>
              <Title order={4}>Notes</Title>
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {selectedVital.notes}
            </Text>
          </Paper>
        )}

        {/* Practitioner Information */}
        {selectedVital.practitioner_id && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconUser size={18} />
              </ActionIcon>
              <Title order={4}>Recorded By</Title>
            </Group>
            <Card shadow="xs" p="sm" radius="md" withBorder>
              {selectedVital.practitioner ? (
                <>
                  <Text size="sm" fw={600}>
                    {selectedVital.practitioner.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedVital.practitioner.specialty}
                    {selectedVital.practitioner.practice ? ` • ${selectedVital.practitioner.practice}` : ''}
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Practitioner ID: {selectedVital.practitioner_id}
                </Text>
              )}
            </Card>
          </Paper>
        )}
      </Stack>
    );
  };

  const sortedVitals = getSortedVitals();

  if (isLoading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>{t('vitals.loading', 'Loading vitals...')}</Text>
        </Stack>
      </Center>
    );
  }

  if (currentError) {
    return (
      <Alert
        variant="light"
        color="red"
        icon={<IconAlertTriangle size={16} />}
        title={t('vitals.table.errorLoading', 'Error Loading Vitals')}
      >
        <Group justify="space-between" align="center">
          <Text size="sm">{currentError}</Text>
          <Button
            variant="filled"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={loadVitals}
          >
            {t('buttons.tryAgain', 'Try Again')}
          </Button>
        </Group>
      </Alert>
    );
  }

  if (vitals.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <IconActivity
            size={48}
            stroke={1}
            color="var(--mantine-color-gray-5)"
          />
          <Stack align="center" gap="xs">
            <Text fw={500}>{t('vitals.table.noRecords', 'No vitals records found')}</Text>
            <Text c="dimmed" ta="center" size="sm">
              {t('vitals.table.noRecordsDesc', 'Vital signs will appear here once recorded')}
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  const rows = sortedVitals.map(vital => (
    <Table.Tr key={vital.id}>
      <Table.Td>
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {formatDate(vital.recorded_date)}
          </Text>
          {vital.created_at && (
            <Text size="xs" c="dimmed">
              {formatTime(vital.created_at)}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        {vital.systolic_bp && vital.diastolic_bp ? (
          <Text size="sm" fw={500}>
            {getBPDisplay(vital.systolic_bp, vital.diastolic_bp)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.heart_rate ? (
          <Text size="sm" fw={500}>
            {vital.heart_rate} BPM
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.temperature ? (
          <Text size="sm" fw={500}>
            {formatMeasurement(
              convertForDisplay(vital.temperature, 'temperature', unitSystem),
              'temperature',
              unitSystem
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.weight ? (
          <Text size="sm" fw={500}>
            {formatMeasurement(
              convertForDisplay(vital.weight, 'weight', unitSystem),
              'weight',
              unitSystem
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.weight && vital.height ? (
          <Text size="sm" fw={500}>
            {getBMIDisplay(vital.weight, vital.height)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.blood_glucose ? (
          <Text size="sm" fw={500}>
            {vital.blood_glucose} mg/dL
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.a1c ? (
          <Text size="sm" fw={500}>
            {vital.a1c}%
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.oxygen_saturation ? (
          <Text size="sm" fw={500}>
            {vital.oxygen_saturation}%
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      {showActions && (
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="filled"
              color="green"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleViewDetails(vital);
              }}
              title="View details"
            >
              <IconEye size={14} />
            </ActionIcon>
            <ActionIcon
              variant="filled"
              color="blue"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                onEdit(vital);
              }}
              title="Edit vitals"
            >
              <IconEdit size={14} />
            </ActionIcon>
            <ActionIcon
              variant="filled"
              color="red"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleDelete(vital.id);
              }}
              title="Delete vitals"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  ));

  return (
    <>
      <Stack gap="md">
        <Paper shadow="sm" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <ThComponent
                    sorted="recorded_date"
                    onSort={() => handleSort('recorded_date')}
                  >
                    {t('vitals.table.date', 'Date')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent sorted="bp" onSort={() => handleSort('bp')}>
                    {t('vitals.stats.bloodPressure', 'Blood Pressure')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="heart_rate"
                    onSort={() => handleSort('heart_rate')}
                  >
                    {t('vitals.stats.heartRate', 'Heart Rate')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="temperature"
                    onSort={() => handleSort('temperature')}
                  >
                    {t('vitals.stats.temperature', 'Temperature')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="weight"
                    onSort={() => handleSort('weight')}
                  >
                    {t('vitals.stats.weight', 'Weight')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent sorted="bmi" onSort={() => handleSort('bmi')}>
                    {t('vitals.stats.bmi', 'BMI')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="blood_glucose"
                    onSort={() => handleSort('blood_glucose')}
                  >
                    {t('vitals.modal.bloodGlucose', 'Glucose')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="a1c"
                    onSort={() => handleSort('a1c')}
                  >
                    {t('vitals.modal.a1c', 'A1C')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="oxygen_saturation"
                    onSort={() => handleSort('oxygen_saturation')}
                  >
                    {t('vitals.table.oxygenSat', 'O2 Sat')}
                  </ThComponent>
                </Table.Th>
                {showActions && (
                  <Table.Th>
                    <Text fw={500} size="sm">
                      {t('labels.actions', 'Actions')}
                    </Text>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Paper>

        {vitals.length >= limit && (
          <Center>
            <Button variant="filled" onClick={loadVitals}>
              Load More
            </Button>
          </Center>
        )}
      </Stack>

      {/* Detailed View Modal */}
      <Modal
        opened={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={
          <Group gap="sm">
            <IconEye size={20} />
            <Title order={3}>Vital Signs Details</Title>
          </Group>
        }
        size="xl"
        centered
      >
        {renderVitalDetails()}
      </Modal>
    </>
  );
};

export default VitalsList;
