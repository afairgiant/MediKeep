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
  Grid,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import MantineFilters from '../../components/mantine/MantineFilters';
import { ResponsiveTable } from '../../components/adapters';
import ViewToggle from '../../components/shared/ViewToggle';
import {
  usePractitioners,
  useCacheManager,
  useDataManagement,
} from '../../hooks';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phoneUtils';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import frontendLogger from '../../services/frontendLogger';
import { useTranslation } from 'react-i18next';

// Modular components
import PractitionerCard from '../../components/medical/practitioners/PractitionerCard';
import PractitionerViewModal from '../../components/medical/practitioners/PractitionerViewModal';
import PractitionerFormWrapper from '../../components/medical/practitioners/PractitionerFormWrapper';

const Practitioners = () => {
  const { t } = useTranslation('common');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();

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
      setError(t('practitioners.errors.loadFailed', 'Failed to load practitioners. Please try again.'));
    } else {
      setError('');
    }
  }, [practitionersError, t]);

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



  if (loading) {
    return (
      <Container size="xl" py="md">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>{t('practitioners.loading', 'Loading practitioners...')}</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <>
    <Container size="xl" py="md">
      <PageHeader title={t('practitioners.title', 'Healthcare Practitioners')} icon="👨‍⚕️" />

      <Stack gap="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title={t('common.labels.error', 'Error')}
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => setError('')}
            mb="md"
            style={{ whiteSpace: 'pre-line' }}
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title={t('common.labels.success', 'Success')}
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
            {t('practitioners.actions.addNew', 'Add New Practitioner')}
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
                    <Title order={3}>{t('practitioners.empty.title', 'No healthcare practitioners found')}</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? t('practitioners.empty.filtered', 'Try adjusting your search or filter criteria.')
                        : t('practitioners.empty.noData', 'Click "Add New Practitioner" to get started.')}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredPractitioners.map((practitioner, index) => (
                  <Grid.Col
                    key={practitioner.id}
                    span={{ base: 12, md: 6, lg: 4 }}
                  >
                      <PractitionerCard
                        practitioner={practitioner}
                        onEdit={handleEditPractitioner}
                        onDelete={handleDeletePractitioner}
                        onView={handleViewPractitioner}
                        navigate={navigate}
                        onError={(error) => {
                          setError(t('practitioners.errors.generic', 'An error occurred. Please try again.'));
                          frontendLogger.logError('PractitionerCard error', {
                            practitionerId: practitioner.id,
                            error: error.message,
                            page: 'Practitioners',
                          });
                        }}
                      />
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredPractitioners}
                columns={[
                  { header: t('practitioners.table.name', 'Name'), accessor: 'name', priority: 'high', width: 200 },
                  { header: t('practitioners.table.specialty', 'Specialty'), accessor: 'specialty', priority: 'high', width: 150 },
                  { header: t('practitioners.table.practice', 'Practice'), accessor: 'practice', priority: 'low', width: 150 },
                  { header: t('practitioners.table.phone', 'Phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                  { header: t('practitioners.table.rating', 'Rating'), accessor: 'rating', priority: 'low', width: 150 }
                ]}
                tableName={t('practitioners.title', 'Healthcare Practitioners')}
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
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
      </Stack>
      </Container>

      <PractitionerFormWrapper
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingPractitioner ? t('practitioners.form.editTitle', 'Edit Practitioner') : t('practitioners.form.addTitle', 'Add New Practitioner')
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingPractitioner}
        isLoading={false}
        statusMessage={''}
      />

      <PractitionerViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        practitioner={viewingPractitioner}
        onEdit={handleEditPractitioner}
        navigate={navigate}
      />
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Practitioners, {
  injectResponsive: true,
  displayName: 'ResponsivePractitioners'
});
