import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Text,
  Title,
  Stack,
} from '@mantine/core';
import {
  IconPlus,
  IconShieldCheck,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
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
    email: '',
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
      email: '',
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
      email: practitioner.email || '',
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
        practice:
          formData.practice && formData.practice.trim() !== ''
            ? formData.practice.trim()
            : null,
        phone_number: cleanPhoneNumber(formData.phone_number) || null,
        email:
          formData.email && formData.email.trim() !== ''
            ? formData.email.trim().toLowerCase()
            : null,
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
    return <MedicalPageLoading message={t('practitioners.loading', 'Loading practitioners...')} />;
  }

  return (
    <>
    <Container size="xl" py="md">
      <PageHeader title={t('practitioners.title', 'Healthcare Practitioners')} icon="👨‍⚕️" />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={() => setError('')}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('practitioners.actions.addNew', 'Add New Practitioner'),
            onClick: handleAddPractitioner,
            leftSection: <IconPlus size={16} />,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Content */}
          {filteredPractitioners.length === 0 ? (
            <EmptyState
              icon={IconShieldCheck}
              title={t('practitioners.empty.title', 'No healthcare practitioners found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('practitioners.empty.filtered', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('practitioners.empty.noData', 'Click "Add New Practitioner" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredPractitioners}
              columns={{ base: 12, md: 6, lg: 4 }}
              renderCard={(practitioner) => (
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
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredPractitioners}
                columns={[
                  { header: t('practitioners.table.name', 'Name'), accessor: 'name', priority: 'high', width: 200 },
                  { header: t('practitioners.table.specialty', 'Specialty'), accessor: 'specialty', priority: 'high', width: 150 },
                  { header: t('practitioners.table.practice', 'Practice'), accessor: 'practice', priority: 'low', width: 150 },
                  { header: t('practitioners.table.phone', 'Phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                  { header: t('practitioners.table.email', 'Email'), accessor: 'email', priority: 'low', width: 180 },
                  { header: t('practitioners.table.rating', 'Rating'), accessor: 'rating', priority: 'low', width: 100 }
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
                  email: value => value || '-',
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
