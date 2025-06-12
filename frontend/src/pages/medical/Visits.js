import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import { formatDate, formatDateTime } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';

const Visits = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [formData, setFormData] = useState({
    type: 'consultation',
    status: 'scheduled',
    date: '',
    time: '',
    provider: '',
    facility: '',
    reason: '',
    diagnosis: '',
    treatment: '',
    notes: '',
    followUpRequired: false,
    followUpDate: ''
  });

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const response = await apiService.getEncounters();
      setVisits(response.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load visits. Please try again.');
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisit = () => {
    setEditingVisit(null);
    setFormData({
      type: 'consultation',
      status: 'scheduled',
      date: '',
      time: '',
      provider: '',
      facility: '',
      reason: '',
      diagnosis: '',
      treatment: '',
      notes: '',
      followUpRequired: false,
      followUpDate: ''
    });
    setShowModal(true);
  };

  const handleEditVisit = (visit) => {
    setEditingVisit(visit);
    const visitDateTime = visit.date ? new Date(visit.date) : new Date();
    setFormData({
      type: visit.type || 'consultation',
      status: visit.status || 'scheduled',
      date: visit.date ? visit.date.split('T')[0] : '',
      time: visit.date ? visitDateTime.toTimeString().slice(0, 5) : '',
      provider: visit.provider || '',
      facility: visit.facility || '',
      reason: visit.reason || '',
      diagnosis: visit.diagnosis || '',
      treatment: visit.treatment || '',
      notes: visit.notes || '',
      followUpRequired: visit.followUpRequired || false,
      followUpDate: visit.followUpDate ? visit.followUpDate.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleDeleteVisit = async (visitId) => {
    if (window.confirm('Are you sure you want to delete this visit?')) {
      try {
        await apiService.deleteEncounter(visitId);
        await fetchVisits();
        setSuccessMessage('Visit deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete visit. Please try again.');
        console.error('Error deleting visit:', err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const visitDateTime = formData.date && formData.time 
        ? new Date(`${formData.date}T${formData.time}`)
        : null;

      const visitData = {
        ...formData,
        date: visitDateTime ? visitDateTime.toISOString() : null,
        followUpDate: formData.followUpDate || null
      };

      // Remove time field as it's combined with date
      delete visitData.time;

      if (editingVisit) {
        await apiService.updateEncounter(editingVisit.id, visitData);
        setSuccessMessage('Visit updated successfully');
      } else {
        await apiService.createEncounter(visitData);
        setSuccessMessage('Visit added successfully');
      }

      setShowModal(false);
      await fetchVisits();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save visit. Please try again.');
      console.error('Error saving visit:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const filteredVisits = visits
    .filter(visit => {
      const matchesSearch = visit.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          visit.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          visit.facility?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || visit.status === statusFilter;
      const matchesType = typeFilter === 'all' || visit.type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'provider':
          return (a.provider || '').localeCompare(b.provider || '');
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'date':
        default:
          return new Date(b.date || 0) - new Date(a.date || 0);
      }
    });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'in-progress': return 'warning';
      case 'no-show': return 'error';
      default: return 'info';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'consultation': return 'info';
      case 'follow-up': return 'warning';
      case 'emergency': return 'error';
      case 'routine': return 'success';
      case 'specialist': return 'info';      default: return 'info';
    }
  };

  if (loading) {
    return (
      <div className="visits-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="visits-page">
      <div className="visits-header">
        <h1 className="visits-title">Medical Visits</h1>
        <div className="visits-actions">
          <button className="add-visit-btn" onClick={handleAddVisit}>
            <span>+</span>
            Add Visit
          </button>
          <div className="visits-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search visits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="visits-filters">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="routine">Routine</option>
            <option value="emergency">Emergency</option>
            <option value="specialist">Specialist</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Date</option>
            <option value="provider">Provider</option>
            <option value="type">Type</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {filteredVisits.length === 0 ? (
        <div className="no-visits">
          <div className="no-visits-icon">🏥</div>
          <h3>No Medical Visits Found</h3>
          <p>
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Start by adding your first medical visit.'}
          </p>
          {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
            <button className="add-visit-btn" onClick={handleAddVisit}>
              Add Your First Visit
            </button>
          )}
        </div>
      ) : (
        <div className="visits-grid">
          {filteredVisits.map((visit) => (
            <MedicalCard
              key={visit.id}
              className="visit-card"
              onEdit={() => handleEditVisit(visit)}
              onDelete={() => handleDeleteVisit(visit.id)}
            >
              <div className="visit-card-header">
                <div>
                  <h3 className="visit-reason">{visit.reason || 'General Visit'}</h3>
                  <p className="visit-datetime">{formatDateTime(visit.date)}</p>
                </div>
                <div className="visit-badges">
                  <StatusBadge status={visit.status} color={getStatusColor(visit.status)} />
                  <StatusBadge status={visit.type} color={getTypeColor(visit.type)} />
                </div>
              </div>

              <div className="visit-details">
                {visit.provider && (
                  <div className="detail-item">
                    <span className="detail-label">Provider</span>
                    <span className="detail-value">{visit.provider}</span>
                  </div>
                )}
                {visit.facility && (
                  <div className="detail-item">
                    <span className="detail-label">Facility</span>
                    <span className="detail-value">{visit.facility}</span>
                  </div>
                )}
                {visit.diagnosis && (
                  <div className="detail-item">
                    <span className="detail-label">Diagnosis</span>
                    <span className="detail-value">{visit.diagnosis}</span>
                  </div>
                )}
                {visit.treatment && (
                  <div className="detail-item">
                    <span className="detail-label">Treatment</span>
                    <span className="detail-value">{visit.treatment}</span>
                  </div>
                )}
              </div>

              {visit.followUpRequired && visit.followUpDate && (
                <div className="follow-up-info">
                  <span className="follow-up-label">Follow-up Required</span>
                  <span className="follow-up-date">{formatDate(visit.followUpDate)}</span>
                </div>
              )}

              {visit.notes && (
                <div className="visit-notes">
                  <div className="notes-label">Notes</div>
                  <div className="notes-content">{visit.notes}</div>
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
                {editingVisit ? 'Edit Visit' : 'Add New Visit'}
              </h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Visit Type</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="routine">Routine</option>
                    <option value="emergency">Emergency</option>
                    <option value="specialist">Specialist</option>
                  </select>
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
                    <option value="completed">Completed</option>
                    <option value="in-progress">In Progress</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No Show</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="date">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="time">Time</label>
                  <input
                    type="time"
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="provider">Healthcare Provider</label>
                  <input
                    type="text"
                    id="provider"
                    name="provider"
                    value={formData.provider}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="facility">Medical Facility</label>
                  <input
                    type="text"
                    id="facility"
                    name="facility"
                    value={formData.facility}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reason">Reason for Visit *</label>
                <input
                  type="text"
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="diagnosis">Diagnosis</label>
                <textarea
                  id="diagnosis"
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label htmlFor="treatment">Treatment/Recommendations</label>
                <textarea
                  id="treatment"
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Additional Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="followUpRequired"
                    checked={formData.followUpRequired}
                    onChange={handleInputChange}
                  />
                  Follow-up required
                </label>
              </div>

              {formData.followUpRequired && (
                <div className="form-group">
                  <label htmlFor="followUpDate">Follow-up Date</label>
                  <input
                    type="date"
                    id="followUpDate"
                    name="followUpDate"
                    value={formData.followUpDate}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVisit ? 'Update Visit' : 'Add Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
