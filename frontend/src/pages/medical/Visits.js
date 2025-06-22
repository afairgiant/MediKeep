import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { useCurrentPatient, usePractitioners } from '../../hooks/useGlobalData';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Visits = () => {
  const navigate = useNavigate();
  
  // Using global state for patient and practitioners data
  const { 
    patient: patientData, 
    loading: patientLoading 
  } = useCurrentPatient();
  const { 
    practitioners, 
    loading: practitionersLoading 
  } = usePractitioners();

  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  // Combine loading states
  const loading = patientLoading || practitionersLoading || visitsLoading;
  
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);

  const [formData, setFormData] = useState({
    reason: '',
    date: '',
    notes: '',
    practitioner_id: '',
  });
  // Fetch visits when patient data becomes available
  const fetchVisits = useCallback(async () => {
    if (!patientData?.id) {
      setVisitsLoading(false);
      return;
    }

    try {
      setVisitsLoading(true);
      setError('');

      const response = await apiService.getPatientEncounters(patientData.id);
      setVisits(response.data || response || []);
    } catch (err) {
      setError('Failed to load visits. Please try again.');
      console.error('Error fetching visits:', err);
    } finally {
      setVisitsLoading(false);
    }
  }, [patientData?.id]);

  useEffect(() => {
    if (patientData?.id) {
      fetchVisits();
    } else if (patientData === null && !patientLoading) {
      setVisitsLoading(false);
    }
  }, [patientData?.id, patientData, patientLoading, fetchVisits]);
  const handleAddVisit = () => {
    setEditingVisit(null);
    setFormData({
      reason: '',
      date: '',
      notes: '',
      practitioner_id: '',
    });
    setShowModal(true);
  };
  const handleEditVisit = visit => {
    setEditingVisit(visit);
    setFormData({
      reason: visit.reason || '',
      date: visit.date ? visit.date.split('T')[0] : '',
      notes: visit.notes || '',
      practitioner_id: visit.practitioner_id || '',
    });
    setShowModal(true);
  };
  const handleDeleteVisit = async visitId => {
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
  const handleSubmit = async e => {
    e.preventDefault();

    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      const visitData = {
        reason: formData.reason,
        date: formData.date,
        notes: formData.notes || null,
        practitioner_id: formData.practitioner_id || null,
        patient_id: patientData.id,
      };

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
  }; // Helper function to get practitioner display name
  const getPractitionerDisplay = practitionerId => {
    if (!practitionerId) return 'No practitioner assigned';

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `Dr. ${practitioner.name} - ${practitioner.specialty}`;
    }
    return `Practitioner ID: ${practitionerId}`;
  };

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  const filteredVisits = visits
    .filter(visit => {
      const matchesSearch =
        visit.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'reason':
          return (a.reason || '').localeCompare(b.reason || '');
        case 'date':
        default:
          return new Date(b.date || 0) - new Date(a.date || 0);
      }
    });
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
    <div className="medical-page-container">
      <header className="medical-page-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>🏥 Medical Visits</h1>
      </header>

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}{' '}
        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddVisit}>
              + Add Visit
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
                placeholder="Search visits..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>{' '}
        <div className="filters-container">
          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="date">Date</option>
              <option value="reason">Reason</option>
            </select>
          </div>
        </div>
        {filteredVisits.length === 0 ? (
          <div className="no-visits">
            <div className="no-visits-icon">🏥</div>
            <h3>No Medical Visits Found</h3>{' '}
            <p>
              {searchTerm
                ? 'Try adjusting your search criteria.'
                : 'Start by adding your first medical visit.'}
            </p>
            {!searchTerm && (
              <button className="add-button" onClick={handleAddVisit}>
                Add Your First Visit
              </button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="medical-items-grid">
            {filteredVisits.map(visit => (
              <div key={visit.id} className="medical-item-card">
                <div className="medical-item-header">
                  <div className="medical-item-info">
                    <h3>{visit.reason || 'General Visit'}</h3>
                    <p className="medical-item-date">
                      {formatDate(visit.date)}
                    </p>
                    <p className="medical-item-practitioner">
                      👨‍⚕️ {getPractitionerDisplay(visit.practitioner_id)}
                    </p>
                  </div>
                </div>
                <div className="medical-item-actions">
                  <button
                    className="edit-button"
                    onClick={() => handleEditVisit(visit)}
                    title="Edit visit"
                  >
                    ✏️
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteVisit(visit.id)}
                    title="Delete visit"
                  >
                    🗑️
                  </button>
                </div>
                <div className="medical-item-content">
                  {visit.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{visit.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MedicalTable
            data={filteredVisits}
            columns={[
              { header: 'Visit Date', accessor: 'date' },
              { header: 'Reason', accessor: 'reason' },
              { header: 'Practitioner', accessor: 'practitioner_name' },
              { header: 'Notes', accessor: 'notes' },
            ]}
            patientData={patientData}
            tableName="Visit History"
            onEdit={handleEditVisit}
            onDelete={handleDeleteVisit}
            formatters={{
              date: value => (
                <span className="primary-field">{formatDate(value)}</span>
              ),
              reason: value => value || 'General Visit',
              practitioner_name: (value, item) =>
                getPractitionerDisplay(item.practitioner_id),
              notes: value =>
                value ? (
                  <span title={value}>
                    {value.length > 50 ? `${value.substring(0, 50)}...` : value}
                  </span>
                ) : (
                  '-'
                ),
            }}
          />
        )}
      </div>

      {showModal && (
        <div
          className="medical-form-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="medical-form-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="medical-form-header">
              <h2>{editingVisit ? 'Edit Visit' : 'Add New Visit'}</h2>
              <button
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>{' '}
            <form onSubmit={handleSubmit} className="medical-form-content">
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
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>{' '}
              <div className="form-group">
                <label htmlFor="practitioner_id">Practitioner</label>
                <select
                  id="practitioner_id"
                  name="practitioner_id"
                  value={formData.practitioner_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select a practitioner (optional)</option>
                  {practitioners.map(practitioner => (
                    <option key={practitioner.id} value={practitioner.id}>
                      Dr. {practitioner.name} - {practitioner.specialty}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="notes">Additional Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Optional - Any additional notes about the visit"
                />
              </div>
              <div className="medical-form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="save-button">
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
