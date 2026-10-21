import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Stack, Container, Paper } from '@mantine/core';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useResponsive } from '../../hooks/useResponsive';
import { usePagination } from '../../hooks/usePagination';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useDateFormat } from '../../hooks/useDateFormat';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { apiService } from '../../services/api';
import logger from '../../services/logger';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { ResponsiveTable } from '../../components/adapters';
import PaginationControls from '../../components/shared/PaginationControls';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import {
  BloodDonationCard,
  BloodDonationFormWrapper,
  BloodDonationViewModal,
  BloodDonationEligibilityCard,
} from '../../components/medical/blood-donations';
import {
  formatBloodPressure,
  formatHemoglobin,
} from '../../components/medical/blood-donations/BloodDonationCard';
import {
  getDonationTypeLabel,
  getDonationTypeOptions,
  SCREENING_RANGES,
} from '../../constants/bloodDonationConstants';
import {
  convertForDisplay,
  convertForStorage,
  validationRanges,
} from '../../utils/unitConversion';

const EMPTY_FORM_DATA = {
  donation_date: '',
  donation_type: 'whole_blood',
  location: '',
  systolic_bp: '',
  diastolic_bp: '',
  temperature: '',
  hemoglobin: '',
  notes: '',
  tags: [],
};

const toNumberOrNull = value =>
  value === '' || value === null || value === undefined ? null : Number(value);

const useEligibility = (patientId, donations) => {
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityError, setEligibilityError] = useState(false);

  useEffect(() => {
    // Clear any previous patient's eligibility immediately so switching
    // patients never leaves the old card (or error state) on screen while
    // the new request is in flight, or when there is no patient at all.
    setEligibility(null);
    setEligibilityError(false);

    if (!patientId) return undefined;
    const controller = new AbortController();
    apiService
      .getBloodDonationEligibility(patientId, controller.signal)
      .then(data => {
        setEligibility(data);
        setEligibilityError(false);
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        logger.error('blood_donation_eligibility_error', {
          message: 'Failed to load blood donation eligibility',
          error: err?.message,
          component: 'BloodDonations',
        });
        setEligibilityError(true);
      });
    return () => controller.abort();
  }, [patientId, donations]);

  return { eligibility, eligibilityError };
};

