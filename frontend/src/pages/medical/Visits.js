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
    visit_type: '',
    chief_complaint: '',
    diagnosis: '',
    treatment_plan: '',
    follow_up_instructions: '',
    duration_minutes: '',
    location: '',
    priority: '',
  });

  const handleAddVisit = () => {
    setEditingVisit(null);
    setFormData({
      reason: '',
      date: '',
      notes: '',
      practitioner_id: '',
      visit_type: '',
      chief_complaint: '',
      diagnosis: '',
      treatment_plan: '',
      follow_up_instructions: '',
      duration_minutes: '',
      location: '',
      priority: '',
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
      visit_type: visit.visit_type || '',
      chief_complaint: visit.chief_complaint || '',
      diagnosis: visit.diagnosis || '',
      treatment_plan: visit.treatment_plan || '',
      follow_up_instructions: visit.follow_up_instructions || '',
      duration_minutes: visit.duration_minutes || '',
      location: visit.location || '',
      priority: visit.priority || '',
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
      visit_type: formData.visit_type || null,
      chief_complaint: formData.chief_complaint || null,
      diagnosis: formData.diagnosis || null,
      treatment_plan: formData.treatment_plan || null,
      follow_up_instructions: formData.follow_up_instructions || null,
      duration_minutes: formData.duration_minutes || null,
      location: formData.location || null,
      priority: formData.priority || null,
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
      <PageHeader title="Medical Visits" icon="" />

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
              <div className="empty-icon"></div>
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
                      <p className="item-subtitle">
                        {formatDate(visit.date)}
                        {visit.visit_type && (
                          <span className="visit-type-badge">
                            • {visit.visit_type}
                          </span>
                        )}
                        {visit.priority && (
                          <span
                            className={`priority-badge priority-${visit.priority}`}
                          >
                            • {visit.priority}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Practitioner:</span>
                      <span className="value">
                        {getPractitionerDisplay(visit.practitioner_id)}
                      </span>
                    </div>

                    {visit.chief_complaint && (
                      <div className="detail-item">
                        <span className="label">Chief Complaint:</span>
                        <span className="value">{visit.chief_complaint}</span>
                      </div>
                    )}

                    {visit.location && (
                      <div className="detail-item">
                        <span className="label">Location:</span>
                        <span className="value">{visit.location}</span>
                      </div>
                    )}

                    {visit.duration_minutes && (
                      <div className="detail-item">
                        <span className="label">Duration:</span>
                        <span className="value">
                          {visit.duration_minutes} minutes
                        </span>
                      </div>
                    )}
                  </div>

                  {visit.diagnosis && (
                    <div className="medical-item-section">
                      <div className="section-label">Diagnosis/Assessment</div>
                      <div className="section-content">{visit.diagnosis}</div>
                    </div>
                  )}

                  {visit.treatment_plan && (
                    <div className="medical-item-section">
                      <div className="section-label">Treatment Plan</div>
                      <div className="section-content">
                        {visit.treatment_plan}
                      </div>
                    </div>
                  )}

                  {visit.follow_up_instructions && (
                    <div className="medical-item-section">
                      <div className="section-label">
                        Follow-up Instructions
                      </div>
                      <div className="section-content">
                        {visit.follow_up_instructions}
                      </div>
                    </div>
                  )}

                  {visit.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Additional Notes</div>
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
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteVisit(visit.id)}
                      title="Delete visit"
                    >
                      Delete
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
                { header: 'Visit Type', accessor: 'visit_type' },
                { header: 'Chief Complaint', accessor: 'chief_complaint' },
                { header: 'Practitioner', accessor: 'practitioner_name' },
                { header: 'Location', accessor: 'location' },
                { header: 'Priority', accessor: 'priority' },
                { header: 'Diagnosis', accessor: 'diagnosis' },
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
                visit_type: value => value || '-',
                chief_complaint: value =>
                  value ? (
                    <span title={value}>
                      {value.length > 30
                        ? `${value.substring(0, 30)}...`
                        : value}
                    </span>
                  ) : (
                    '-'
                  ),
                practitioner_name: (value, item) =>
                  getPractitionerDisplay(item.practitioner_id),
                location: value => value || '-',
                priority: value =>
                  value ? (
                    <span className={`priority-badge priority-${value}`}>
                      {value}
                    </span>
                  ) : (
                    '-'
                  ),
                diagnosis: value =>
                  value ? (
                    <span title={value}>
                      {value.length > 40
                        ? `${value.substring(0, 40)}...`
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
