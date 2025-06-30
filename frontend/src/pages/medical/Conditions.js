import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData, useDataManagement } from '../../hooks';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineConditionForm from '../../components/medical/MantineConditionForm';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';
import '../../styles/pages/ConditionCards.css';

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
      onsetDate: condition.onsetDate ? condition.onsetDate.split('T')[0] : '',
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
      onsetDate: formData.onsetDate || null, // Use camelCase to match API
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

  // Helper function to calculate time since onset
  const getTimeSinceOnset = onsetDate => {
    if (!onsetDate) return null;

    const onset = new Date(onsetDate);
    const now = new Date();
    const diffTime = Math.abs(now - onset);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months === 1 ? '' : 's'} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years === 1 ? '' : 's'} ago`;
    }
  };

  // Helper function to get condition icon based on diagnosis
  const getConditionIcon = diagnosis => {
    const diagnosisLower = diagnosis.toLowerCase();
    if (diagnosisLower.includes('diabetes')) return '🩸';
    if (
      diagnosisLower.includes('hypertension') ||
      diagnosisLower.includes('blood pressure')
    )
      return '💗';
    if (
      diagnosisLower.includes('asthma') ||
      diagnosisLower.includes('respiratory')
    )
      return '🫁';
    if (
      diagnosisLower.includes('arthritis') ||
      diagnosisLower.includes('joint')
    )
      return '🦴';
    if (diagnosisLower.includes('heart') || diagnosisLower.includes('cardiac'))
      return '❤️';
    if (diagnosisLower.includes('cancer') || diagnosisLower.includes('tumor'))
      return '🎗️';
    if (
      diagnosisLower.includes('migraine') ||
      diagnosisLower.includes('headache')
    )
      return '🧠';
    if (
      diagnosisLower.includes('allergy') ||
      diagnosisLower.includes('allergic')
    )
      return '⚠️';
    return '🏥'; // Default medical icon
  };

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
            <Button variant="primary" onClick={handleAddCondition}>
              + Add Condition
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
                <Button variant="primary" onClick={handleAddCondition}>
                  Add Your First Condition
                </Button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredConditions.map(condition => (
                <div key={condition.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className="condition-icon">
                          {getConditionIcon(condition.diagnosis)}
                        </span>
                        {condition.diagnosis}
                      </h3>
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={condition.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    {/* Display onset date if available */}
                    {condition.onsetDate && (
                      <>
                        <div className="detail-item">
                          <span className="label">Onset Date:</span>
                          <span className="value">
                            {formatDate(condition.onsetDate)}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Duration:</span>
                          <span className="value">
                            {getTimeSinceOnset(condition.onsetDate)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="detail-item">
                      <span className="label">Status:</span>
                      <span className="value">
                        {condition.status === 'active' && '🟢 Currently active'}
                        {condition.status === 'chronic' &&
                          '🔵 Chronic condition'}
                        {condition.status === 'resolved' && '✅ Resolved'}
                        {condition.status === 'inactive' && '⚫ Inactive'}
                      </span>
                    </div>
                  </div>

                  {condition.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">📝 Clinical Notes</div>
                      <div className="notes-content">{condition.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditCondition(condition)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteCondition(condition.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={filteredConditions}
              columns={[
                { header: 'Condition', accessor: 'diagnosis' },
                { header: 'Onset Date', accessor: 'onsetDate' },
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
                onsetDate: value => (value ? formatDate(value) : '-'),
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

      <MantineConditionForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCondition ? 'Edit Condition' : 'Add New Condition'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingCondition={editingCondition}
      />
    </div>
  );
};

export default Conditions;
