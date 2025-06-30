import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineVisitForm from '../../components/medical/MantineVisitForm';
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

  // Get standardized configuration
  const config = getMedicalPageConfig('visits');

  // Use standardized data management
  const dataManagement = useDataManagement(visits, config);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
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

  const filteredVisits = dataManagement.data;

  return (
    <div className="medical-page-container">
      <PageHeader title="Medical Visits" icon="🏥" />

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <Button variant="ghost" size="small" onClick={clearError}>
              ×
            </Button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddVisit}>
              + Add Visit
            </Button>
          </div>

          <div className="controls-center">
            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </div>
        </div>

        {/* Mantine Filter Controls */}
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          categoryOptions={dataManagement.categoryOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        <div className="medical-items-list">
          {filteredVisits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Medical Visits Found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first medical visit.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <Button variant="primary" onClick={handleAddVisit}>
                  Add Your First Visit
                </Button>
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
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditVisit(visit)}
                      title="Edit visit"
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteVisit(visit.id)}
                      title="Delete visit"
                    >
                      🗑️ Delete
                    </Button>
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

      <MantineVisitForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVisit ? 'Edit Visit' : 'Add New Visit'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitioners={practitioners}
        editingVisit={editingVisit}
      />
    </div>
  );
};

export default Visits;
