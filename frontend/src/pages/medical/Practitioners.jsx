import React, { useState, useEffect, useMemo } from 'react';
import {
  ActionIcon,
  Accordion,
  Container,
  Group,
  Paper,
  Switch,
  Text,
  Title,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconEdit,
  IconPlus,
  IconShieldCheck,
  IconUser,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
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
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { useDateFormat } from '../../hooks/useDateFormat';
import frontendLogger from '../../services/frontendLogger';
import { useTranslation } from 'react-i18next';

// Modular components
import PractitionerCard from '../../components/medical/practitioners/PractitionerCard';
import PractitionerViewModal from '../../components/medical/practitioners/PractitionerViewModal';
import PractitionerFormWrapper from '../../components/medical/practitioners/PractitionerFormWrapper';
import PracticeEditModal from '../../components/medical/practitioners/PracticeEditModal';

const Practitioners = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const [viewMode, setViewMode] = usePersistedViewMode('cards');
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

  // Get standardized formatters for practitioners
  const defaultFormatters = getEntityFormatters('default', [], navigate, null, formatDate);
  const [editingPractitioner, setEditingPractitioner] = useState(null);
  const [groupByPractice, setGroupByPractice] = useState(false);
  const [practiceEditData, setPracticeEditData] = useState(null);
  const [showPracticeEditModal, setShowPracticeEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    practice_id: '',
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
      practice_id: '',
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
      practice_id: practitioner.practice_id ? String(practitioner.practice_id) : '',
      phone_number: practitioner.phone_number || '',
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
        practice_id:
          formData.practice_id && formData.practice_id !== ''
            ? parseInt(formData.practice_id, 10)
            : null,
        phone_number: formData.phone_number?.trim() || null,
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
      // Remove legacy practice field if present
      delete dataToSubmit.practice;

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

  const handleEditPractice = async (practiceId) => {
    try {
      const data = await apiService.getPractice(practiceId);
      setPracticeEditData(data);
      setShowPracticeEditModal(true);
    } catch {
      notifications.show({
        title: t('labels.error'),
        message: t('practitioners.editPracticeError', 'Failed to load practice for editing'),
        color: 'red',
      });
    }
  };

  const handlePracticeSaved = () => {
    refresh();
  };

  const filteredPractitioners = dataManagement.data;

  // Group practitioners by practice when toggle is on
  const groupedPractitioners = useMemo(() => {
    if (!groupByPractice) return null;

    const groups = {};
    const ungrouped = [];

    filteredPractitioners.forEach(p => {
      if (p.practice_id && p.practice_name) {
        if (!groups[p.practice_id]) {
          groups[p.practice_id] = {
            id: p.practice_id,
            name: p.practice_name,
            practitioners: [],
          };
        }
        groups[p.practice_id].practitioners.push(p);
      } else {
        ungrouped.push(p);
      }
    });

    return {
      practices: Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)),
      ungrouped,
    };
  }, [groupByPractice, filteredPractitioners]);

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

        {/* Group by Practice Toggle */}
        <Group>
          <Switch
            label={t('practitioners.groupByPractice', 'Group by Practice')}
            checked={groupByPractice}
            onChange={(event) => setGroupByPractice(event.currentTarget.checked)}
            size="sm"
          />
        </Group>

        {/* Content */}
          {filteredPractitioners.length === 0 ? (
            <EmptyState
              icon={IconShieldCheck}
              title={t('practitioners.empty.title', 'No healthcare practitioners found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('practitioners.empty.filtered', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('practitioners.empty.noData', 'Click "Add New Practitioner" to get started.')}
            />
          ) : groupByPractice && groupedPractitioners ? (
            <Accordion variant="separated" multiple defaultValue={groupedPractitioners.practices.map(g => String(g.id))}>
              {groupedPractitioners.practices.map(group => (
                <Accordion.Item key={group.id} value={String(group.id)}>
                  <Accordion.Control>
                    <Group gap="xs" justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                      <Group gap="xs">
                        <IconBuilding size={18} />
                        <Text fw={600}>{group.name}</Text>
                        <Text size="sm" c="dimmed">({group.practitioners.length})</Text>
                      </Group>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={(e) => { e.stopPropagation(); handleEditPractice(group.id); }}
                        title={t('practitioners.viewModal.editPractice')}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {viewMode === 'cards' ? (
                      <AnimatedCardGrid
                        items={group.practitioners}
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
                          persistKey={`practitioners-group-${group.id}`}
                          data={group.practitioners}
                          columns={[
                            { header: t('practitioners.table.name', 'Name'), accessor: 'name', priority: 'high', width: 200 },
                            { header: t('practitioners.table.specialty', 'Specialty'), accessor: 'specialty', priority: 'high', width: 150 },
                            { header: t('practitioners.table.phone', 'Phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                            { header: t('practitioners.table.email', 'Email'), accessor: 'email', priority: 'low', width: 180 },
                            { header: t('practitioners.table.rating', 'Rating'), accessor: 'rating', priority: 'low', width: 100 }
                          ]}
                          tableName={group.name}
                          onView={handleViewPractitioner}
                          onEdit={handleEditPractitioner}
                          onDelete={handleDeletePractitioner}
                          formatters={{
                            name: defaultFormatters.primaryName,
                            specialty: defaultFormatters.simple,
                            phone_number: value => value || '-',
                            email: value => value || '-',
                            rating: value => value !== null && value !== undefined ? `${value}/5` : '-',
                          }}
                          dataType="medical"
                          responsive={responsive}
                        />
                      </Paper>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
              {groupedPractitioners.ungrouped.length > 0 && (
                <Accordion.Item value="ungrouped">
                  <Accordion.Control>
                    <Group gap="xs">
                      <IconUser size={18} />
                      <Text fw={600}>{t('practitioners.ungroupedTitle', 'Independent Practitioners')}</Text>
                      <Text size="sm" c="dimmed">({groupedPractitioners.ungrouped.length})</Text>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {viewMode === 'cards' ? (
                      <AnimatedCardGrid
                        items={groupedPractitioners.ungrouped}
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
                          persistKey="practitioners-ungrouped"
                          data={groupedPractitioners.ungrouped}
                          columns={[
                            { header: t('practitioners.table.name', 'Name'), accessor: 'name', priority: 'high', width: 200 },
                            { header: t('practitioners.table.specialty', 'Specialty'), accessor: 'specialty', priority: 'high', width: 150 },
                            { header: t('practitioners.table.phone', 'Phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                            { header: t('practitioners.table.email', 'Email'), accessor: 'email', priority: 'low', width: 180 },
                            { header: t('practitioners.table.rating', 'Rating'), accessor: 'rating', priority: 'low', width: 100 }
                          ]}
                          tableName={t('practitioners.ungroupedTitle', 'Independent Practitioners')}
                          onView={handleViewPractitioner}
                          onEdit={handleEditPractitioner}
                          onDelete={handleDeletePractitioner}
                          formatters={{
                            name: defaultFormatters.primaryName,
                            specialty: defaultFormatters.simple,
                            phone_number: value => value || '-',
                            email: value => value || '-',
                            rating: value => value !== null && value !== undefined ? `${value}/5` : '-',
                          }}
                          dataType="medical"
                          responsive={responsive}
                        />
                      </Paper>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              )}
            </Accordion>
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
                persistKey="practitioners"
                data={filteredPractitioners}
                columns={[
                  { header: t('practitioners.table.name', 'Name'), accessor: 'name', priority: 'high', width: 200 },
                  { header: t('practitioners.table.specialty', 'Specialty'), accessor: 'specialty', priority: 'high', width: 150 },
                  { header: t('practitioners.table.practice', 'Practice'), accessor: 'practice_name', priority: 'low', width: 150 },
                  { header: t('practitioners.table.phone', 'Phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                  { header: t('practitioners.table.email', 'Email'), accessor: 'email', priority: 'low', width: 180 },
                  { header: t('practitioners.table.rating', 'Rating'), accessor: 'rating', priority: 'low', width: 100 }
                ]}
                tableName={t('practitioners.title', 'Healthcare Practitioners')}
                onView={handleViewPractitioner}
                onEdit={handleEditPractitioner}
                onDelete={handleDeletePractitioner}
                formatters={{
                  name: defaultFormatters.primaryName,
                  specialty: defaultFormatters.simple,
                  practice_name: (value, row) => {
                    if (!value || !row.practice_id) return '-';
                    return (
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{value}</Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={(e) => { e.stopPropagation(); handleEditPractice(row.practice_id); }}
                          title={t('practitioners.viewModal.editPractice')}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Group>
                    );
                  },
                  phone_number: value => value || '-',
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

      <PracticeEditModal
        isOpen={showPracticeEditModal}
        onClose={() => { setShowPracticeEditModal(false); setPracticeEditData(null); }}
        practiceData={practiceEditData}
        onSaved={handlePracticeSaved}
      />
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Practitioners, {
  injectResponsive: true,
  displayName: 'ResponsivePractitioners'
});
