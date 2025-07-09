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
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconPill,
} from '@tabler/icons-react';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import { Button } from '../../components/ui';
import MantineFilters from '../../components/mantine/MantineFilters';
import MantinePharmacyForm from '../../components/medical/MantinePharmacyForm';
import { formatPhoneNumber } from '../../utils/phoneUtils';
import { usePharmacies } from '../../hooks/useGlobalData';
import { getAndClearStoredEntityId } from '../../utils/linkNavigation';

const Pharmacies = () => {
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPharmacy, setViewingPharmacy] = useState(null);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Use global state for pharmacies data
  const {
    pharmacies,
    loading,
    error: globalError,
    refresh: refreshPharmacies,
  } = usePharmacies();

  // Get standardized configuration
  const config = getMedicalPageConfig('pharmacies');

  // Use standardized data management
  const dataManagement = useDataManagement(pharmacies || [], config);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    street_address: '',
    city: '',
    store_number: '',
    phone_number: '',
    website: '',
  });

  // Handle global error
  useEffect(() => {
    if (globalError) {
      setError('Failed to load pharmacies. Please try again.');
    }
  }, [globalError]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      street_address: '',
      city: '',
      store_number: '',
      phone_number: '',
      website: '',
    });
    setEditingPharmacy(null);
    setShowModal(false);
  };

  const handleAddPharmacy = () => {
    resetForm();
    setShowModal(true);
  };

  const handleViewPharmacy = pharmacy => {
    setViewingPharmacy(pharmacy);
    setShowViewModal(true);
    // Update URL with pharmacy ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', pharmacy.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingPharmacy(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleEditPharmacy = pharmacy => {
    setFormData({
      name: pharmacy.name || '',
      brand: pharmacy.brand || '',
      street_address: pharmacy.street_address || '',
      city: pharmacy.city || '',
      store_number: pharmacy.store_number || '',
      phone_number: pharmacy.phone_number || '',
      website: pharmacy.website || '',
    });
    setEditingPharmacy(pharmacy);
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      setError('');
      setSuccessMessage('');
      const pharmacyData = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        street_address: formData.street_address.trim(),
        city: formData.city.trim(),
        store_number: formData.store_number.trim(),
        phone_number: formData.phone_number.trim() || null,
        website: formData.website.trim() || null,
      };

      if (editingPharmacy) {
        await apiService.updatePharmacy(editingPharmacy.id, pharmacyData);
        setSuccessMessage('Pharmacy updated successfully!');
      } else {
        await apiService.createPharmacy(pharmacyData);
        setSuccessMessage('Pharmacy added successfully!');
      }

      await refreshPharmacies(); // Refresh global cache
      resetForm();
    } catch (error) {
      setError(`Failed to save pharmacy: ${error.message}`);
    }
  };

  const handleDeletePharmacy = async pharmacyId => {
    if (!window.confirm('Are you sure you want to delete this pharmacy?')) {
      return;
    }

    try {
      setError('');
      await apiService.deletePharmacy(pharmacyId);
      setSuccessMessage('Pharmacy deleted successfully!');
      await refreshPharmacies(); // Refresh global cache
    } catch (error) {
      setError(`Failed to delete pharmacy: ${error.message}`);
    }
  };

  // Get processed data from data management
  const filteredPharmacies = dataManagement.data;

  // Handle URL parameters for direct linking to specific pharmacies
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (
      viewId &&
      filteredPharmacies &&
      filteredPharmacies.length > 0 &&
      !loading
    ) {
      const pharmacy = filteredPharmacies.find(p => p.id.toString() === viewId);
      if (pharmacy && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingPharmacy(pharmacy);
        setShowViewModal(true);
      }
    }
  }, [location.search, filteredPharmacies, loading, showViewModal]);

  // Handle auto-open from entity navigation (e.g., from other pages)
  useEffect(() => {
    const pharmacyIdToOpen = getAndClearStoredEntityId('pharmacy');
    if (pharmacyIdToOpen && filteredPharmacies && filteredPharmacies.length > 0 && !loading) {
      const pharmacyToView = filteredPharmacies.find(p => p.id === parseInt(pharmacyIdToOpen));
      if (pharmacyToView && !showViewModal) {
        handleViewPharmacy(pharmacyToView);
      }
    }
  }, [filteredPharmacies, loading, showViewModal]);

  if (loading) {
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading pharmacies...</Text>
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
      <PageHeader title="Pharmacies" icon="💊" />

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
            leftSection={<IconPlus size={16} />}
            onClick={handleAddPharmacy}
            size="md"
          >
            Add New Pharmacy
          </Button>
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
          {filteredPharmacies.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No pharmacies found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Pharmacy" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : (
            <Grid>
              <AnimatePresence>
                {filteredPharmacies.map((pharmacy, index) => (
                  <Grid.Col key={pharmacy.id} span={{ base: 12, md: 6, lg: 4 }}>
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
                              <IconPill
                                size={20}
                                color="var(--mantine-color-blue-6)"
                              />
                              <Text fw={600} size="lg">
                                {pharmacy.name}
                              </Text>
                            </Group>
                            {pharmacy.brand && (
                              <Badge color="blue" variant="light">
                                {pharmacy.brand}
                              </Badge>
                            )}
                          </Group>
                        </Card.Section>

                        <Stack gap="md" mt="md">
                          {pharmacy.street_address && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Address:
                              </Text>
                              <Text size="sm" fw={500}>
                                {pharmacy.street_address}
                              </Text>
                            </Group>
                          )}

                          {pharmacy.city && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                City:
                              </Text>
                              <Text size="sm" fw={500}>
                                {pharmacy.city}
                              </Text>
                            </Group>
                          )}

                          {pharmacy.store_number && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Store Number:
                              </Text>
                              <Text size="sm" fw={500}>
                                {pharmacy.store_number}
                              </Text>
                            </Group>
                          )}

                          {pharmacy.phone_number && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Phone:
                              </Text>
                              <Text size="sm" fw={500}>
                                {formatPhoneNumber(pharmacy.phone_number)}
                              </Text>
                            </Group>
                          )}

                          {pharmacy.website && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Website:
                              </Text>
                              <Anchor
                                href={
                                  pharmacy.website.startsWith('http')
                                    ? pharmacy.website
                                    : `https://${pharmacy.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                size="sm"
                                c="blue"
                              >
                                Visit Website
                              </Anchor>
                            </Group>
                          )}
                        </Stack>

                        <Stack gap={0} mt="auto">
                          <Divider />
                          <Group justify="flex-end" gap="xs" pt="sm">
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleViewPharmacy(pharmacy)}
                            >
                              View
                            </Button>
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleEditPharmacy(pharmacy)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              onClick={() => handleDeletePharmacy(pharmacy.id)}
                            >
                              Delete
                            </Button>
                          </Group>
                        </Stack>
                      </Card>
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          )}
        </motion.div>
      </Container>

      <MantinePharmacyForm
        isOpen={showModal}
        onClose={resetForm}
        title={editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingPharmacy={editingPharmacy}
      />

      {/* View Details Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Pharmacy Details
            </Text>
            {viewingPharmacy && viewingPharmacy.brand && (
              <Badge color="blue" variant="light" size="lg">
                {viewingPharmacy.brand}
              </Badge>
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {viewingPharmacy && (
          <Stack gap="md">
            <Card withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Title order={3}>{viewingPharmacy.name}</Title>
                    <Text size="sm" c="dimmed">
                      Pharmacy
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
                      LOCATION
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Address:
                      </Text>
                      <Text
                        size="sm"
                        c={
                          viewingPharmacy.street_address ? 'inherit' : 'dimmed'
                        }
                      >
                        {viewingPharmacy.street_address || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        City:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPharmacy.city ? 'inherit' : 'dimmed'}
                      >
                        {viewingPharmacy.city || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Store #:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPharmacy.store_number ? 'inherit' : 'dimmed'}
                      >
                        {viewingPharmacy.store_number || 'Not specified'}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      CONTACT INFORMATION
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Phone:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPharmacy.phone_number ? 'inherit' : 'dimmed'}
                      >
                        {viewingPharmacy.phone_number
                          ? formatPhoneNumber(viewingPharmacy.phone_number)
                          : 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Website:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingPharmacy.website ? 'inherit' : 'dimmed'}
                      >
                        {viewingPharmacy.website ? (
                          <Anchor
                            href={
                              viewingPharmacy.website.startsWith('http')
                                ? viewingPharmacy.website
                                : `https://${viewingPharmacy.website}`
                            }
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
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </Modal>
    </motion.div>
  );
};

export default Pharmacies;
