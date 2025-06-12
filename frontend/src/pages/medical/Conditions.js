import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import '../../styles/shared/MedicalPageShared.css';

const Conditions = () => {
  const navigate = useNavigate();
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('onsetDate');
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);  const [formData, setFormData] = useState({
    diagnosis: '',
    notes: '',
    status: 'active',
    onsetDate: '',
    patient_id: 1 // Default patient ID
  });

  useEffect(() => {
    fetchConditions();
  }, []);
  const fetchConditions = async () => {
    try {
      setLoading(true);
      const response = await apiService.getConditions();
      setConditions(response || []);
      setError('');
    } catch (err) {
      setError('Failed to load conditions. Please try again.');
      console.error('Error fetching conditions:', err);
    } finally {
      setLoading(false);
    }
  };
  const handleAddCondition = () => {
    setEditingCondition(null);
    setFormData({
      diagnosis: '',
      notes: '',
      status: 'active',
      onsetDate: '',
      patient_id: 1
    });
    setShowModal(true);
  };
  const handleEditCondition = (condition) => {
    setEditingCondition(condition);
    setFormData({
      diagnosis: condition.diagnosis || '',
      notes: condition.notes || '',
      status: condition.status || 'active',
      onsetDate: condition.onsetDate ? condition.onsetDate.split('T')[0] : '',
      patient_id: condition.patient_id || 1
    });
    setShowModal(true);
  };

  const handleDeleteCondition = async (conditionId) => {
    if (window.confirm('Are you sure you want to delete this condition?')) {
      try {
        await apiService.deleteCondition(conditionId);
        await fetchConditions();
        setSuccessMessage('Condition deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete condition. Please try again.');
        console.error('Error deleting condition:', err);
      }
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const conditionData = {
        ...formData,
        onsetDate: formData.onsetDate || null
      };

      if (editingCondition) {
        await apiService.updateCondition(editingCondition.id, conditionData);
        setSuccessMessage('Condition updated successfully');
      } else {
        await apiService.createCondition(conditionData);
        setSuccessMessage('Condition added successfully');
      }

      setShowModal(false);
      await fetchConditions();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save condition. Please try again.');
      console.error('Error saving condition:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const filteredConditions = conditions
    .filter(condition => {
      const matchesSearch = condition.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          condition.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || condition.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'diagnosis':
          return (a.diagnosis || '').localeCompare(b.diagnosis || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'onsetDate':
        default:
          return new Date(b.onsetDate || 0) - new Date(a.onsetDate || 0);
      }
    });
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">Loading conditions...</div>
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
        <h1>🏥 Medical Conditions</h1>
      </header>

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddCondition}>
              + Add Condition
            </button>
          </div>
          <div className="controls-right">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search conditions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>        </div>        <div className="filters-container">
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="chronic">Chronic</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="onsetDate">Onset Date</option>
              <option value="diagnosis">Diagnosis</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        <div className="medical-items-list">
          {filteredConditions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Medical Conditions Found</h3>              <p>
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first medical condition.'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button className="add-button" onClick={handleAddCondition}>
                  Add Your First Condition
                </button>
              )}</div>
          ) : (
            <div className="medical-items-grid">
              {filteredConditions.map((condition) => (                <div key={condition.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">{condition.diagnosis}</h3>
                    </div>
                    <div className="status-badges">
                      <span className={`status-badge status-${condition.status}`}>
                        {condition.status}
                      </span>
                    </div>
                  </div>

                  <div className="medical-item-details">
                    {condition.onsetDate && (
                      <div className="detail-item">
                        <span className="label">Onset Date:</span>
                        <span className="value">
                          {formatDate(condition.onsetDate)}
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
          )}
        </div>
      </div>{showModal && (
        <div className="medical-form-overlay" onClick={() => setShowModal(false)}>
          <div className="medical-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h3>
                {editingCondition ? 'Edit Condition' : 'Add New Condition'}
              </h3>
              <button className="close-button" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="medical-form-content">              <form onSubmit={handleSubmit}>
                <div className="form-grid">                  <div className="form-group">
                    <label htmlFor="diagnosis">Diagnosis *</label>
                    <input
                      type="text"
                      id="diagnosis"
                      name="diagnosis"
                      value={formData.diagnosis}
                      onChange={handleInputChange}
                      required
                    />
                  </div>                  <div className="form-row">
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
                  </div>                  <div className="form-group">
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
                  <button type="button" className="cancel-button" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="save-button">
                    {editingCondition ? 'Update Condition' : 'Add Condition'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conditions;
