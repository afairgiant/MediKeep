import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import { Button } from '../../components/ui';
import MantineFilters from '../../components/mantine/MantineFilters';
import MantineAllergyForm from '../../components/medical/MantineAllergyForm';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Allergies = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Standardized data management
  const {
    items: allergies,
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
    entityName: 'allergy',
    apiMethodsConfig: {
      getAll: signal => apiService.getAllergies(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientAllergies(patientId, signal),
      create: (data, signal) => apiService.createAllergy(data, signal),
      update: (id, data, signal) => apiService.updateAllergy(id, data, signal),
      delete: (id, signal) => apiService.deleteAllergy(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('allergies');

  // Use standardized data management
  const dataManagement = useDataManagement(allergies, config);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [formData, setFormData] = useState({
    allergen: '',
    severity: '',
    reaction: '',
    onset_date: '',
    status: 'active',
    notes: '',
  });

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      allergen: '',
      severity: '',
      reaction: '',
      onset_date: '',
      status: 'active',
      notes: '',
    });
    setEditingAllergy(null);
    setShowAddForm(false);
  };

  const handleAddAllergy = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditAllergy = allergy => {
    setFormData({
      allergen: allergy.allergen || '',
      severity: allergy.severity || '',
      reaction: allergy.reaction || '',
      onset_date: allergy.onset_date || '',
      status: allergy.status || 'active',
      notes: allergy.notes || '',
    });
    setEditingAllergy(allergy);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const allergyData = {
      ...formData,
      onset_date: formData.onset_date || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingAllergy) {
      success = await updateItem(editingAllergy.id, allergyData);
    } else {
      success = await createItem(allergyData);
    }

    if (success) {
      resetForm();
      await refreshData();
    }
  };

  const handleDeleteAllergy = async allergyId => {
    const success = await deleteItem(allergyId);
    if (success) {
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedAllergies = dataManagement.data;

  const getSeverityIcon = severity => {
    switch (severity) {
      case 'life-threatening':
        return '🚨';
      case 'severe':
        return '⚠️';
      case 'moderate':
        return '⚡';
      case 'mild':
        return '💛';
      default:
        return '❓';
    }
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading allergies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Allergies" icon="⚠️" />

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
            <Button variant="primary" onClick={handleAddAllergy}>
              + Add New Allergy
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
        <MantineAllergyForm
          isOpen={showAddForm}
          onClose={resetForm}
          title={editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingAllergy={editingAllergy}
        />{' '}
        <div className="medical-items-list">
          {processedAllergies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h3>No allergies found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Click "Add New Allergy" to get started.'}
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {processedAllergies.map(allergy => (
                <div key={allergy.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">
                      <span className="severity-icon">
                        {getSeverityIcon(allergy.severity)}
                      </span>
                      {allergy.allergen}
                    </h3>
                    <span className={`status-badge status-${allergy.status}`}>
                      {allergy.status}
                    </span>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Severity:</span>
                      <span
                        className={`value status-badge status-${allergy.severity}`}
                      >
                        {getSeverityIcon(allergy.severity)} {allergy.severity}
                      </span>
                    </div>

                    {allergy.reaction && (
                      <div className="detail-item">
                        <span className="label">Reaction:</span>
                        <span className="value">{allergy.reaction}</span>
                      </div>
                    )}

                    {allergy.onset_date && (
                      <div className="detail-item">
                        <span className="label">Onset Date:</span>
                        <span className="value">
                          {formatDate(allergy.onset_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {allergy.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{allergy.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditAllergy(allergy)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteAllergy(allergy.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={processedAllergies}
              columns={[
                { header: 'Allergen', accessor: 'allergen' },
                { header: 'Reaction', accessor: 'reaction' },
                { header: 'Severity', accessor: 'severity' },
                { header: 'Onset Date', accessor: 'onset_date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Allergies"
              onEdit={handleEditAllergy}
              onDelete={handleDeleteAllergy}
              formatters={{
                allergen: value => (
                  <span className="primary-field">{value}</span>
                ),
                severity: value => (
                  <span className={`status-badge-small status-${value}`}>
                    {getSeverityIcon(value)} {value}
                  </span>
                ),
                status: value => (
                  <span className={`status-badge-small status-${value}`}>
                    {value}
                  </span>
                ),
                onset_date: value => (value ? formatDate(value) : '-'),
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

export default Allergies;
