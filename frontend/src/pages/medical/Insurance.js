import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
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
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import StatusBadge from '../../components/medical/StatusBadge';
import InsuranceCard from '../../components/medical/insurance/InsuranceCard';
import InsuranceFormWrapper from '../../components/medical/insurance/InsuranceFormWrapper';
import InsuranceViewModal from '../../components/medical/insurance/InsuranceViewModal';
import DocumentManager from '../../components/shared/DocumentManager';
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
  const navigate = useNavigate();
  const location = useLocation();
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

  // View modal state management
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingInsurance, setViewingInsurance] = useState(null);

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

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
      >
        {item.insurance_type?.charAt(0).toUpperCase() + item.insurance_type?.slice(1)}
      </Badge>
    ),
    company_name: (value, item) => (
      <div>
        <Text weight={500}>{item.company_name}</Text>
        {item.plan_name && <Text size="xs" color="dimmed">{item.plan_name}</Text>}
      </div>
    ),
    member_name: (value, item) => (
      <div>
        <Text>{item.member_name}</Text>
        <Text size="xs" color="dimmed">ID: {item.member_id}</Text>
      </div>
    ),
    effective_date: (value, item) => (
      <div>
        <Text size="sm">
          {formatDate(item.effective_date)} - {item.expiration_date ? formatDate(item.expiration_date) : 'Ongoing'}
        </Text>
      </div>
    ),
    status: (value, item) => <StatusBadge status={item.status} />,
    is_primary: (value, item) => {
      if (item.insurance_type === 'medical' && value) {
        return 'PRIMARY';
      }
      return '';
    },
  };

  // Table configuration - consistent with medication table approach
  const tableColumns = [
    {
      accessor: 'insurance_type',
      header: 'Type',
      sortable: true,
    },
    {
      accessor: 'company_name',
      header: 'Company',
      sortable: true,
    },
    {
      accessor: 'member_name',
      header: 'Member',
      sortable: true,
    },
    {
      accessor: 'effective_date',
      header: 'Coverage Period',
      sortable: true,
    },
    {
      accessor: 'status',
      header: 'Status',
      sortable: true,
    },
    {
      accessor: 'is_primary',
      header: 'Primary',
    },
  ];

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
    try {
      // Use utility to restructure form data
      const submitData = restructureFormData(formData, insuranceFieldConfig);
      
      // Only add patient_id for new insurance (create), not for updates
      if (!editingInsurance) {
        submitData.patient_id = currentPatient?.id;
      }

      let success;
      let resultId;

      if (editingInsurance) {
        logger.info('Updating insurance', {
          insuranceId: editingInsurance.id,
          insurance_type: formData.insurance_type,
          company: formData.company_name
        });
        success = await updateItem(editingInsurance.id, submitData);
        resultId = editingInsurance.id;
        
        if (success) {
          notifications.show({
            title: 'Insurance Updated',
            message: `${formData.insurance_type} insurance updated successfully`,
            color: 'green',
          });
        }
      } else {
        logger.info('Creating new insurance', {
          insurance_type: formData.insurance_type,
          company: formData.company_name
        });
        const result = await createItem(submitData);
        success = !!result;
        resultId = result?.id;
      }

      if (success && resultId) {
        // Debug: Check if documentManagerMethods is available
        logger.info('insurance_checking_file_methods', {
          message: 'Checking document manager methods availability',
          insuranceId: resultId,
          isEditMode: !!editingInsurance,
          hasDocumentManagerMethods: !!documentManagerMethods,
          hasPendingFiles: documentManagerMethods?.hasPendingFiles?.(),
          pendingFilesCount: documentManagerMethods?.getPendingFilesCount?.(),
          availableMethods: documentManagerMethods ? Object.keys(documentManagerMethods) : [],
          component: 'Insurance',
        });

        // Handle background file upload for create mode
        if (!editingInsurance && documentManagerMethods?.hasPendingFiles()) {
          logger.info('insurance_starting_file_upload', {
            message: 'Starting background file upload process',
            insuranceId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'Insurance',
          });

          // Show success message immediately
          const fileCount = documentManagerMethods.getPendingFilesCount();
          notifications.show({
            title: 'Insurance Added',
            message: `${formData.insurance_type} insurance added successfully. ${fileCount} file(s) are being uploaded in the background...`,
            color: 'green',
          });
          
          // Upload files in the background - DON'T close form until upload is complete
          try {
            await documentManagerMethods.uploadPendingFiles(resultId);
            notifications.show({
              title: 'Files Uploaded',
              message: 'Insurance and all files saved successfully!',
              color: 'green',
            });
            
            // Refresh data to show uploaded files
            await refreshData();
            
            // Update the file count for this specific insurance
            try {
              const files = await apiService.getEntityFiles('insurance', resultId);
              logger.info('file_count_updated', {
                message: 'Updated file count after background upload',
                insuranceId: resultId,
                fileCount: files.length,
                component: 'Insurance',
              });
            } catch (fileCountError) {
              logger.warn('file_count_update_error', {
                message: 'Failed to update file count after upload',
                insuranceId: resultId,
                error: fileCountError.message,
                component: 'Insurance',
              });
            }
          } catch (error) {
            logger.error('background_file_upload_error', {
              message: 'Failed to upload files in background',
              insuranceId: resultId,
              error: error.message,
              component: 'Insurance',
            });
            notifications.show({
              title: 'File Upload Error',
              message: `Insurance created but file upload failed: ${error.message}`,
              color: 'red',
            });
            // Still close the form even if file upload fails
          }
        } else if (!editingInsurance) {
          notifications.show({
            title: 'Insurance Added',
            message: `${formData.insurance_type} insurance added successfully`,
            color: 'green',
          });
        }

        // Close form and reset
        setIsFormOpen(false);
        setEditingInsurance(null);
        setFormData(initializeFormData());
        
        // Refresh the data to show the new insurance
        await refreshData();
      }
    } catch (error) {
      logger.error('Error saving insurance:', error);
      
      // Check if it's a validation error
      if (error.validationErrors) {
        notifications.show({
          title: 'Validation Error',
          message: error.validationErrors.join('\n'),
          color: 'red',
          autoClose: 8000, // Give more time to read validation errors
        });
      } else {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to save insurance information',
          color: 'red',
        });
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
        message: 'Failed to open edit form',
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
        message: 'Insurance not found',
        color: 'red',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete this ${insurance.insurance_type} insurance?`)) {
      const success = await deleteItem(insuranceId);
      if (success) {
        await refreshData();
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
        message: 'Failed to set as primary insurance',
        color: 'red',
      });
    }
  };

  // Handle add new
  const handleAddNew = () => {
    setEditingInsurance(null);
    setFormData(initializeFormData());
    setIsFormOpen(true);
  };

  // Handle close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingInsurance(null);
    setFormData(initializeFormData());
  };

  // Handle view insurance
  const handleViewInsurance = (insurance) => {
    try {
      setViewingInsurance(insurance);
      setShowViewModal(true);
      
      // Add view parameter to URL for deep linking
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('view', insurance.id);
      navigate({ search: searchParams.toString() }, { replace: true });
    } catch (error) {
      logger.error('Error opening insurance view modal:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to open insurance details',
        color: 'red',
      });
    }
  };

  // Handle close view modal
  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingInsurance(null);
    
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    navigate({ search: searchParams.toString() }, { replace: true });
  };

  // Handle URL view parameter for deep linking
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');
    
    if (viewId && insurances.length > 0 && !loading) {
      const insurance = insurances.find(i => i.id.toString() === viewId);
      if (insurance && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingInsurance(insurance);
        setShowViewModal(true);
      }
    }
  }, [location.search, insurances, loading, showViewModal]);

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
        <Alert color="red" title="Error loading insurance records">
          {error.message || 'Failed to load insurance data'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <PageHeader
        title="Insurance"
        description="Manage your insurance information and digital cards"
      />

      <Group justify="space-between" align="center">
        <Button variant="filled" onClick={handleAddNew}>
          + Add New Insurance
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
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <Text size="3rem">🏥</Text>
            <Text size="xl" fw={600}>
              No Insurance Found
            </Text>
            <Text ta="center" c="dimmed">
              {hasActiveFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first insurance.'}
            </Text>
            {!hasActiveFilters && (
              <Button variant="filled" onClick={handleAddNew}>
                Add Your First Insurance
              </Button>
            )}
          </Stack>
        </Card>
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
                  />
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <MedicalTable
              data={processedInsurances}
              columns={tableColumns}
              formatters={formatters}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleViewInsurance}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              getSortIndicator={getSortIndicator}
            />
          )}
        </>
      )}

      {/* Form Modal */}
      <InsuranceFormWrapper
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingInsurance ? 'Edit Insurance' : 'Add New Insurance'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingInsurance}
      >
        {/* File Management Section for Both Create and Edit Mode */}
        <Paper withBorder p="md" mt="md">
          <Title order={4} mb="md">
            {editingInsurance ? 'Manage Files' : 'Add Files (Optional)'}
          </Title>
          <DocumentManager
            entityType="insurance"
            entityId={editingInsurance?.id}
            mode={editingInsurance ? 'edit' : 'create'}
            config={{
              acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
              maxSize: 10 * 1024 * 1024, // 10MB
              maxFiles: 10
            }}
            onUploadPendingFiles={setDocumentManagerMethods}
            onError={(error) => {
              logger.error('document_manager_error', {
                message: `Document manager error in insurance ${editingInsurance ? 'edit' : 'create'}`,
                insuranceId: editingInsurance?.id,
                error: error,
                component: 'Insurance',
              });
            }}
          />
        </Paper>
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
                message: 'Failed to prepare insurance details for printing',
                color: 'red',
              });
            }
          );
        }}
        onSetPrimary={handleSetPrimary}
      />
    </Container>
  );
};

export default Insurance;