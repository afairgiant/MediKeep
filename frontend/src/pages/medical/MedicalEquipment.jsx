import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import logger from '../../services/logger';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import EquipmentCard from '../../components/medical/equipment/EquipmentCard';
import EquipmentViewModal from '../../components/medical/equipment/EquipmentViewModal';
import EquipmentFormWrapper from '../../components/medical/equipment/EquipmentFormWrapper';
import {
  EQUIPMENT_TYPE_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
} from '../../constants/equipmentConstants';
import {
  Button,
  Stack,
  Container,
} from '@mantine/core';

const EMPTY_FORM_DATA = {
  equipment_name: '',
  equipment_type: '',
  manufacturer: '',
  model_number: '',
  serial_number: '',
  prescribed_date: '',
  last_service_date: '',
  next_service_date: '',
  usage_instructions: '',
  status: 'active',
  supplier: '',
  notes: '',
  practitioner_id: '',
  tags: [],
};

// Simple filter/search configuration for equipment
const equipmentConfig = {
  searchFields: ['equipment_name', 'manufacturer', 'model_number', 'serial_number', 'supplier'],
  filterConfigs: [
    {
      field: 'status',
      label: 'Status',
      type: 'select',
      options: EQUIPMENT_STATUS_OPTIONS,
    },
    {
      field: 'equipment_type',
      label: 'Type',
      type: 'select',
      options: EQUIPMENT_TYPE_OPTIONS,
    },
  ],
};

// Simple data management hook for filtering
const useSimpleDataManagement = (data, config) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});

  const filteredData = React.useMemo(() => {
    let result = [...(data || [])];

    // Apply search
    if (searchTerm && config.searchFields) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item =>
        config.searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(lowerSearch);
        })
      );
    }

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(item => item[field] === value);
      }
    });

    return result;
  }, [data, searchTerm, filters, config.searchFields]);

  const hasActiveFilters = searchTerm || Object.values(filters).some(v => v);

  return {
    data: filteredData,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    hasActiveFilters,
    clearFilters: () => {
      setSearchTerm('');
      setFilters({});
    },
  };
};

const MedicalEquipment = () => {
  const { t } = useTranslation('common');
  const [viewMode, setViewMode] = usePersistedViewMode('cards');

  // Get practitioners data
  const { practitioners: practitionersObject } = usePatientWithStaticData();
  const practitioners = practitionersObject?.practitioners || [];

  // Medical data management
  const {
    items: equipment,
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
    entityName: 'equipment',
    apiMethodsConfig: {
      getAll: signal => apiService.getMedicalEquipment(signal),
      getByPatient: (patientId, signal) => apiService.getMedicalEquipment(signal), // Equipment is patient-scoped by backend
      create: (data, signal) => apiService.createMedicalEquipment(data, signal),
      update: (id, data, signal) => apiService.updateMedicalEquipment(id, data, signal),
      delete: (id, signal) => apiService.deleteMedicalEquipment(id, signal),
    },
    requiresPatient: true,
  });

  // Data management for filtering
  const dataManagement = useSimpleDataManagement(equipment, equipmentConfig);

  // View modal navigation
  const {
    isOpen: showViewModal,
    viewingItem: viewingEquipment,
    openModal: handleViewEquipment,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: equipment,
    loading,
  });

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

  const handleAddEquipment = () => {
    setEditingEquipment(null);
    setFormData(EMPTY_FORM_DATA);
    setShowModal(true);
  };

  const handleEditEquipment = (equip) => {
    setEditingEquipment(equip);
    setFormData({
      equipment_name: equip.equipment_name || '',
      equipment_type: equip.equipment_type || '',
      manufacturer: equip.manufacturer || '',
      model_number: equip.model_number || '',
      serial_number: equip.serial_number || '',
      prescribed_date: equip.prescribed_date || '',
      last_service_date: equip.last_service_date || '',
      next_service_date: equip.next_service_date || '',
      usage_instructions: equip.usage_instructions || '',
      status: equip.status || 'active',
      supplier: equip.supplier || '',
      notes: equip.notes || '',
      practitioner_id: equip.practitioner_id ? String(equip.practitioner_id) : '',
      tags: equip.tags || [],
    });
    setShowModal(true);
  };

  const handleDeleteEquipment = async (equipmentId) => {
    const success = await deleteItem(equipmentId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.equipment_name.trim()) {
      setError('Equipment name is required');
      return;
    }

    if (!formData.equipment_type) {
      setError('Equipment type is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const equipmentData = {
      equipment_name: formData.equipment_name,
      equipment_type: formData.equipment_type,
      manufacturer: formData.manufacturer || null,
      model_number: formData.model_number || null,
      serial_number: formData.serial_number || null,
      prescribed_date: formData.prescribed_date || null,
      last_service_date: formData.last_service_date || null,
      next_service_date: formData.next_service_date || null,
      usage_instructions: formData.usage_instructions || null,
      status: formData.status || 'active',
      supplier: formData.supplier || null,
      notes: formData.notes || null,
      tags: formData.tags || [],
      patient_id: currentPatient.id,
      practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null,
    };

    let success;
    if (editingEquipment) {
      success = await updateItem(editingEquipment.id, equipmentData);
    } else {
      success = await createItem(equipmentData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredEquipment = dataManagement.data;

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('equipment.loading', 'Loading equipment...')}
        hint={t('equipment.loadingHint', 'If this takes too long, please refresh the page')}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title={t('equipment.title', 'Medical Equipment')} icon="🩺" />

        <Stack gap="lg">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />

          <MedicalPageActions
            primaryAction={{
              label: t('equipment.addEquipment', '+ Add Equipment'),
              onClick: handleAddEquipment,
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            mb={0}
          />

          {/* Search and Filter */}
          <MedicalPageFilters dataManagement={dataManagement} config={equipmentConfig} />

          {filteredEquipment.length === 0 ? (
            <EmptyState
              emoji="🩺"
              title={t('equipment.noEquipmentFound', 'No Equipment Found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('equipment.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('equipment.startAdding', 'Start by adding your first piece of medical equipment.')}
              actionButton={
                <Button variant="filled" onClick={handleAddEquipment}>
                  {t('equipment.addFirstEquipment', 'Add Your First Equipment')}
                </Button>
              }
            />
          ) : (
            <AnimatedCardGrid
              items={filteredEquipment}
              columns={{ base: 12, sm: 6, lg: 4 }}
              renderCard={(equip) => (
                <EquipmentCard
                  equipment={equip}
                  onEdit={handleEditEquipment}
                  onDelete={handleDeleteEquipment}
                  onView={handleViewEquipment}
                  onError={(error) => {
                    logger.error('EquipmentCard error', {
                      equipmentId: equip.id,
                      error: error.message,
                      page: 'MedicalEquipment',
                    });
                  }}
                />
              )}
            />
          )}
        </Stack>
      </Container>

      <EquipmentFormWrapper
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEquipment ? t('equipment.editEquipment', 'Edit Equipment') : t('equipment.addEquipment', 'Add Equipment')}
        editingEquipment={editingEquipment}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitionersOptions={practitioners}
        practitionersLoading={false}
        isLoading={false}
      />

      <EquipmentViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        equipment={viewingEquipment}
        onEdit={handleEditEquipment}
        practitioners={practitioners}
      />
    </>
  );
};

export default withResponsive(MedicalEquipment, {
  injectResponsive: true,
  displayName: 'ResponsiveMedicalEquipment'
});
