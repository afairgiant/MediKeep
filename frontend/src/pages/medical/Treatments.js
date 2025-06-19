import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Treatments = () => {
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
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

  // Fetch patient and treatments data on component mount
  useEffect(() => {
    fetchPatientAndTreatments();
  }, []);

  const fetchPatientAndTreatments = async () => {
    try {
      setLoading(true);
      setError('');

      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      setPatientData(patient);

      // Then get treatments for this patient
      if (patient && patient.id) {
        const treatmentData = await apiService.getPatientTreatments(patient.id);
        setTreatments(treatmentData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load treatment data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  const resetForm = () => {
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
    setEditingTreatment(null);
    setShowAddForm(false);
  };

  const handleAddTreatment = () => {
    resetForm();
    setShowAddForm(true);
  };
  const handleEditTreatment = treatment => {
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
    setEditingTreatment(treatment);
    setShowAddForm(true);
  };

  // Add form validation before submission
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

    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
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
        patient_id: patientData.id,
      };

      if (editingTreatment) {
        await apiService.updateTreatment(editingTreatment.id, treatmentData);
        setSuccessMessage('Treatment updated successfully!');
      } else {
        await apiService.createTreatment(treatmentData);
        setSuccessMessage('Treatment added successfully!');
      }

      resetForm();
      await fetchPatientAndTreatments();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving treatment:', error);
      setError(error.message || 'Failed to save treatment');
    }
  };

  const handleDeleteTreatment = async treatmentId => {
    if (
      !window.confirm('Are you sure you want to delete this treatment record?')
    ) {
      return;
    }

    try {
      setError('');
      await apiService.deleteTreatment(treatmentId);
      setSuccessMessage('Treatment deleted successfully!');
      await fetchPatientAndTreatments();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting treatment:', error);
      setError(error.message || 'Failed to delete treatment');
    }
  };

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
        <div className="loading-container">
          <div className="loading-spinner"></div>
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
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}{' '}
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
          </div>{' '}
        </div>
        {showAddForm && (
          <div
            className="medical-form-overlay"
            onClick={() => setShowAddForm(false)}
          >
            <div
              className="medical-form-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="form-header">
                <h3>
                  {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
                </h3>
                <button className="close-button" onClick={resetForm}>
                  ×
                </button>
              </div>

              <div className="medical-form-content">
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    {' '}
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
                    <div className="form-group full-width">
                      <label htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Description of the treatment..."
                      />
                    </div>{' '}
                    <div className="form-group full-width">
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
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-button">
                      {editingTreatment ? 'Update Treatment' : 'Add Treatment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}{' '}
        {getSortedTreatments().length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🩹</div>
            <h3>No treatments found</h3>
            <p>Click "Add New Treatment" to get started.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="medical-items-list">
            <div className="medical-items-grid">
              {getSortedTreatments().map(treatment => (
                <div key={treatment.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">
                      <span className="status-icon">
                        {getStatusIcon(treatment.status)}
                      </span>
                      {treatment.treatment_name}
                    </h3>
                    <span className={`status-badge status-${treatment.status}`}>
                      {treatment.status}
                    </span>
                  </div>

                  {treatment.description && (
                    <p className="item-subtitle">{treatment.description}</p>
                  )}

                  <div className="medical-item-details">
                    {treatment.start_date && (
                      <div className="detail-item">
                        <span className="label">Start Date:</span>
                        <span className="value">
                          {formatDate(treatment.start_date)}
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

                    {treatment.end_date && (
                      <div className="detail-item">
                        <span className="label">End Date:</span>
                        <span className="value">
                          {formatDate(treatment.end_date)}
                        </span>
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
          </div>
        ) : (
          <div className="medical-items-list">
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
              patientData={patientData}
              tableName="Treatments"
              onEdit={handleEditTreatment}
              onDelete={handleDeleteTreatment}
              formatters={{
                treatment_name: value => (
                  <span className="primary-field">{value}</span>
                ),
                start_date: value => (value ? formatDate(value) : '-'),
                end_date: value => (value ? formatDate(value) : '-'),
                status: value => (
                  <span className={`status-badge-small status-${value}`}>
                    {getStatusIcon(value)} {value}
                  </span>
                ),
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Treatments;
