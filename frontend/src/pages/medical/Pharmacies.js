import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Paper,
  Group,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  Grid,
  Button,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import { usePharmacies } from '../../hooks/useGlobalData';

// Modular components
import PharmacyCard from '../../components/medical/pharmacy/PharmacyCard';
import PharmacyViewModal from '../../components/medical/pharmacy/PharmacyViewModal';
import PharmacyFormWrapper from '../../components/medical/pharmacy/PharmacyFormWrapper';

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
            variant="filled"
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
                      <PharmacyCard
                        pharmacy={pharmacy}
                        onEdit={handleEditPharmacy}
                        onDelete={() => handleDeletePharmacy(pharmacy.id)}
                        onView={handleViewPharmacy}
                        navigate={navigate}
                        onError={setError}
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          )}
        </motion.div>
      </Container>

      <PharmacyFormWrapper
        isOpen={showModal}
        onClose={resetForm}
        title={editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingPharmacy={editingPharmacy}
      />

      <PharmacyViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        pharmacy={viewingPharmacy}
        onEdit={handleEditPharmacy}
        navigate={navigate}
      />
    </motion.div>
  );
};

export default Pharmacies;
