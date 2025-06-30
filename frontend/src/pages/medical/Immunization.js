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
import MantineImmunizationForm from '../../components/medical/MantineImmunizationForm';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Immunization = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Standardized data management
  const {
    items: immunizations,
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
    entityName: 'immunization',
    apiMethodsConfig: {
      getAll: signal => apiService.getImmunizations(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientImmunizations(patientId, signal),
      create: (data, signal) => apiService.createImmunization(data, signal),
      update: (id, data, signal) =>
        apiService.updateImmunization(id, data, signal),
      delete: (id, signal) => apiService.deleteImmunization(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('immunizations');

  // Use standardized data management
  const dataManagement = useDataManagement(immunizations, config);

  // Form and UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingImmunization, setEditingImmunization] = useState(null);
  const [formData, setFormData] = useState({
    vaccine_name: '',
    date_administered: '',
    dose_number: '',
    lot_number: '',
    manufacturer: '',
    site: '',
    route: '',
    expiration_date: '',
    notes: '',
    practitioner_id: null,
  });

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      vaccine_name: '',
      date_administered: '',
      dose_number: '',
      lot_number: '',
      manufacturer: '',
      site: '',
      route: '',
      expiration_date: '',
      notes: '',
      practitioner_id: null,
    });
    setEditingImmunization(null);
    setShowAddForm(false);
  };

  const handleAddImmunization = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditImmunization = immunization => {
    setFormData({
      vaccine_name: immunization.vaccine_name || '',
      date_administered: immunization.date_administered || '',
      dose_number: immunization.dose_number || '',
      lot_number: immunization.lot_number || '',
      manufacturer: immunization.manufacturer || '',
      site: immunization.site || '',
      route: immunization.route || '',
      expiration_date: immunization.expiration_date || '',
      notes: immunization.notes || '',
      practitioner_id: immunization.practitioner_id || null,
    });
    setEditingImmunization(immunization);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const immunizationData = {
      vaccine_name: formData.vaccine_name,
      date_administered: formData.date_administered,
      patient_id: currentPatient.id,
      dose_number: formData.dose_number
        ? parseInt(formData.dose_number, 10)
        : null,
      lot_number: formData.lot_number || null,
      manufacturer: formData.manufacturer || null,
      site: formData.site || null,
      route: formData.route || null,
      expiration_date: formData.expiration_date || null,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id, 10)
        : null,
    };

    let success;
    if (editingImmunization) {
      success = await updateItem(editingImmunization.id, immunizationData);
    } else {
      success = await createItem(immunizationData);
    }

    if (success) {
      resetForm();
      await refreshData();
    }
  };

  const handleDeleteImmunization = async immunizationId => {
    const success = await deleteItem(immunizationId);
    if (success) {
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedImmunizations = dataManagement.data;

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading immunizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Immunizations" icon="💉" />

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
        )}{' '}
        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddImmunization}>
              + Add New Immunization
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
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />
        <MantineImmunizationForm
          isOpen={showAddForm}
          onClose={resetForm}
          title={
            editingImmunization ? 'Edit Immunization' : 'Add New Immunization'
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingImmunization={editingImmunization}
        />{' '}
        <div className="medical-items-list">
          {processedImmunizations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💉</div>
              <h3>No immunizations found</h3>
              <p>Click "Add New Immunization" to get started.</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {processedImmunizations.map(immunization => (
                <div key={immunization.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">{immunization.vaccine_name}</h3>
                    {immunization.dose_number && (
                      <span className="status-badge">
                        Dose {immunization.dose_number}
                      </span>
                    )}
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Date Administered:</span>
                      <span className="value">
                        {formatDate(immunization.date_administered)}
                      </span>
                    </div>

                    {immunization.manufacturer && (
                      <div className="detail-item">
                        <span className="label">Manufacturer:</span>
                        <span className="value">
                          {immunization.manufacturer}
                        </span>
                      </div>
                    )}

                    {immunization.site && (
                      <div className="detail-item">
                        <span className="label">Site:</span>
                        <span className="value">
                          {immunization.site
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    )}

                    {immunization.route && (
                      <div className="detail-item">
                        <span className="label">Route:</span>
                        <span className="value">{immunization.route}</span>
                      </div>
                    )}

                    {immunization.lot_number && (
                      <div className="detail-item">
                        <span className="label">Lot Number:</span>
                        <span className="value">{immunization.lot_number}</span>
                      </div>
                    )}

                    {immunization.expiration_date && (
                      <div className="detail-item">
                        <span className="label">Expiration Date:</span>
                        <span className="value">
                          {formatDate(immunization.expiration_date)}
                        </span>
                      </div>
                    )}

                    {immunization.practitioner_id && (
                      <div className="detail-item">
                        <span className="label">Practitioner ID:</span>
                        <span className="value">
                          {immunization.practitioner_id}
                        </span>
                      </div>
                    )}
                  </div>

                  {immunization.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{immunization.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditImmunization(immunization)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteImmunization(immunization.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={processedImmunizations}
              columns={[
                { header: 'Vaccine Name', accessor: 'vaccine_name' },
                { header: 'Date Administered', accessor: 'date_administered' },
                { header: 'Dose Number', accessor: 'dose_number' },
                { header: 'Manufacturer', accessor: 'manufacturer' },
                { header: 'Site', accessor: 'site' },
                { header: 'Route', accessor: 'route' },
                { header: 'Lot Number', accessor: 'lot_number' },
                { header: 'Expiration Date', accessor: 'expiration_date' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Immunizations"
              onEdit={handleEditImmunization}
              onDelete={handleDeleteImmunization}
              formatters={{
                vaccine_name: value => (
                  <span className="primary-field">{value}</span>
                ),
                date_administered: value => formatDate(value),
                expiration_date: value => (value ? formatDate(value) : '-'),
                site: value =>
                  value
                    ? value
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                    : '-',
                dose_number: value => (value ? `Dose ${value}` : '-'),
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
    </div>
  );
};

export default Immunization;
