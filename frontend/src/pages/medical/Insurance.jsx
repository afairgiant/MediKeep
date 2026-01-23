import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { cleanPhoneNumber, formatPhoneNumber } from '../../utils/phoneUtils';
import { 
  initializeFormData as initFormData, 
  restructureFormData, 
  insuranceFieldConfig, 
  insuranceDefaultValues 
} from '../../utils/nestedFormUtils';
import { printInsuranceRecord } from '../../utils/printTemplateGenerator';
import logger from '../../services/logger';
import { notifications } from '@mantine/notifications';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  getUserFriendlyError
} from '../../constants/errorMessages';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import MantineFilters from '../../components/mantine/MantineFilters';
import { ResponsiveTable } from '../../components/adapters';
import ViewToggle from '../../components/shared/ViewToggle';
import StatusBadge from '../../components/medical/StatusBadge';
import InsuranceCard from '../../components/medical/insurance/InsuranceCard';
import InsuranceFormWrapper from '../../components/medical/insurance/InsuranceFormWrapper';
import InsuranceViewModal from '../../components/medical/insurance/InsuranceViewModal';
import DocumentManagerWithProgress from '../../components/shared/DocumentManagerWithProgress';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import EmptyState from '../../components/shared/EmptyState';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Divider,
  Modal,
  Title,
  Paper,
} from '@mantine/core';

