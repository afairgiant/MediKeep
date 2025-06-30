import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineTreatmentForm from '../../components/medical/MantineTreatmentForm';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Treatments = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards');

  // Modern data management with useMedicalData
  const {
    items: treatments,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'treatment',
    apiMethodsConfig: {
      getAll: signal => apiService.getTreatments(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientTreatments(patientId, signal),
      create: (data, signal) => apiService.createTreatment(data, signal),
      update: (id, data, signal) =>
        apiService.updateTreatment(id, data, signal),
      delete: (id, signal) => apiService.deleteTreatment(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('treatments');

  // Use standardized data management
  const dataManagement = useDataManagement(treatments, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [formData, setFormData] = useState({
    treatment_name: '',
    treatment_type: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planned',
    dosage: '',
    frequency: '',
    notes: '',
  });

  const handleAddTreatment = () => {
    setEditingTreatment(null);
    setFormData({
      treatment_name: '',
      treatment_type: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'planned',
      dosage: '',
      frequency: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleEditTreatment = treatment => {
    setEditingTreatment(treatment);
    setFormData({
      treatment_name: treatment.treatment_name || '',
      treatment_type: treatment.treatment_type || '',
      description: treatment.description || '',
      start_date: treatment.start_date || '',
      end_date: treatment.end_date || '',
      status: treatment.status || 'planned',
      dosage: treatment.dosage || '',
      frequency: treatment.frequency || '',
      notes: treatment.notes || '',
    });
    setShowModal(true);
  };

  const handleDeleteTreatment = async treatmentId => {
    const success = await deleteItem(treatmentId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Validation
    if (!formData.treatment_name.trim()) {
      setError('Treatment name is required');
      return;
    }

    if (!formData.treatment_type.trim()) {
      setError('Treatment type is required');
      return;
    }

    if (!formData.start_date) {
      setError('Start date is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const treatmentData = {
      treatment_name: formData.treatment_name,
      treatment_type: formData.treatment_type,
      description: formData.description,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      status: formData.status,
      dosage: formData.dosage || null,
      frequency: formData.frequency || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingTreatment) {
      success = await updateItem(editingTreatment.id, treatmentData);
    } else {
      success = await createItem(treatmentData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Get processed data from data management
  const processedTreatments = dataManagement.data;

  const getStatusIcon = status => {
    switch (status) {
      case 'active':
        return '';
      case 'completed':
        return '';
      case 'planned':
        return '';
      case 'on-hold':
        return '';
      case 'cancelled':
        return '';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading treatments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Treatments" icon="🩹" />

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <Button variant="ghost" size="small" onClick={clearError}>
              ×
            </Button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddTreatment}>
              + Add New Treatment
            </Button>
          </div>

          <div className="controls-center">
            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </div>
        </div>

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

        <div className="medical-items-list">
          {processedTreatments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🩹</div>
              <h3>No treatments found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Click "Add New Treatment" to get started.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <Button variant="primary" onClick={handleAddTreatment}>
                  Add Your First Treatment
                </Button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {processedTreatments.map(treatment => (
                <div key={treatment.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className="status-icon">
                          {getStatusIcon(treatment.status)}
                        </span>
                        {treatment.treatment_name}
                      </h3>
                      {treatment.description && (
                        <p className="item-subtitle">{treatment.description}</p>
                      )}
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={treatment.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Type:</span>
                      <span className="value">{treatment.treatment_type}</span>
                    </div>
                    {treatment.start_date && (
                      <div className="detail-item">
                        <span className="label">Start Date:</span>
                        <span className="value">
                          {formatDate(treatment.start_date)}
                        </span>
                      </div>
                    )}
                    {treatment.end_date && (
                      <div className="detail-item">
                        <span className="label">End Date:</span>
                        <span className="value">
                          {formatDate(treatment.end_date)}
                        </span>
                      </div>
                    )}
                    {treatment.dosage && (
                      <div className="detail-item">
                        <span className="label">Dosage:</span>
                        <span className="value">{treatment.dosage}</span>
                      </div>
                    )}
                    {treatment.frequency && (
                      <div className="detail-item">
                        <span className="label">Frequency:</span>
                        <span className="value">{treatment.frequency}</span>
                      </div>
                    )}
                  </div>

                  {treatment.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{treatment.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditTreatment(treatment)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteTreatment(treatment.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={processedTreatments}
              columns={[
                { header: 'Treatment Name', accessor: 'treatment_name' },
                { header: 'Type', accessor: 'treatment_type' },
                { header: 'Start Date', accessor: 'start_date' },
                { header: 'End Date', accessor: 'end_date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Dosage', accessor: 'dosage' },
                { header: 'Frequency', accessor: 'frequency' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Treatments"
              onEdit={handleEditTreatment}
              onDelete={handleDeleteTreatment}
              formatters={{
                treatment_name: value => (
                  <span className="primary-field">{value}</span>
                ),
                start_date: value => (value ? formatDate(value) : '-'),
                end_date: value => (value ? formatDate(value) : '-'),
                status: value => <StatusBadge status={value} size="small" />,
                notes: value =>
                  value ? (
                    <span title={value}>
                      {value.length > 50
                        ? `${value.substring(0, 50)}...`
                        : value}
                    </span>
                  ) : (
                    '-'
                  ),
              }}
            />
          )}
        </div>
      </div>

      <MantineTreatmentForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingTreatment={editingTreatment}
      />
    </div>
  );
};

export default Treatments;
