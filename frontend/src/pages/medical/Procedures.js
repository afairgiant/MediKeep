import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';

const Procedures = () => {
  const [procedures, setProcedures] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('procedure_date');  const [formData, setFormData] = useState({
    procedure_name: '',
    procedure_type: '',
    description: '',
    procedure_date: '',
    status: 'scheduled',
    notes: '',
    facility: ''
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
    }));  };
  const filteredProcedures = procedures
    .filter(procedure => {
      const matchesSearch = procedure.procedure_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          procedure.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          procedure.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || procedure.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'procedure_name':
          return (a.procedure_name || '').localeCompare(b.procedure_name || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'procedure_date':
        default:
          return new Date(b.date || 0) - new Date(a.date || 0);
      }
    });  const resetForm = () => {
    setFormData({
      procedure_name: '',
      procedure_type: '',
      description: '',
      procedure_date: '',
      status: 'scheduled',
      notes: '',
      facility: ''
    });
    setEditingProcedure(null);
    setShowAddForm(false);
  };

  const handleAddProcedure = () => {
    resetForm();
    setShowAddForm(true);
  };  const handleEditProcedure = (procedure) => {
    setFormData({
      procedure_name: procedure.procedure_name || '',
      procedure_type: procedure.code || '',
      description: procedure.description || '',
      procedure_date: procedure.date || '',
      status: procedure.status || 'scheduled',
      notes: procedure.notes || '',
      facility: procedure.facility || ''
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
      setSuccessMessage('');        const procedureData = {
        procedure_name: formData.procedure_name,
        code: formData.procedure_type || null,
        description: formData.description,
        date: formData.procedure_date || null,
        status: formData.status,
        notes: formData.notes || null,
        facility: formData.facility || null,
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
    }  };

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
  };  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">Loading procedures...</div>
      </div>
    );
  }
  return (
    <div className="medical-page-container">
      <header className="medical-page-header">
        <button
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h1>🔬 Procedures</h1>
      </header>

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddProcedure}>
              + Add Procedure
            </button>
          </div>
          <div className="controls-right">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search procedures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        <div className="filters-container">
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="procedure_date">Procedure Date</option>
              <option value="procedure_name">Procedure Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>        {showAddForm && (
          <div className="medical-form-overlay" onClick={() => setShowAddForm(false)}>
            <div className="medical-form-modal" onClick={(e) => e.stopPropagation()}>
              <div className="form-header">
                <h3>{editingProcedure ? 'Edit Procedure' : 'Add New Procedure'}</h3>
                <button 
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>
              
              <div className="medical-form-content">
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
                    <label htmlFor="procedure_date">Procedure Date *</label>                  
                    <input
                    type="date"
                    id="procedure_date"
                    name="procedure_date"
                    value={formData.procedure_date}
                    onChange={handleInputChange}
                    required
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
                    <label htmlFor="facility">Facility</label>
                    <input
                      type="text"
                      id="facility"
                      name="facility"
                      value={formData.facility || ''}
                      onChange={handleInputChange}
                      placeholder="Facility where the procedure was performed"
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
          </div>
        )}

        <div className="medical-items-list">
          {filteredProcedures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <h3>No Procedures Found</h3>
              <p>
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first procedure.'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button className="add-button" onClick={handleAddProcedure}>
                  Add Your First Procedure
                </button>
              )}
            </div>
          ) : (
            <div className="medical-items-grid">
              {filteredProcedures.map((procedure) => (
                <div key={procedure.id} className="medical-item-card">
                  <div className="medical-item-header">                    <div className="item-info">                      <h3 className="item-title">
                        <span className="type-icon">{getProcedureTypeIcon(procedure.code)}</span>
                        {procedure.procedure_name}
                      </h3>
                      {procedure.code && (
                        <div className="item-subtitle">{procedure.code}</div>
                      )}
                    </div>
                    <div className="status-badges">
                      <span className={`status-badge status-${procedure.status}`}>
                        {getStatusIcon(procedure.status)} {procedure.status}
                      </span>
                    </div>
                  </div>                  <div className="medical-item-details">
                    {procedure.date && (
                      <div className="detail-item">
                        <span className="label">Procedure Date:</span>
                        <span className="value">
                          {formatDate(procedure.date)}
                        </span>                      </div>
                    )}
                    
                    {procedure.facility && (
                      <div className="detail-item">
                        <span className="label">Facility:</span>
                        <span className="value">{procedure.facility}</span>
                      </div>
                    )}
                    
                    {procedure.description && (
                      <div className="detail-item">
                        <span className="label">Description:</span>
                        <span className="value">{procedure.description}</span>
                      </div>
                    )}
                  </div>

                  {procedure.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{procedure.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Procedures;
