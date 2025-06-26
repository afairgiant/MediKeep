import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Visits = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Modern data management with useMedicalData for encounters
  const {
    items: visits,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'encounter',
    apiMethodsConfig: {
      getAll: signal => apiService.getEncounters(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEncounters(patientId, signal),
      create: (data, signal) => apiService.createEncounter(data, signal),
      update: (id, data, signal) =>
        apiService.updateEncounter(id, data, signal),
      delete: (id, signal) => apiService.deleteEncounter(id, signal),
    },
    requiresPatient: true,
  });

  // Form and filter state
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [formData, setFormData] = useState({
    reason: '',
    date: '',
    notes: '',
    practitioner_id: '',
  });

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
    const success = await deleteItem(visitId);
    if (success) {
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.reason.trim()) {
      setError('Reason for visit is required');
      return;
    }

    if (!formData.date) {
      setError('Visit date is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const visitData = {
      reason: formData.reason,
      date: formData.date,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingVisit) {
      success = await updateItem(editingVisit.id, visitData);
    } else {
      success = await createItem(visitData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  // Helper function to get practitioner display name
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

  // Enhanced filtering and sorting logic
  const getFilteredAndSortedVisits = () => {
    return visits
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
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading visits...</p>
        </div>
      </div>
    );
  }

  const filteredVisits = getFilteredAndSortedVisits();

  return (
    <div className="medical-page-container">
      <header className="medical-page-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>🏥 Medical Visits</h1>
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
        </div>

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

        <div className="medical-items-list">
          {filteredVisits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Medical Visits Found</h3>
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
                    <div className="item-info">
                      <h3 className="item-title">
                        {visit.reason || 'General Visit'}
                      </h3>
                      <p className="item-subtitle">{formatDate(visit.date)}</p>
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Practitioner:</span>
                      <span className="value">
                        👨‍⚕️ {getPractitionerDisplay(visit.practitioner_id)}
                      </span>
                    </div>
                  </div>

                  {visit.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{visit.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEditVisit(visit)}
                      title="Edit visit"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteVisit(visit.id)}
                      title="Delete visit"
                    >
                      🗑️ Delete
                    </button>
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
              patientData={currentPatient}
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
        title={editingVisit ? 'Edit Visit' : 'Add New Visit'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="reason">Reason for Visit *</label>
              <input
                type="text"
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
                placeholder="e.g., Annual Checkup, Follow-up"
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
            </div>

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
                rows="4"
                placeholder="Optional - Any additional notes about the visit"
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
              {editingVisit ? 'Update Visit' : 'Add Visit'}
            </button>
          </div>
        </form>
      </MedicalFormModal>
    </div>
  );
};

export default Visits;
