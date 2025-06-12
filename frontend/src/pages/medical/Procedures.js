import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import '../../styles/shared/MedicalPageShared.css';

const Procedures = () => {
  const [procedures, setProcedures] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [sortBy, setSortBy] = useState('procedure_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [formData, setFormData] = useState({
    procedure_name: '',
    procedure_type: '',
    description: '',
    procedure_date: '',
    status: 'scheduled',
    location: '',
    notes: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientAndProcedures();
  }, []);

  const fetchPatientAndProcedures = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      setPatientData(patient);
      
      // Then get procedures for this patient
      if (patient && patient.id) {
        const procedureData = await apiService.getPatientProcedures(patient.id);
        setProcedures(procedureData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load procedure data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      procedure_name: '',
      procedure_type: '',
      description: '',
      procedure_date: '',
      status: 'scheduled',
      location: '',
      notes: ''
    });
    setEditingProcedure(null);
    setShowAddForm(false);
  };

  const handleAddProcedure = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditProcedure = (procedure) => {
    setFormData({
      procedure_name: procedure.procedure_name || '',
      procedure_type: procedure.procedure_type || '',
      description: procedure.description || '',
      procedure_date: procedure.procedure_date || '',
      status: procedure.status || 'scheduled',
      location: procedure.location || '',
      notes: procedure.notes || ''
    });
    setEditingProcedure(procedure);
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const procedureData = {
        procedure_name: formData.procedure_name,
        procedure_type: formData.procedure_type,
        description: formData.description,
        procedure_date: formData.procedure_date || null,
        status: formData.status,
        location: formData.location || null,
        notes: formData.notes || null,
        patient_id: patientData.id
      };

      if (editingProcedure) {
        await apiService.updateProcedure(editingProcedure.id, procedureData);
        setSuccessMessage('Procedure updated successfully!');
      } else {
        await apiService.createProcedure(procedureData);
        setSuccessMessage('Procedure added successfully!');
      }

      resetForm();
      await fetchPatientAndProcedures();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving procedure:', error);
      setError(error.message || 'Failed to save procedure');
    }
  };

  const handleDeleteProcedure = async (procedureId) => {
    if (!window.confirm('Are you sure you want to delete this procedure record?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteProcedure(procedureId);
      setSuccessMessage('Procedure deleted successfully!');
      await fetchPatientAndProcedures();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting procedure:', error);
      setError(error.message || 'Failed to delete procedure');
    }
  };

  const getSortedProcedures = () => {
    const sorted = [...procedures].sort((a, b) => {
      if (sortBy === 'procedure_date') {
        const aDate = new Date(a.procedure_date || 0);
        const bDate = new Date(b.procedure_date || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      if (sortBy === 'procedure_name') {
        return sortOrder === 'asc' 
          ? a.procedure_name.localeCompare(b.procedure_name)
          : b.procedure_name.localeCompare(a.procedure_name);
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

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'scheduled': return '📅';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      case 'postponed': return '⏸️';
      default: return '❓';
    }
  };

  const getProcedureTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'surgical': return '🔬';
      case 'diagnostic': return '🔍';
      case 'therapeutic': return '💊';
      case 'preventive': return '🛡️';
      case 'emergency': return '🚨';
      default: return '🏥';
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
      <div className="medical-page-header">
        <h1 className="medical-page-title">🔬 Procedures</h1>
        <div className="header-actions">
          <button 
            className="primary-btn add-btn"
            onClick={handleAddProcedure}
          >
            + Add New Procedure
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="procedures-controls">
        <div className="controls-left">
          {/* Add any left-side controls here if needed */}
        </div>
        
        <div className="controls-right">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="procedure_date">Procedure Date</option>
                <option value="procedure_name">Procedure Name</option>
                <option value="status">Status</option>
              </select>
              <button 
                className="sort-order-button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {showAddForm && (
          <div className="procedure-form-overlay">
            <div className="procedure-form-modal">
              <div className="form-header">
                <h3>{editingProcedure ? 'Edit Procedure' : 'Add New Procedure'}</h3>
                <button 
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="procedure_name">Procedure Name *</label>
                    <input
                      type="text"
                      id="procedure_name"
                      name="procedure_name"
                      value={formData.procedure_name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Appendectomy, MRI Scan"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="procedure_type">Procedure Type</label>
                    <select
                      id="procedure_type"
                      name="procedure_type"
                      value={formData.procedure_type}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Type</option>
                      <option value="surgical">Surgical</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="therapeutic">Therapeutic</option>
                      <option value="preventive">Preventive</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="procedure_date">Procedure Date</label>
                    <input
                      type="date"
                      id="procedure_date"
                      name="procedure_date"
                      value={formData.procedure_date}
                      onChange={handleInputChange}
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
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="postponed">Postponed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="location">Location</label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., OR 3, Radiology Dept"
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
                      placeholder="Description of the procedure..."
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="notes">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Additional notes about the procedure..."
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
                  <button 
                    type="submit" 
                    className="save-button"
                  >
                    {editingProcedure ? 'Update Procedure' : 'Add Procedure'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="procedures-list">
          {getSortedProcedures().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <h3>No procedures found</h3>
              <p>Click "Add New Procedure" to get started.</p>
            </div>
          ) : (
            <div className="procedures-grid">
              {getSortedProcedures().map((procedure) => (
                <MedicalCard
                  key={procedure.id}
                  title={
                    <div className="procedure-title">
                      <span className="type-icon">{getProcedureTypeIcon(procedure.procedure_type)}</span>
                      {procedure.procedure_name}
                    </div>
                  }
                  subtitle={procedure.procedure_type}
                  status={procedure.status}
                  statusType="procedure"
                  dateInfo={{
                    custom: procedure.procedure_date ? {
                      label: 'Procedure Date',
                      date: procedure.procedure_date
                    } : null
                  }}
                  actions={
                    <div className="procedure-actions">
                      <button 
                        className="edit-button"
                        onClick={() => handleEditProcedure(procedure)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="delete-button"
                        onClick={() => handleDeleteProcedure(procedure.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  }
                >
                  <div className="procedure-details">
                    {procedure.description && (
                      <div className="detail-item">
                        <span className="label">Description:</span>
                        <span className="value">{procedure.description}</span>
                      </div>
                    )}
                    
                    {procedure.location && (
                      <div className="detail-item">
                        <span className="label">Location:</span>
                        <span className="value">{procedure.location}</span>
                      </div>
                    )}

                    <div className="detail-item">
                      <span className="label">Status:</span>
                      <StatusBadge status={procedure.status} type="procedure" />
                    </div>

                    {procedure.notes && (
                      <div className="detail-item full-width">
                        <span className="label">Notes:</span>
                        <span className="value">{procedure.notes}</span>
                      </div>
                    )}
                  </div>
                </MedicalCard>
              ))}
            </div>
          )}
        </div>
      </div>
  );
};

export default Procedures;