const BloodDonations = () => {
  const responsive = useResponsive();
  const { t } = useTranslation(['medical', 'shared']);
  const { formatDate } = useDateFormat();
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const { unitSystem } = useUserPreferences();
  const [viewMode, setViewMode] = usePersistedViewMode('blood-donations');
  const {
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    paginateData,
    totalPages,
    resetPage,
    clampPage,
    PAGE_SIZE_OPTIONS,
  } = usePagination();

  const {
    items: donations,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'blood_donation',
    entityLabel: t('medical:entityNames.bloodDonation', 'blood donation'),
    apiMethodsConfig: {
      getAll: signal => apiService.getBloodDonations(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientBloodDonations(patientId, signal),
      create: (data, signal) => apiService.createBloodDonation(data, signal),
      update: (id, data, signal) =>
        apiService.updateBloodDonation(id, data, signal),
      delete: (id, signal) => apiService.deleteBloodDonation(id, signal),
    },
    requiresPatient: true,
  });

  const { eligibility, eligibilityError } = useEligibility(
    currentPatient?.id,
    donations
  );

  const locationSuggestions = React.useMemo(
    () =>
      [
        ...new Set(
          (donations || [])
            .map(donation => donation.location?.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [donations]
  );

  const filterConfig = React.useMemo(
    () => ({
      filtering: {
        searchFields: ['location', 'notes'],
        typeField: 'donation_type',
        typeOptions: [
          {
            value: 'all',
            label: t('bloodDonations.filters.allTypes', 'All Types'),
          },
          ...getDonationTypeOptions(t),
        ],
        categoryField: 'location',
        categoryOptions: [
          {
            value: 'all',
            label: t('bloodDonations.filters.allLocations', 'All Locations'),
          },
          ...locationSuggestions.map(location => ({
            value: location,
            label: location,
          })),
        ],
        dateField: 'donation_date',
      },
      sorting: {
        defaultSortBy: 'donation_date',
        defaultSortOrder: 'desc',
        sortOptions: [
          {
            value: 'donation_date',
            label: t('bloodDonations.fields.donationDate', 'Donation Date'),
          },
          {
            value: 'donation_type',
            label: t('bloodDonations.fields.donationType', 'Donation Type'),
          },
          {
            value: 'location',
            label: t('bloodDonations.fields.location', 'Location'),
          },
        ],
        sortTypes: {
          donation_date: 'date',
          donation_type: 'string',
          location: 'string',
        },
      },
      filterControls: {
        searchPlaceholder: 'searchPlaceholders.generic',
        showStatus: false,
        showType: true,
        showCategory: true,
        showDateRange: true,
        typePlaceholder: t(
          'bloodDonations.fields.donationType',
          'Donation Type'
        ),
        categoryPlaceholder: t('bloodDonations.fields.location', 'Location'),
      },
    }),
    [t, locationSuggestions]
  );
  const dataManagement = useDataManagement(donations, filterConfig);

  const {
    isOpen: showViewModal,
    viewingItem: viewingDonation,
    openModal: handleViewDonation,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({ items: donations, loading });

  const [showModal, setShowModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

  const handleAddDonation = () => {
    setEditingDonation(null);
    setFormData(EMPTY_FORM_DATA);
    setShowModal(true);
  };

  const handleEditDonation = donation => {
    setEditingDonation(donation);
    setFormData({
      donation_date: donation.donation_date || '',
      donation_type: donation.donation_type || 'whole_blood',
      location: donation.location || '',
      systolic_bp: donation.systolic_bp ?? '',
      diastolic_bp: donation.diastolic_bp ?? '',
      temperature:
        convertForDisplay(donation.temperature, 'temperature', unitSystem) ??
        '',
      hemoglobin: donation.hemoglobin ?? '',
      notes: donation.notes || '',
      tags: donation.tags || [],
    });
    setShowModal(true);
  };

  const handleDeleteDonation = async donationId => {
    const success = await deleteItem(donationId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.donation_date) {
      setError(
        t('bloodDonations.validation.dateRequired', 'Donation date is required')
      );
      return;
    }
    if (!formData.donation_type) {
      setError(
        t('bloodDonations.validation.typeRequired', 'Donation type is required')
      );
      return;
    }
    if (!currentPatient?.id) {
      setError(
        t(
          'shared:labels.patientInfoNotAvailable',
          'Patient information not available'
        )
      );
      return;
    }

    const systolic = toNumberOrNull(formData.systolic_bp);
    const diastolic = toNumberOrNull(formData.diastolic_bp);
    const temperature = toNumberOrNull(formData.temperature);
    const hemoglobin = toNumberOrNull(formData.hemoglobin);

    // NumberInput only clamps min/max on blur, so re-validate here before
    // sending anything to the API.
    const temperatureRange = validationRanges[unitSystem].temperature;
    const outOfRangeChecks = [
      {
        value: systolic,
        min: SCREENING_RANGES.systolic_bp.min,
        max: SCREENING_RANGES.systolic_bp.max,
        fieldKey: 'bloodDonations.fields.systolic',
        fallback: 'Systolic (mmHg)',
      },
      {
        value: diastolic,
        min: SCREENING_RANGES.diastolic_bp.min,
        max: SCREENING_RANGES.diastolic_bp.max,
        fieldKey: 'bloodDonations.fields.diastolic',
        fallback: 'Diastolic (mmHg)',
      },
      {
        value: hemoglobin,
        min: SCREENING_RANGES.hemoglobin.min,
        max: SCREENING_RANGES.hemoglobin.max,
        fieldKey: 'bloodDonations.fields.hemoglobinWithUnit',
        fallback: 'Hemoglobin (g/dL)',
      },
      {
        value: temperature,
        min: temperatureRange.min,
        max: temperatureRange.max,
        fieldKey: 'bloodDonations.fields.temperature',
        fallback: 'Temperature',
      },
    ];

    for (const check of outOfRangeChecks) {
      if (
        check.value !== null &&
        (check.value < check.min || check.value > check.max)
      ) {
        setError(
          t('bloodDonations.validation.outOfRange', {
            field: t(check.fieldKey, check.fallback),
            min: check.min,
            max: check.max,
            defaultValue: `{{field}} must be between {{min}} and {{max}}`,
          })
        );
        return;
      }
    }

    if (systolic !== null && diastolic !== null && systolic <= diastolic) {
      setError(
        t(
          'bloodDonations.validation.bpOrder',
          'Systolic must be greater than diastolic'
        )
      );
      return;
    }

    const donationData = {
      donation_date: formData.donation_date,
      donation_type: formData.donation_type,
      location: formData.location || null,
      systolic_bp: systolic,
      diastolic_bp: diastolic,
      temperature: convertForStorage(
        formData.temperature,
        'temperature',
        unitSystem
      ),
      hemoglobin,
      notes: formData.notes || null,
      tags: formData.tags || [],
      patient_id: currentPatient.id,
    };

    const success = editingDonation
      ? await updateItem(editingDonation.id, donationData)
      : await createItem(donationData);

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredDonations = dataManagement.data;
  const paginatedDonations = paginateData(filteredDonations);

  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => {
    clampPage(filteredDonations.length);
  }, [filteredDonations.length, clampPage]);

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('bloodDonations.loading', 'Loading blood donations...')}
        hint={t(
          'shared:labels.ifThisTakesTooLongPleaseRefreshThePage',
          'If this takes too long, please refresh the page'
        )}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="sm">
        <PageHeader
          title={t('shared:categories.blood_donations', 'Blood Donations')}
          icon="🩸"
        />

        <Stack gap="sm" mt="md">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />

          <BloodDonationEligibilityCard
            eligibility={eligibility}
            error={eligibilityError}
          />

          <MedicalPageActions
            primaryAction={{
              label: t('bloodDonations.add', '+ Add Donation'),
              onClick: handleAddDonation,
              size: 'sm',
              disabled: isViewOnly,
              tooltip: viewOnlyTooltip,
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewToggleSize="sm"
            mb={0}
          />

          <MedicalPageFilters
            dataManagement={dataManagement}
            config={filterConfig}
          />

          {filteredDonations.length === 0 ? (
            <EmptyState
              emoji="🩸"
              title={t('bloodDonations.noneFound', 'No Blood Donations Found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t(
                'shared:emptyStates.adjustSearch',
                'Try adjusting your search or filter criteria.'
              )}
              noDataMessage={t(
                'bloodDonations.startAdding',
                'Start by logging your first blood donation.'
              )}
              actionButton={
                <Button
                  variant="filled"
                  onClick={handleAddDonation}
                  disabled={isViewOnly}
                >
                  {t('bloodDonations.addFirst', 'Log Your First Donation')}
                </Button>
              }
            />
          ) : (
            <>
              {viewMode === 'cards' ? (
                <AnimatedCardGrid
                  items={paginatedDonations}
                  columns={{ base: 12, sm: 6, lg: 4 }}
                  renderCard={donation => (
                    <BloodDonationCard
                      donation={donation}
                      unitSystem={unitSystem}
                      onEdit={handleEditDonation}
                      onDelete={handleDeleteDonation}
                      onView={handleViewDonation}
                      disableActions={isViewOnly}
                      disableActionsTooltip={viewOnlyTooltip}
                    />
                  )}
                />
              ) : (
                <Paper shadow="sm" radius="md" withBorder>
                  <ResponsiveTable
                    persistKey="blood-donations"
                    data={paginatedDonations}
                    pagination={false}
                    disableEdit={isViewOnly}
                    disableDelete={isViewOnly}
                    disableActionsTooltip={viewOnlyTooltip}
                    columns={[
                      {
                        header: t(
                          'bloodDonations.fields.donationDate',
                          'Donation Date'
                        ),
                        accessor: 'donation_date',
                        priority: 'high',
                        width: 130,
                        render: value => formatDate(value),
                      },
                      {
                        header: t(
                          'bloodDonations.fields.donationType',
                          'Donation Type'
                        ),
                        accessor: 'donation_type',
                        priority: 'high',
                        width: 150,
                        render: value => getDonationTypeLabel(value, t),
                      },
                      {
                        header: t('bloodDonations.fields.location', 'Location'),
                        accessor: 'location',
                        priority: 'medium',
                        width: 180,
                      },
                      {
                        header: t(
                          'bloodDonations.fields.bloodPressure',
                          'Blood Pressure'
                        ),
                        accessor: 'blood_pressure',
                        priority: 'low',
                        width: 130,
                        render: (value, row) => formatBloodPressure(row) || '',
                      },
                      {
                        header: t(
                          'bloodDonations.fields.hemoglobin',
                          'Hemoglobin'
                        ),
                        accessor: 'hemoglobin',
                        priority: 'low',
                        width: 120,
                        render: value => formatHemoglobin(value) || '',
                      },
                    ]}
                    patientData={currentPatient}
                    tableName={t(
                      'shared:categories.blood_donations',
                      'Blood Donations'
                    )}
                    onView={handleViewDonation}
                    onEdit={handleEditDonation}
                    onDelete={handleDeleteDonation}
                    dataType="medical"
                    responsive={responsive}
                  />
                </Paper>
              )}
              <PaginationControls
                page={page}
                totalPages={totalPages(filteredDonations.length)}
                pageSize={pageSize}
                totalRecords={filteredDonations.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </Stack>
      </Container>

      <BloodDonationFormWrapper
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingDonation
            ? t('bloodDonations.editTitle', 'Edit Blood Donation')
            : t('bloodDonations.addTitle', 'Add Blood Donation')
        }
        editingDonation={editingDonation}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        unitSystem={unitSystem}
        locationSuggestions={locationSuggestions}
      />

      <BloodDonationViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        donation={viewingDonation}
        onEdit={handleEditDonation}
        unitSystem={unitSystem}
        disableEdit={isViewOnly}
        disableEditTooltip={viewOnlyTooltip}
      />
    </>
  );
};

export default withResponsive(BloodDonations, {
  injectResponsive: true,
  displayName: 'ResponsiveBloodDonations',
});
