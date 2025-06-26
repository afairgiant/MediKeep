import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
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
  // Form and UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('onset_date');
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

  const filteredConditions = conditions
    .filter(condition => {
      const matchesSearch =
        condition.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        condition.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || condition.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'diagnosis':
          return (a.diagnosis || '').localeCompare(b.diagnosis || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'onset_date':
        default:
          return new Date(b.onset_date || 0) - new Date(a.onset_date || 0);
      }
    });

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
      <header className="medical-page-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>🏥 Medical Conditions</h1>
      </header>

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

          <div className="controls-right">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search conditions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>{' '}
        <div className="filters-container">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="chronic">Chronic</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="onset_date">Onset Date</option>
              <option value="diagnosis">Diagnosis</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
        <div className="medical-items-list">
          {filteredConditions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Medical Conditions Found</h3>
              <p>
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first medical condition.'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
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
