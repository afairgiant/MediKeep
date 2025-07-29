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
  Divider,
  Anchor,
  Modal,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconUser,
  IconStethoscope,
  IconStar,
  IconShieldCheck,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantinePractitionerForm from '../../components/medical/MantinePractitionerForm';
import {
  usePractitioners,
  useCacheManager,
  useDataManagement,
} from '../../hooks';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phoneUtils';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import frontendLogger from '../../services/frontendLogger';

const Practitioners = () => {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const location = useLocation();

  // Using global state for practitioners data
  const {
    practitioners,
    loading,
    error: practitionersError,
    refresh,
  } = usePractitioners();
  const { invalidatePractitioners } = useCacheManager();

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPractitioner, setViewingPractitioner] = useState(null);

  // Standardized filtering and sorting
  const config = getMedicalPageConfig('practitioners');
  const dataManagement = useDataManagement(practitioners, config);
  const [editingPractitioner, setEditingPractitioner] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    practice: '',
    phone_number: '',
    website: '',
    rating: '',
  });

  // Handle global error state
  useEffect(() => {
    if (practitionersError) {
      setError('Failed to load practitioners. Please try again.');
    } else {
      setError('');
    }
  }, [practitionersError]);

  const handleAddPractitioner = () => {
    setEditingPractitioner(null);
    setFormData({
      name: '',
      specialty: '',
      practice: '',
      phone_number: '',
      website: '',
      rating: '',
    });
    setShowModal(true);
  };

  const handleViewPractitioner = practitioner => {
    setViewingPractitioner(practitioner);
    setShowViewModal(true);
    // Update URL with practitioner ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', practitioner.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingPractitioner(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleEditPractitioner = practitioner => {
    setEditingPractitioner(practitioner);
    setFormData({
      name: practitioner.name || '',
      specialty: practitioner.specialty || '',
      practice: practitioner.practice || '',
      phone_number: formatPhoneNumber(practitioner.phone_number) || '',
      website: practitioner.website || '',
      rating: practitioner.rating || '',
    });
    setShowModal(true);
  };

  const handleDeletePractitioner = async practitionerId => {
    if (
      window.confirm(
        'Are you sure you want to delete this practitioner? This action cannot be undone.'
      )
    ) {
      try {
        await apiService.deletePractitioner(practitionerId);
        // Refresh global practitioners data
        await refresh();
        setSuccessMessage('Practitioner deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete practitioner. Please try again.');
        frontendLogger.logError('Failed to delete practitioner', {
          practitionerId,
          error: err.message,
          stack: err.stack,
          page: 'Practitioners',
          action: 'delete',
        });
      }
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      // Clean the data before sending to API
      const dataToSubmit = {
        ...formData,
        phone_number: cleanPhoneNumber(formData.phone_number) || null,
        website:
          formData.website && formData.website.trim() !== ''
            ? formData.website.trim()
            : null,
        rating:
          formData.rating && formData.rating !== 0
            ? parseFloat(formData.rating)
            : null,
      };

      if (editingPractitioner) {
        await apiService.updatePractitioner(
          editingPractitioner.id,
          dataToSubmit
        );
        setSuccessMessage('Practitioner updated successfully');
      } else {
        await apiService.createPractitioner(dataToSubmit);
        setSuccessMessage('Practitioner added successfully');
      }

      setShowModal(false);
      // Refresh global practitioners data
      await refresh();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save practitioner. Please try again.');
      frontendLogger.logError('Failed to save practitioner', {
        practitionerId: editingPractitioner?.id,
        action: editingPractitioner ? 'update' : 'create',
        formData: { ...formData, phone_number: '[REDACTED]' }, // Don't log sensitive data
        error: err.message,
        stack: err.stack,
        page: 'Practitioners',
      });
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const filteredPractitioners = dataManagement.data;

  // Handle URL parameters for direct linking to specific practitioners
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (
      viewId &&
      filteredPractitioners &&
      filteredPractitioners.length > 0 &&
      !loading
    ) {
      const practitioner = filteredPractitioners.find(
        p => p.id.toString() === viewId
      );
      if (practitioner && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingPractitioner(practitioner);
        setShowViewModal(true);
      }
    }
  }, [location.search, filteredPractitioners, loading, showViewModal]);


  const getSpecialtyColor = specialty => {
    // Color coding for different specialties
    const specialtyColors = {
      Cardiology: 'red',
      'Emergency Medicine': 'red',
      'Family Medicine': 'green',
      'Internal Medicine': 'green',
      Pediatrics: 'blue',
      Surgery: 'orange',
      'General Surgery': 'orange',
      Psychiatry: 'purple',
      Neurology: 'yellow',
    };

    return specialtyColors[specialty] || 'gray';
  };

  const getSpecialtyIcon = specialty => {
    const specialtyIcons = {
      Cardiology: IconStethoscope,
      'Emergency Medicine': IconStethoscope,
      'Family Medicine': IconUser,
      'Internal Medicine': IconUser,
      Pediatrics: IconUser,
      Surgery: IconStethoscope,
      'General Surgery': IconStethoscope,
      Psychiatry: IconUser,
      Neurology: IconStethoscope,
    };

    return specialtyIcons[specialty] || IconUser;
  };

  if (loading) {
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading practitioners...</Text>
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
      <PageHeader title="Healthcare Practitioners" icon="👨‍⚕️" />

      <Container size="xl" py="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => setError('')}
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
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddPractitioner}
            size="md"
          >
            Add New Practitioner
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

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredPractitioners.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No healthcare practitioners found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Practitioner" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredPractitioners.map((practitioner, index) => {
                  const SpecialtyIcon = getSpecialtyIcon(
                    practitioner.specialty
                  );

                  return (
                    <Grid.Col
                      key={practitioner.id}
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
                                <SpecialtyIcon
                                  size={20}
                                  color={`var(--mantine-color-${getSpecialtyColor(practitioner.specialty)}-6)`}
                                />
                                <Text fw={600} size="lg">
                                  {practitioner.name}
                                </Text>
                              </Group>
                              <Badge
                                color={getSpecialtyColor(
                                  practitioner.specialty
                                )}
                                variant="light"
                              >
                                {practitioner.specialty}
                              </Badge>
                            </Group>
                          </Card.Section>

                          <Stack gap="md" mt="md">
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Practice:
                              </Text>
                              <Text size="sm" fw={500}>
                                {practitioner.practice}
                              </Text>
                            </Group>

                            {practitioner.phone_number && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Phone:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {formatPhoneNumber(practitioner.phone_number)}
                                </Text>
                              </Group>
                            )}

                            {practitioner.website && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Website:
                                </Text>
                                <Anchor
                                  href={practitioner.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="sm"
                                  c="blue"
                                >
                                  Visit Website
                                </Anchor>
                              </Group>
                            )}

                            {practitioner.rating !== null &&
                              practitioner.rating !== undefined && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Rating:
                                  </Text>
                                  <Group gap="xs">
                                    <IconStar
                                      size={16}
                                      color="var(--mantine-color-yellow-6)"
                                      fill="var(--mantine-color-yellow-6)"
                                    />
                                    <Text size="sm" fw={500}>
                                      {practitioner.rating}/5
                                    </Text>
                                  </Group>
                                </Group>
                              )}
                          </Stack>

                          <Stack gap={0} mt="auto">
                            <Divider />
                            <Group justify="flex-end" gap="xs" pt="sm">
                              <Button
                                variant="filled"
                                size="xs"
                                onClick={() =>
                                  handleViewPractitioner(practitioner)
                                }
                              >
                                View
                              </Button>
                              <Button
                                variant="filled"
                                size="xs"
                                onClick={() =>
                                  handleEditPractitioner(practitioner)
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="filled"
                                color="red"
                                size="xs"
                                onClick={() =>
                                  handleDeletePractitioner(practitioner.id)
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
                data={filteredPractitioners}
                columns={[
                  { header: 'Name', accessor: 'name' },
                  { header: 'Specialty', accessor: 'specialty' },
                  { header: 'Practice', accessor: 'practice' },
                  { header: 'Phone', accessor: 'phone_number' },
                  { header: 'Rating', accessor: 'rating' },
                ]}
                tableName="Healthcare Practitioners"
                onView={handleViewPractitioner}
                onEdit={handleEditPractitioner}
                onDelete={handleDeletePractitioner}
                formatters={{
                  name: getEntityFormatters('default').primaryName,
                  specialty: getEntityFormatters('default').simple,
                  practice: getEntityFormatters('default').simple,
                  phone_number: value =>
                    value ? formatPhoneNumber(value) : '-',
                  rating: value =>
                    value !== null && value !== undefined ? `${value}/5` : '-',
                }}
              />
            </Paper>
          )}
        </motion.div>
      </Container>

      <MantinePractitionerForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingPractitioner ? 'Edit Practitioner' : 'Add New Practitioner'
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingPractitioner={editingPractitioner}
      />

      {/* View Details Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Practitioner Details
            </Text>
            {viewingPractitioner && viewingPractitioner.specialty && (
              <Badge
                color={getSpecialtyColor(viewingPractitioner.specialty)}
                variant="light"
                size="lg"
              >
                {viewingPractitioner.specialty}
              </Badge>
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {viewingPractitioner && (
          <Stack gap="md">
            <Card withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Title order={3}>{viewingPractitioner.name}</Title>
                    <Text size="sm" c="dimmed">
                      Healthcare Practitioner
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      PRACTICE INFORMATION
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Practice:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPractitioner.practice ? 'inherit' : 'dimmed'}
                      >
                        {viewingPractitioner.practice || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Specialty:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPractitioner.specialty ? 'inherit' : 'dimmed'}
                      >
                        {viewingPractitioner.specialty || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Phone:
                      </Text>
                      <Text
                        size="sm"
                        c={
                          viewingPractitioner.phone_number
                            ? 'inherit'
                            : 'dimmed'
                        }
                      >
                        {viewingPractitioner.phone_number
                          ? formatPhoneNumber(viewingPractitioner.phone_number)
                          : 'Not specified'}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      CONTACT & RATING
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Website:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPractitioner.website ? 'inherit' : 'dimmed'}
                      >
                        {viewingPractitioner.website ? (
                          <Anchor
                            href={viewingPractitioner.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            c="blue"
                          >
                            Visit Website
                          </Anchor>
                        ) : (
                          'Not specified'
                        )}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Rating:
                      </Text>
                      <Text
                        size="sm"
                        c={
                          viewingPractitioner.rating !== null &&
                          viewingPractitioner.rating !== undefined
                            ? 'inherit'
                            : 'dimmed'
                        }
                      >
                        {viewingPractitioner.rating !== null &&
                        viewingPractitioner.rating !== undefined ? (
                          <Group gap="xs">
                            <IconStar
                              size={16}
                              color="var(--mantine-color-yellow-6)"
                              fill="var(--mantine-color-yellow-6)"
                            />
                            <Text size="sm" fw={500}>
                              {viewingPractitioner.rating}/5
                            </Text>
                          </Group>
                        ) : (
                          'Not specified'
                        )}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button
                variant="filled"
                size="xs"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditPractitioner(viewingPractitioner);
                }}
              >
                Edit Practitioner
              </Button>
              <Button variant="filled" size="xs" onClick={handleCloseViewModal}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </motion.div>
  );
};

export default Practitioners;
