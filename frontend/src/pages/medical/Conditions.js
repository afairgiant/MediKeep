import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Badge,
  Grid,
  Card,
  Box,
  Divider,
  Modal,
} from '@mantine/core';
import { Button } from '../../components/ui';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconHeart,
  IconBrain,
  IconLungs,
  IconBone,
  IconDroplet,
  IconAward,
} from '@tabler/icons-react';
import { useMedicalData, useDataManagement } from '../../hooks';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineConditionForm from '../../components/medical/MantineConditionForm';

const Conditions = () => {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Standardized data management
  const {
    items: conditions,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'condition',
    apiMethodsConfig: {
      getAll: signal => apiService.getConditions(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientConditions(patientId, signal),
      create: (data, signal) => apiService.createCondition(data, signal),
      update: (id, data, signal) =>
        apiService.updateCondition(id, data, signal),
      delete: (id, signal) => apiService.deleteCondition(id, signal),
    },
    requiresPatient: true,
  });

  // Standardized filtering and sorting using configuration
  const config = getMedicalPageConfig('conditions');
  const dataManagement = useDataManagement(conditions, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCondition, setViewingCondition] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [formData, setFormData] = useState({
    diagnosis: '',
    notes: '',
    status: 'active',
    severity: '',
    icd10_code: '',
    snomed_code: '',
    code_description: '',
    onset_date: '', // Form field name
    end_date: '', // Form field name
  });

  const handleAddCondition = () => {
    setEditingCondition(null);
    setFormData({
      diagnosis: '',
      notes: '',
      status: 'active',
      severity: '',
      icd10_code: '',
      snomed_code: '',
      code_description: '',
      onset_date: '',
      end_date: '',
    });
    setShowModal(true);
  };

  const handleViewCondition = condition => {
    setViewingCondition(condition);
    setShowViewModal(true);
  };

  // Check for condition ID to auto-open from other pages
  useEffect(() => {
    const conditionIdToOpen = sessionStorage.getItem('openConditionId');
    if (conditionIdToOpen && conditions.length > 0) {
      const conditionToView = conditions.find(
        c => c.id === parseInt(conditionIdToOpen)
      );
      if (conditionToView) {
        handleViewCondition(conditionToView);
        sessionStorage.removeItem('openConditionId'); // Clean up
      }
    }
  }, [conditions]); // Re-run when conditions data loads

  const handleEditCondition = condition => {
    setEditingCondition(condition);
    setFormData({
      diagnosis: condition.diagnosis || '',
      notes: condition.notes || '',
      status: condition.status || 'active',
      severity: condition.severity || '',
      icd10_code: condition.icd10_code || '',
      snomed_code: condition.snomed_code || '',
      code_description: condition.code_description || '',
      onset_date: condition.onset_date
        ? condition.onset_date.split('T')[0]
        : '',
      end_date: condition.end_date ? condition.end_date.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleDeleteCondition = async conditionId => {
    const success = await deleteItem(conditionId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const conditionData = {
      diagnosis: formData.diagnosis,
      notes: formData.notes || null,
      status: formData.status,
      severity: formData.severity || null,
      icd10_code: formData.icd10_code || null,
      snomed_code: formData.snomed_code || null,
      code_description: formData.code_description || null,
      onset_date: formData.onset_date || null, // Use snake_case to match API
      end_date: formData.end_date || null, // Use snake_case to match API
      patient_id: currentPatient.id,
    };

    let success;
    if (editingCondition) {
      success = await updateItem(editingCondition.id, conditionData);
    } else {
      success = await createItem(conditionData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const filteredConditions = dataManagement.data;

  // Helper function to calculate time since onset
  const getTimeSinceOnset = onsetDate => {
    if (!onsetDate) return null;

    const onset = new Date(onsetDate);
    const now = new Date();
    const diffTime = Math.abs(now - onset);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months === 1 ? '' : 's'} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years === 1 ? '' : 's'} ago`;
    }
  };

  // Helper function to get condition icon based on diagnosis
  const getConditionIcon = diagnosis => {
    const diagnosisLower = diagnosis.toLowerCase();
    if (diagnosisLower.includes('diabetes')) return IconDroplet;
    if (
      diagnosisLower.includes('hypertension') ||
      diagnosisLower.includes('blood pressure')
    )
      return IconHeart;
    if (
      diagnosisLower.includes('asthma') ||
      diagnosisLower.includes('respiratory')
    )
      return IconLungs;
    if (
      diagnosisLower.includes('arthritis') ||
      diagnosisLower.includes('joint')
    )
      return IconBone;
    if (diagnosisLower.includes('heart') || diagnosisLower.includes('cardiac'))
      return IconHeart;
    if (diagnosisLower.includes('cancer') || diagnosisLower.includes('tumor'))
      return IconAward;
    if (
      diagnosisLower.includes('migraine') ||
      diagnosisLower.includes('headache')
    )
      return IconBrain;
    if (
      diagnosisLower.includes('allergy') ||
      diagnosisLower.includes('allergic')
    )
      return IconAlertTriangle;
    return IconShieldCheck; // Default medical icon
  };

  const getSeverityColor = severity => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'severe':
        return 'orange';
      case 'moderate':
        return 'yellow';
      case 'mild':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'resolved':
        return 'blue';
      case 'chronic':
        return 'orange';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading conditions...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Medical Conditions" icon="🏥" />

      <Container size="xl" py="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title="Success"
            icon={<IconCheck size={16} />}
            mb="md"
          >
            {successMessage}
          </Alert>
        )}

        <Group justify="space-between" mb="lg">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddCondition}
            size="md"
          >
            Add New Condition
          </Button>

          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showPrint={true}
          />
        </Group>

        {/* Mantine Filter Controls */}
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          categoryOptions={dataManagement.categoryOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Form Modal */}
        <MantineConditionForm
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingCondition ? 'Edit Condition' : 'Add New Condition'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingCondition={editingCondition}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredConditions.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No medical conditions found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Condition" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredConditions.map((condition, index) => {
                  const ConditionIcon = getConditionIcon(condition.diagnosis);

                  return (
                    <Grid.Col
                      key={condition.id}
                      span={{ base: 12, md: 6, lg: 4 }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                          <Card.Section withBorder inheritPadding py="xs">
                            <Group justify="space-between">
                              <Group gap="xs">
                                <ConditionIcon
                                  size={20}
                                  color="var(--mantine-color-blue-6)"
                                />
                                <Text fw={600} size="lg">
                                  {condition.diagnosis}
                                </Text>
                              </Group>
                              <Badge
                                color={getStatusColor(condition.status)}
                                variant="light"
                              >
                                {condition.status}
                              </Badge>
                            </Group>
                          </Card.Section>

                          <Stack gap="md" mt="md">
                            {/* Display onset date if available */}
                            {condition.onset_date && (
                              <>
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Onset Date:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {formatDate(condition.onset_date)}
                                  </Text>
                                </Group>
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Duration:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {getTimeSinceOnset(condition.onset_date)}
                                  </Text>
                                </Group>
                              </>
                            )}

                            {/* Display end date if available */}
                            {condition.end_date && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  End Date:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {formatDate(condition.end_date)}
                                </Text>
                              </Group>
                            )}

                            {/* Display severity if available */}
                            {condition.severity && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Severity:
                                </Text>
                                <Badge
                                  color={getSeverityColor(condition.severity)}
                                  variant="filled"
                                >
                                  {condition.severity}
                                </Badge>
                              </Group>
                            )}

                            {/* Display medical codes if available */}
                            {(condition.icd10_code ||
                              condition.snomed_code) && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Medical Codes:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {condition.icd10_code &&
                                    `ICD-10: ${condition.icd10_code}`}
                                  {condition.icd10_code &&
                                    condition.snomed_code &&
                                    ' | '}
                                  {condition.snomed_code &&
                                    `SNOMED: ${condition.snomed_code}`}
                                </Text>
                              </Group>
                            )}

                            {condition.code_description && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Code Description:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {condition.code_description}
                                </Text>
                              </Group>
                            )}

                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Status:
                              </Text>
                              <Badge
                                color={getStatusColor(condition.status)}
                                variant="light"
                              >
                                {condition.status}
                              </Badge>
                            </Group>
                          </Stack>

                          {condition.notes && (
                            <Box
                              mt="md"
                              pt="md"
                              style={{
                                borderTop:
                                  '1px solid var(--mantine-color-gray-3)',
                              }}
                            >
                              <Text size="sm" c="dimmed" mb="xs">
                                📝 Clinical Notes
                              </Text>
                              <Text size="sm" c="gray.7">
                                {condition.notes}
                              </Text>
                            </Box>
                          )}

                          <Stack gap={0} mt="auto">
                            <Divider />
                            <Group justify="flex-end" gap="xs" pt="sm">
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => handleViewCondition(condition)}
                              >
                                View
                              </Button>
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => handleEditCondition(condition)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="light"
                                color="red"
                                size="xs"
                                onClick={() =>
                                  handleDeleteCondition(condition.id)
                                }
                              >
                                Delete
                              </Button>
                            </Group>
                          </Stack>
                        </Card>
                      </motion.div>
                    </Grid.Col>
                  );
                })}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <MedicalTable
                data={filteredConditions}
                columns={[
                  { header: 'Condition', accessor: 'diagnosis' },
                  { header: 'Severity', accessor: 'severity' },
                  { header: 'Onset Date', accessor: 'onset_date' },
                  { header: 'End Date', accessor: 'end_date' },
                  { header: 'Status', accessor: 'status' },
                  { header: 'ICD-10', accessor: 'icd10_code' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Conditions"
                onView={handleViewCondition}
                onEdit={handleEditCondition}
                onDelete={handleDeleteCondition}
                formatters={{
                  diagnosis: getEntityFormatters('conditions').condition_name,
                  severity: getEntityFormatters('conditions').severity,
                  onset_date: getEntityFormatters('conditions').onset_date,
                  end_date: getEntityFormatters('conditions').end_date,
                  status: getEntityFormatters('conditions').status,
                  icd10_code: getEntityFormatters('conditions').simple,
                  notes: getEntityFormatters('conditions').notes,
                }}
              />
            </Paper>
          )}
        </motion.div>

        {/* Condition View Modal */}
        <Modal
          opened={showViewModal}
          onClose={() => setShowViewModal(false)}
          title={
            <Group>
              <Text size="lg" fw={600}>
                Condition Details
              </Text>
              {viewingCondition && (
                <Badge
                  color={getStatusColor(viewingCondition.status)}
                  variant="light"
                >
                  {viewingCondition.status}
                </Badge>
              )}
            </Group>
          }
          size="lg"
          centered
        >
          {viewingCondition && (
            <Stack gap="md">
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Title order={3}>{viewingCondition.diagnosis}</Title>
                      {viewingCondition.severity && (
                        <Badge
                          color={getSeverityColor(viewingCondition.severity)}
                          variant="filled"
                        >
                          {viewingCondition.severity}
                        </Badge>
                      )}
                    </Stack>
                  </Group>
                </Stack>
              </Card>

              <Grid>
                <Grid.Col span={6}>
                  <Card withBorder p="md" h="100%">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        DIAGNOSIS INFORMATION
                      </Text>
                      <Divider />
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Diagnosis:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingCondition.diagnosis ? 'inherit' : 'dimmed'}
                        >
                          {viewingCondition.diagnosis || 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Severity:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingCondition.severity ? 'inherit' : 'dimmed'}
                        >
                          {viewingCondition.severity || 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Status:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingCondition.status ? 'inherit' : 'dimmed'}
                        >
                          {viewingCondition.status || 'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Card withBorder p="md" h="100%">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        TIMELINE
                      </Text>
                      <Divider />
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Onset Date:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingCondition.onset_date ? 'inherit' : 'dimmed'}
                        >
                          {viewingCondition.onset_date
                            ? formatDate(viewingCondition.onset_date)
                            : 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          End Date:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingCondition.end_date ? 'inherit' : 'dimmed'}
                        >
                          {viewingCondition.end_date
                            ? formatDate(viewingCondition.end_date)
                            : 'Not specified'}
                        </Text>
                      </Group>
                      {viewingCondition.onset_date && (
                        <Group>
                          <Text size="sm" fw={500} w={80}>
                            Duration:
                          </Text>
                          <Text size="sm" c="inherit">
                            {getTimeSinceOnset(viewingCondition.onset_date)}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>

              {(viewingCondition.icd10_code ||
                viewingCondition.snomed_code ||
                viewingCondition.code_description) && (
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      MEDICAL CODES
                    </Text>
                    <Divider />
                    <Grid>
                      {viewingCondition.icd10_code && (
                        <Grid.Col span={6}>
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              ICD-10:
                            </Text>
                            <Text size="sm">{viewingCondition.icd10_code}</Text>
                          </Group>
                        </Grid.Col>
                      )}
                      {viewingCondition.snomed_code && (
                        <Grid.Col span={6}>
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              SNOMED:
                            </Text>
                            <Text size="sm">
                              {viewingCondition.snomed_code}
                            </Text>
                          </Group>
                        </Grid.Col>
                      )}
                    </Grid>
                    {viewingCondition.code_description && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Description:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingCondition.code_description
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingCondition.code_description || 'Not specified'}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Card>
              )}

              <Card withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    CLINICAL NOTES
                  </Text>
                  <Divider />
                  <Text
                    size="sm"
                    c={viewingCondition.notes ? 'inherit' : 'dimmed'}
                  >
                    {viewingCondition.notes || 'No notes available'}
                  </Text>
                </Stack>
              </Card>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditCondition(viewingCondition);
                  }}
                >
                  Edit Condition
                </Button>
                <Button
                  variant="filled"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Container>
    </motion.div>
  );
};

export default Conditions;
