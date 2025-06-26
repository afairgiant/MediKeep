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

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState('desc');
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

  // Sorting and filtering
  const getSortedTreatments = () => {
    const sorted = [...treatments].sort((a, b) => {
      if (sortBy === 'start_date') {
        const aDate = new Date(a.start_date || 0);
        const bDate = new Date(b.start_date || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (sortBy === 'treatment_name') {
        return sortOrder === 'asc'
          ? a.treatment_name.localeCompare(b.treatment_name)
          : b.treatment_name.localeCompare(a.treatment_name);
      }

      if (sortBy === 'status') {
        return sortOrder === 'asc'
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }

      return 0;
    });

    return sorted;
  };

  const handleSortChange = newSortBy => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'active':
        return '🔄';
      case 'completed':
        return '✅';
      case 'planned':
        return '📋';
      case 'on-hold':
        return '⏸️';
      case 'cancelled':
        return '❌';
      default:
        return '❓';
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
      <header className="medical-page-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>🩹 Treatments</h1>
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
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddTreatment}>
              + Add New Treatment
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
            <div className="sort-controls">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={e => handleSortChange(e.target.value)}
              >
                <option value="start_date">Start Date</option>
                <option value="treatment_name">Treatment Name</option>
                <option value="status">Status</option>
              </select>
              <button
                className="sort-order-button"
                onClick={() =>
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                }
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        <div className="medical-items-list">
          {getSortedTreatments().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🩹</div>
              <h3>No treatments found</h3>
              <p>Click "Add New Treatment" to get started.</p>
              <button className="add-button" onClick={handleAddTreatment}>
                Add Your First Treatment
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {getSortedTreatments().map(treatment => (
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
                    <button
                      className="edit-button"
                      onClick={() => handleEditTreatment(treatment)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteTreatment(treatment.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={getSortedTreatments()}
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

      <MedicalFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="treatment_name">Treatment Name *</label>
              <input
                type="text"
                id="treatment_name"
                name="treatment_name"
                value={formData.treatment_name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Physical Therapy, Chemotherapy"
              />
            </div>

            <div className="form-group">
              <label htmlFor="treatment_type">Treatment Type *</label>
              <input
                type="text"
                id="treatment_type"
                name="treatment_type"
                value={formData.treatment_type}
                onChange={handleInputChange}
                required
                placeholder="e.g., Surgery, Medication"
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
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="start_date">Start Date *</label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">End Date</label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dosage">Dosage</label>
                <input
                  type="text"
                  id="dosage"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleInputChange}
                  placeholder="e.g., 500mg, 2 tablets"
                />
              </div>

              <div className="form-group">
                <label htmlFor="frequency">Frequency</label>
                <input
                  type="text"
                  id="frequency"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleInputChange}
                  placeholder="e.g., Daily, 3 times per week"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                placeholder="Description of the treatment..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                placeholder="Additional notes about the treatment..."
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
              {editingTreatment ? 'Update Treatment' : 'Add Treatment'}
            </button>
          </div>
        </form>
      </MedicalFormModal>
    </div>
  );
};

export default Treatments;