const Insurance = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards');

  // Modern data management with useMedicalData
  const {
    items: insurances = [],
    currentPatient,
    loading = false,
    error,
    createItem = async () => {},
    updateItem = async () => {},
    deleteItem = async () => {},
    refreshData = () => {},
  } = useMedicalData({
    entityName: 'insurance',
    apiMethodsConfig: {
      getAll: signal => apiService.getInsurances(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientInsurances(patientId, signal),
      create: (data, signal) => apiService.createInsurance(data, signal),
      update: (id, data, signal) =>
        apiService.updateInsurance(id, data, signal),
      delete: (id, signal) => apiService.deleteInsurance(id, signal),
    },
    requiresPatient: true,
  }) || {};

  // Get configuration for filtering and sorting
  const config = getMedicalPageConfig('insurances');

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } = useEntityFileCounts('insurance', insurances);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingInsurance,
    openModal: handleViewInsurance,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: insurances,
    loading,
    onClose: (insurance) => {
      if (insurance) {
        refreshFileCount(insurance.id);
      }
    },
  });

  // Track if we need to refresh after form submission (but not after uploads)
  const needsRefreshAfterSubmissionRef = useRef(false);

  // Form submission with uploads hook
  const {
    submissionState,
    startSubmission,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    resetSubmission,
    isBlocking,
    canSubmit,
    statusMessage,
  } = useFormSubmissionWithUploads({
    entityType: 'insurance',
    onSuccess: () => {
      // Reset form and close modal on complete success
      setIsFormOpen(false);
      setEditingInsurance(null);
      setFormData(initializeFormData());
      setDocumentManagerMethods(null);

      // Only refresh if we created a new insurance during form submission
      // Don't refresh after uploads complete to prevent resource exhaustion
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }

      // IMPORTANT: Reset submission state after closing to prevent re-triggering
      // This prevents the useEffect in the hook from firing again when form reopens
      setTimeout(() => resetSubmission(), 0);
    },
    onError: (error) => {
      logger.error('insurance_form_error', {
        message: 'Form submission error in insurance',
        error,
        component: 'Insurance',
      });
    },
    component: 'Insurance',
  });

  // Data management (filtering, sorting, pagination)
  const dataManagement = useDataManagement(insurances || [], config) || {};
  
  const {
    data: processedInsurances = [],
    filters = {},
    updateFilter = () => {},
    clearFilters = () => {},
    hasActiveFilters = false,
    statusOptions = [],
    categoryOptions = [],
    dateRangeOptions = [],
    sortOptions = [],
    handleSortChange = () => {},
    sortBy = '',
    sortOrder = 'asc',
    getSortIndicator = () => '',
    totalCount = 0,
    filteredCount = 0,
  } = dataManagement;

  // Form state management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null);
  const [formData, setFormData] = useState({});

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);
  const [viewDocumentManagerMethods, setViewDocumentManagerMethods] = useState(null);

  // Table formatters - consistent with medication table approach
  const formatters = {
    insurance_type: (value, item) => (
      <Badge
        variant="light"
        color={
          item.insurance_type === 'medical' ? 'blue' :
          item.insurance_type === 'dental' ? 'green' :
          item.insurance_type === 'vision' ? 'purple' : 'orange'
        }
        size="sm"
      >
        {item.insurance_type?.charAt(0).toUpperCase() + item.insurance_type?.slice(1)}
      </Badge>
    ),
    company_name: (value) => <Text size="sm">{value || '-'}</Text>,
    plan_name: (value) => <Text size="sm">{value || '-'}</Text>,
    member_id: (value) => <Text size="sm" fw={600}>{value || '-'}</Text>,
    group_number: (value) => <Text size="sm">{value || '-'}</Text>,
    member_name: (value) => <Text size="sm">{value || '-'}</Text>,
    effective_date: (value) => <Text size="sm">{value ? formatDate(value) : '-'}</Text>,
    expiration_date: (value) => <Text size="sm">{value ? formatDate(value) : 'Ongoing'}</Text>,
    status: (value, item) => <StatusBadge status={item.status} />,
    is_primary: (value, item) => {
      if (item.is_primary) {
        return <Badge color="green" variant="filled" size="sm">Yes</Badge>;
      }
      return <Badge color="gray" variant="light" size="sm">No</Badge>;
    },
  };


  // Initialize form data using utility
  const initializeFormData = (insurance = null) => {
    return initFormData(insurance, insuranceFieldConfig, insuranceDefaultValues);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Start submission immediately to prevent race conditions
    startSubmission();

    if (!canSubmit) {
      logger.warn('insurance_race_condition_prevented', {
        message: 'Form submission prevented due to race condition',
        component: 'Insurance',
      });
      return;
    }

    try {
      // Use utility to restructure form data
      const submitData = restructureFormData(formData, insuranceFieldConfig);
      
      // Only add patient_id for new insurance (create), not for updates
      if (!editingInsurance) {
        submitData.patient_id = currentPatient?.id;
      }

      let success;
      let resultId;

      // Submit form data
      if (editingInsurance) {
        logger.info('Updating insurance', {
          insuranceId: editingInsurance.id,
          insurance_type: formData.insurance_type,
          company: formData.company_name
        });
        success = await updateItem(editingInsurance.id, submitData);
        resultId = editingInsurance.id;
        // No refresh needed for updates - user stays on same page
      } else {
        logger.info('Creating new insurance', {
          insurance_type: formData.insurance_type,
          company: formData.company_name
        });
        const result = await createItem(submitData);
        success = !!result;
        resultId = result?.id;
        // Set flag to refresh after new insurance creation (but only after form submission, not uploads)
        if (success) {
          needsRefreshAfterSubmissionRef.current = true;
        }
      }

      // Complete form submission
      completeFormSubmission(success, resultId);

      if (success && resultId) {
        // Check if we have files to upload
        const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();
        
        if (hasPendingFiles) {
          logger.info('insurance_starting_file_upload', {
            message: 'Starting file upload process',
            insuranceId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'Insurance',
          });

          // Start file upload process
          startFileUpload();

          try {
            // Upload files with progress tracking
            await documentManagerMethods.uploadPendingFiles(resultId);
            
            // File upload completed successfully
            completeFileUpload(true, documentManagerMethods.getPendingFilesCount(), 0);
            
            // Refresh file count
            refreshFileCount(resultId);
          } catch (uploadError) {
            logger.error('insurance_file_upload_error', {
              message: 'File upload failed',
              insuranceId: resultId,
              error: uploadError.message,
              component: 'Insurance',
            });
            
            // File upload failed
            completeFileUpload(false, 0, documentManagerMethods.getPendingFilesCount());
          }
        } else {
          // No files to upload, complete immediately
          completeFileUpload(true, 0, 0);
        }
      }
    } catch (error) {
      logger.error('insurance_submission_error', {
        message: 'Form submission failed',
        error: error.message,
        component: 'Insurance',
      });
      
      // Check if it's a validation error
      if (error.validationErrors) {
        handleSubmissionFailure(error.validationErrors.join('\n'), 'form');
      } else {
        handleSubmissionFailure(error, 'form');
      }
    }
  };

  // Handle edit
  const handleEdit = (insurance) => {
    try {
      const initialFormData = initializeFormData(insurance);
      
      setEditingInsurance(insurance);
      setFormData(initialFormData);
      setIsFormOpen(true);
    } catch (error) {
      logger.error('Error initiating insurance edit:', error);
      notifications.show({
        title: 'Error',
        message: ERROR_MESSAGES.UNKNOWN_ERROR,
        color: 'red',
      });
    }
  };

  // Handle delete
  const handleDelete = async (insuranceOrId) => {
    // Handle both ID (from table) and full object (from card)
    const insuranceId = typeof insuranceOrId === 'object' ? insuranceOrId.id : insuranceOrId;
    const insurance = typeof insuranceOrId === 'object' ? insuranceOrId : 
      insurances.find(i => i.id === insuranceOrId);
    
    if (!insurance) {
      notifications.show({
        title: 'Error',
        message: ERROR_MESSAGES.ENTITY_NOT_FOUND,
        color: 'red',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete this ${insurance.insurance_type} insurance?`)) {
      const success = await deleteItem(insuranceId);
      if (success) {
        cleanupFileCount(insuranceId);
      }
    }
  };

  // Handle set primary
  const handleSetPrimary = async (insurance) => {
    try {
      logger.info('Setting insurance as primary', {
        insurance_id: insurance.id,
        insurance_type: insurance.insurance_type,
        company: insurance.company_name,
      });

      await apiService.setPrimaryInsurance(insurance.id);
      
      notifications.show({
        title: 'Primary Insurance Set',
        message: `${insurance.company_name} is now your primary ${insurance.insurance_type} insurance`,
        color: 'green',
      });

      // Refresh data to show updated primary status
      await refreshData();

      logger.info('Primary insurance set successfully', {
        insurance_id: insurance.id,
        insurance_type: insurance.insurance_type,
      });
    } catch (error) {
      logger.error('Error setting primary insurance:', error);
      notifications.show({
        title: 'Error',
        message: ERROR_MESSAGES.SERVER_ERROR,
        color: 'red',
      });
    }
  };

  // Handle add new
  const handleAddNew = () => {
    resetSubmission(); // Reset submission state
    setEditingInsurance(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setFormData(initializeFormData());
    setIsFormOpen(true);
  };

  // Handle close form
  const handleCloseForm = () => {
    // Prevent closing during upload
    if (isBlocking) {
      return;
    }
    
    resetSubmission(); // Reset submission state
    setIsFormOpen(false);
    setEditingInsurance(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setFormData(initializeFormData());
  };

  // Loading state
  if (loading) {
    return (
      <Container size="xl">
        <Center style={{ height: 400 }}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container size="xl">
        <Alert color="red" title="Error loading insurance records" style={{ whiteSpace: 'pre-line' }}>
          {getUserFriendlyError(error, 'load')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <PageHeader
        title={t('insurance.title', 'Insurance')}
        description={t('insurance.description', 'Manage your insurance information and digital cards')}
      />

      <Group justify="space-between" align="center">
        <Button variant="filled" onClick={handleAddNew}>
          {t('insurance.actions.addNew', '+ Add New Insurance')}
        </Button>

        <ViewToggle
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showPrint={true}
        />
      </Group>

      {/* Mantine Filter Controls */}
      <MantineFilters
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        statusOptions={statusOptions}
        categoryOptions={categoryOptions}
        dateRangeOptions={dateRangeOptions}
        sortOptions={sortOptions}
        sortBy={sortBy}
        sortOrder={sortOrder}
        handleSortChange={handleSortChange}
        totalCount={totalCount}
        filteredCount={filteredCount}
        config={config.filterControls}
      />

      {processedInsurances.length === 0 ? (
        <EmptyState
          emoji="🏥"
          title="No Insurance Found"
          hasActiveFilters={hasActiveFilters}
          filteredMessage="Try adjusting your search or filter criteria."
          noDataMessage="Start by adding your first insurance."
          actionButton={
            <Button variant="filled" onClick={handleAddNew}>
              Add Your First Insurance
            </Button>
          }
        />
      ) : (
        <>
          {viewMode === 'cards' ? (
            <Grid>
              {processedInsurances.map((insurance) => (
                <Grid.Col key={insurance.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <InsuranceCard
                    insurance={insurance}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                    onView={handleViewInsurance}
                    fileCount={fileCounts[insurance.id] || 0}
                    fileCountLoading={fileCountsLoading[insurance.id] || false}
                  />
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
              data={processedInsurances}
              columns={[
                { header: 'Type', accessor: 'insurance_type', priority: 'high', width: 100 },
                { header: 'Company', accessor: 'company_name', priority: 'high', width: 180 },
                { header: 'Plan', accessor: 'plan_name', priority: 'medium', width: 150 },
                { header: 'Member ID', accessor: 'member_id', priority: 'high', width: 120 },
                { header: 'Group #', accessor: 'group_number', priority: 'low', width: 120 },
                { header: 'Member Name', accessor: 'member_name', priority: 'medium', width: 150 },
                { header: 'Effective', accessor: 'effective_date', priority: 'medium', width: 100 },
                { header: 'Expires', accessor: 'expiration_date', priority: 'medium', width: 100 },
                { header: 'Status', accessor: 'status', priority: 'high', width: 90 },
                { header: 'Primary', accessor: 'is_primary', priority: 'high', width: 80 },
              ]}
              formatters={formatters}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleViewInsurance}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              getSortIndicator={getSortIndicator}
              dataType="medical"
              responsive={responsive}
            />
          </Paper>
          )}
        </>
      )}

      {/* Form Modal */}
      <InsuranceFormWrapper
        isOpen={isFormOpen}
        onClose={() => {
          if (!isBlocking) {
            resetSubmission();
            setIsFormOpen(false);
            setEditingInsurance(null);
            setDocumentManagerMethods(null);
            setFormData(initializeFormData());
          }
        }}
        title={editingInsurance ? t('insurance.form.editTitle', 'Edit Insurance') : t('insurance.form.addTitle', 'Add New Insurance')}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingInsurance}
        onFileUploadComplete={(success) => {
          if (success && editingInsurance) {
            refreshFileCount(editingInsurance.id);
          }
        }}
      >
        {/* Form Loading Overlay */}
        <FormLoadingOverlay
          visible={isBlocking}
          message={statusMessage?.title || 'Processing...'}
          submessage={statusMessage?.message}
          type={statusMessage?.type || 'loading'}
        />
      </InsuranceFormWrapper>

      {/* View Modal */}
      <InsuranceViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        insurance={viewingInsurance}
        onEdit={handleEdit}
        onPrint={(insurance) => {
          printInsuranceRecord(
            insurance,
            () => {
              notifications.show({
                title: 'Print Ready',
                message: 'Complete insurance details sent to printer',
                color: 'blue',
              });
            },
            (error) => {
              notifications.show({
                title: 'Print Error',
                message: ERROR_MESSAGES.FILE_PROCESSING_FAILED,
                color: 'red',
              });
            }
          );
        }}
        onSetPrimary={handleSetPrimary}
        onFileUploadComplete={(success) => {
          if (success && viewingInsurance) {
            refreshFileCount(viewingInsurance.id);
          }
        }}
      />
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Insurance, {
  injectResponsive: true,
  displayName: 'ResponsiveInsurance'
});