import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import '../../styles/shared/MedicalPageShared.css';

const Conditions = () => {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('diagnosedDate');
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    severity: 'mild',
    diagnosedDate: '',
    onsetDate: '',
    resolvedDate: '',
    notes: ''
  });

  useEffect(() => {
    fetchConditions();
  }, []);

  const fetchConditions = async () => {
    try {
      setLoading(true);
      const response = await apiService.getConditions();
      setConditions(response.data || []);
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
      name: '',
      description: '',
      status: 'active',
      severity: 'mild',
      diagnosedDate: '',
      onsetDate: '',
      resolvedDate: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleEditCondition = (condition) => {
    setEditingCondition(condition);
    setFormData({
      name: condition.name || '',
      description: condition.description || '',
      status: condition.status || 'active',
      severity: condition.severity || 'mild',
      diagnosedDate: condition.diagnosedDate ? condition.diagnosedDate.split('T')[0] : '',
      onsetDate: condition.onsetDate ? condition.onsetDate.split('T')[0] : '',
      resolvedDate: condition.resolvedDate ? condition.resolvedDate.split('T')[0] : '',
      notes: condition.notes || ''
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
        diagnosedDate: formData.diagnosedDate || null,
        onsetDate: formData.onsetDate || null,
        resolvedDate: formData.resolvedDate || null
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
      const matchesSearch = condition.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          condition.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || condition.status === statusFilter;
      const matchesSeverity = severityFilter === 'all' || condition.severity === severityFilter;
      
      return matchesSearch && matchesStatus && matchesSeverity;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'severity':
          const severityOrder = { 'mild': 1, 'moderate': 2, 'severe': 3, 'critical': 4 };
          return (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0);
        case 'diagnosedDate':
        default:
          return new Date(b.diagnosedDate || 0) - new Date(a.diagnosedDate || 0);
      }
    });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'warning';
      case 'resolved': return 'success';
      case 'chronic': return 'error';
      case 'monitored': return 'info';
      default: return 'info';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'mild': return 'success';
      case 'moderate': return 'warning';
      case 'severe': return 'error';
      case 'critical': return 'error';
      default: return 'info';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
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
        <h1 className="medical-page-title">Medical Conditions</h1>
        <div className="header-actions">
          <button className="primary-btn add-btn" onClick={handleAddCondition}>
            <span>+</span>
            Add Condition
          </button>
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search conditions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="filters-container">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="chronic">Chronic</option>
            <option value="monitored">Monitored</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Severity</label>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="diagnosedDate">Diagnosed Date</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="severity">Severity</option>
          </select>
        </div>
      </div>      {filteredConditions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <h3>No Medical Conditions Found</h3>
          <p>
            {searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Start by adding your first medical condition.'}
          </p>
          {!searchTerm && statusFilter === 'all' && severityFilter === 'all' && (
            <button className="primary-btn" onClick={handleAddCondition}>
              Add Your First Condition
            </button>
          )}
        </div>
      ) : (
        <div className="medical-grid">
          {filteredConditions.map((condition) => (
            <MedicalCard
              key={condition.id}
              className="medical-card"
              onEdit={() => handleEditCondition(condition)}
              onDelete={() => handleDeleteCondition(condition.id)}
            >
              <div className="card-header">
                <div>
                  <h3 className="card-title">{condition.name}</h3>
                  {condition.description && (
                    <p className="card-description">{condition.description}</p>
                  )}
                </div>
                <div className="status-badges">
                  <StatusBadge status={condition.status} color={getStatusColor(condition.status)} />
                  <StatusBadge status={condition.severity} color={getSeverityColor(condition.severity)} />
                </div>
              </div>

              <div className="card-details">
                <div className="detail-item">
                  <span className="detail-label">Diagnosed</span>
                  <span className="detail-value">
                    {formatDate(condition.diagnosedDate)}
                  </span>
                </div>
                {condition.onsetDate && (
                  <div className="detail-item">
                    <span className="detail-label">Onset</span>
                    <span className="detail-value">
                      {formatDate(condition.onsetDate)}
                    </span>
                  </div>
                )}
                {condition.resolvedDate && (
                  <div className="detail-item">
                    <span className="detail-label">Resolved</span>
                    <span className="detail-value">
                      {formatDate(condition.resolvedDate)}
                    </span>
                  </div>
                )}
              </div>

              {condition.notes && (
                <div className="card-notes">
                  <div className="notes-label">Notes</div>
                  <div className="notes-content">{condition.notes}</div>
                </div>
              )}
            </MedicalCard>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCondition ? 'Edit Condition' : 'Add New Condition'}
              </h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Condition Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
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
                    <option value="monitored">Monitored</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="severity">Severity</label>
                  <select
                    id="severity"
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="diagnosedDate">Diagnosed Date</label>
                  <input
                    type="date"
                    id="diagnosedDate"
                    name="diagnosedDate"
                    value={formData.diagnosedDate}
                    onChange={handleInputChange}
                  />
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

              {formData.status === 'resolved' && (
                <div className="form-group">
                  <label htmlFor="resolvedDate">Resolved Date</label>
                  <input
                    type="date"
                    id="resolvedDate"
                    name="resolvedDate"
                    value={formData.resolvedDate}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="4"
                />
              </div>              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingCondition ? 'Update Condition' : 'Add Condition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conditions;
