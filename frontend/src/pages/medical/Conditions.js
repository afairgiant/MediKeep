import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData, useDataManagement } from '../../hooks';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader, FilterControls } from '../../components';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Conditions = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Standardized data management
  const {
    items: conditions,
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
    entityName: 'condition',
    apiMethodsConfig: {
      getAll: signal => apiService.getConditions(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientConditions(patientId, signal),
      create: (data, signal) => apiService.createCondition(data, signal),
      update: (id, data, signal) =>
        apiService.updateCondition(id, data, signal),
      delete: (id, signal) => apiService.deleteCondition(id, signal),
    },
    requiresPatient: true,
  });
  console.log('🔍 CONDITIONS DEBUG:', {
    conditions,
    currentPatient,
    loading,
    error,
    hasPatient: !!currentPatient?.id,
  });

  // Standardized filtering and sorting using configuration
  const config = getMedicalPageConfig('conditions');
  const dataManagement = useDataManagement(conditions, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [formData, setFormData] = useState({
    diagnosis: '',
    notes: '',
    status: 'active',
    onsetDate: '', // Form field name
  });

  const handleAddCondition = () => {
    setEditingCondition(null);
    setFormData({
      diagnosis: '',
      notes: '',
      status: 'active',
      onsetDate: '',
    });
    setShowModal(true);
  };

  const handleEditCondition = condition => {
    setEditingCondition(condition);
    setFormData({
      diagnosis: condition.diagnosis || '',
      notes: condition.notes || '',
      status: condition.status || 'active',
      onsetDate: condition.onset_date ? condition.onset_date.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleDeleteCondition = async conditionId => {
    const success = await deleteItem(conditionId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const conditionData = {
      diagnosis: formData.diagnosis,
      notes: formData.notes || null,
      status: formData.status,
      onset_date: formData.onsetDate || null, // Map form field to API field
      patient_id: currentPatient.id,
    };

    let success;
    if (editingCondition) {
      success = await updateItem(editingCondition.id, conditionData);
    } else {
      success = await createItem(conditionData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const filteredConditions = dataManagement.data;

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading conditions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Medical Conditions" icon="🏥" />

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={clearError} className="error-close">
              ×
            </button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}{' '}
        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddCondition}>
              + Add Condition
            </button>
          </div>

          <div className="controls-center">
            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </div>
        </div>
        {/* Standardized Filter Controls */}
        <FilterControls
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
          getSortIndicator={dataManagement.getSortIndicator}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />
        <div className="medical-items-list">
          {filteredConditions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Medical Conditions Found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first medical condition.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <button className="add-button" onClick={handleAddCondition}>
                  Add Your First Condition
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredConditions.map(condition => (
                <div key={condition.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">{condition.diagnosis}</h3>
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={condition.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    {condition.onset_date && (
                      <div className="detail-item">
                        <span className="label">Onset Date:</span>
                        <span className="value">
                          {formatDate(condition.onset_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {condition.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{condition.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEditCondition(condition)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteCondition(condition.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={filteredConditions}
              columns={[
                { header: 'Condition', accessor: 'diagnosis' },
                { header: 'Onset Date', accessor: 'onset_date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Conditions"
              onEdit={handleEditCondition}
              onDelete={handleDeleteCondition}
              formatters={{
                diagnosis: value => (
                  <span className="primary-field">{value}</span>
                ),
                onset_date: value => (value ? formatDate(value) : '-'),
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

      <MedicalFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCondition ? 'Edit Condition' : 'Add New Condition'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="diagnosis">Diagnosis *</label>
              <input
                type="text"
                id="diagnosis"
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleInputChange}
                required
                placeholder="e.g., Hypertension, Diabetes Type 2"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                  <option value="chronic">Chronic</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="onsetDate">Onset Date</label>
                <input
                  type="date"
                  id="onsetDate"
                  name="onsetDate"
                  value={formData.onsetDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="4"
                placeholder="Additional notes about this condition..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="save-button">
              {editingCondition ? 'Update Condition' : 'Add Condition'}
            </button>
          </div>
        </form>
      </MedicalFormModal>
    </div>
  );
};

export default Conditions;
