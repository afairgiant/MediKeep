import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Medication = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners and pharmacies data
  const { practitioners: practitionersObject, pharmacies: pharmaciesObject } =
    usePatientWithStaticData();

  const practitioners = practitionersObject?.practitioners || [];
  const pharmacies = pharmaciesObject?.pharmacies || [];

  // Modern data management with useMedicalData
  const {
    items: medications,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'medication',
    apiMethodsConfig: {
      getAll: signal => apiService.getMedications(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientMedications(patientId, signal),
      create: (data, signal) => apiService.createMedication(data, signal),
      update: (id, data, signal) =>
        apiService.updateMedication(id, data, signal),
      delete: (id, signal) => apiService.deleteMedication(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('medications');

  // Use standardized data management
  const dataManagement = useDataManagement(medications, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [formData, setFormData] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    route: '',
    indication: '',
    effectivePeriod_start: '',
    effectivePeriod_end: '',
    status: 'active',
    practitioner_id: null,
    pharmacy_id: null,
  });

  const handleAddMedication = () => {
    setEditingMedication(null);
    setFormData({
      medication_name: '',
      dosage: '',
      frequency: '',
      route: '',
      indication: '',
      effectivePeriod_start: '',
      effectivePeriod_end: '',
      status: 'active',
      practitioner_id: null,
      pharmacy_id: null,
    });
    setShowModal(true);
  };

  const handleEditMedication = medication => {
    setEditingMedication(medication);
    setFormData({
      medication_name: medication.medication_name || '',
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      route: medication.route || '',
      indication: medication.indication || '',
      effectivePeriod_start: medication.effectivePeriod_start || '',
      effectivePeriod_end: medication.effectivePeriod_end || '',
      status: medication.status || 'active',
      practitioner_id: medication.practitioner_id || null,
      pharmacy_id: medication.pharmacy_id || null,
    });
    setShowModal(true);
  };

  const handleDeleteMedication = async medicationId => {
    const success = await deleteItem(medicationId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const medicationData = {
      medication_name: formData.medication_name?.trim() || '',
      dosage: formData.dosage?.trim() || '',
      frequency: formData.frequency?.trim() || '',
      route: formData.route?.trim() || '',
      indication: formData.indication?.trim() || '',
      status: formData.status || 'active',
      patient_id: currentPatient.id,
      practitioner_id: formData.practitioner_id,
      pharmacy_id: formData.pharmacy_id,
    };

    // Add dates if provided
    if (formData.effectivePeriod_start) {
      medicationData.effectivePeriod_start = formData.effectivePeriod_start;
    }
    if (formData.effectivePeriod_end) {
      medicationData.effectivePeriod_end = formData.effectivePeriod_end;
    }

    let success;
    if (editingMedication) {
      success = await updateItem(editingMedication.id, medicationData);
    } else {
      success = await createItem(medicationData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    let processedValue = value;

    // Convert empty string to null for ID fields
    if (
      (name === 'practitioner_id' || name === 'pharmacy_id') &&
      value === ''
    ) {
      processedValue = null;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  // Get processed data from data management
  const filteredMedications = dataManagement.data;

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Medications" icon="💊" />

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
            <button className="add-button" onClick={handleAddMedication}>
              + Add New Medication
            </button>
          </div>

          <div className="controls-center">
            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </div>
        </div>

        {/* Advanced Filtering Section */}
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
          {filteredMedications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💊</div>
              <h3>No medications found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Click "Add New Medication" to get started.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <button className="add-button" onClick={handleAddMedication}>
                  Add Your First Medication
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredMedications.map(medication => (
                <div key={medication.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        {medication.medication_name}
                      </h3>
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={medication.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    {medication.dosage && (
                      <div className="detail-item">
                        <span className="label">Dosage:</span>
                        <span className="value">{medication.dosage}</span>
                      </div>
                    )}
                    {medication.frequency && (
                      <div className="detail-item">
                        <span className="label">Frequency:</span>
                        <span className="value">{medication.frequency}</span>
                      </div>
                    )}
                    {medication.route && (
                      <div className="detail-item">
                        <span className="label">Route:</span>
                        <span className="value">{medication.route}</span>
                      </div>
                    )}
                    {medication.indication && (
                      <div className="detail-item">
                        <span className="label">Indication:</span>
                        <span className="value">{medication.indication}</span>
                      </div>
                    )}
                    {medication.practitioner && (
                      <div className="detail-item">
                        <span className="label">Prescriber:</span>
                        <span className="value">
                          {medication.practitioner.name}
                        </span>
                      </div>
                    )}
                    {medication.pharmacy && (
                      <div className="detail-item">
                        <span className="label">Pharmacy:</span>
                        <span className="value">
                          {medication.pharmacy.name}
                        </span>
                      </div>
                    )}
                    {medication.effectivePeriod_start && (
                      <div className="detail-item">
                        <span className="label">Start Date:</span>
                        <span className="value">
                          {formatDate(medication.effectivePeriod_start)}
                        </span>
                      </div>
                    )}
                    {medication.effectivePeriod_end && (
                      <div className="detail-item">
                        <span className="label">End Date:</span>
                        <span className="value">
                          {formatDate(medication.effectivePeriod_end)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="medical-item-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEditMedication(medication)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteMedication(medication.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={filteredMedications}
              columns={[
                { header: 'Medication Name', accessor: 'medication_name' },
                { header: 'Dosage', accessor: 'dosage' },
                { header: 'Frequency', accessor: 'frequency' },
                { header: 'Route', accessor: 'route' },
                { header: 'Indication', accessor: 'indication' },
                { header: 'Prescriber', accessor: 'practitioner_name' },
                { header: 'Pharmacy', accessor: 'pharmacy_name' },
                { header: 'Start Date', accessor: 'effectivePeriod_start' },
                { header: 'End Date', accessor: 'effectivePeriod_end' },
                { header: 'Status', accessor: 'status' },
              ]}
              patientData={currentPatient}
              tableName="Medications"
              onEdit={handleEditMedication}
              onDelete={handleDeleteMedication}
              formatters={{
                medication_name: value => (
                  <span className="primary-field">{value}</span>
                ),
                effectivePeriod_start: value =>
                  value ? formatDate(value) : '-',
                effectivePeriod_end: value => (value ? formatDate(value) : '-'),
                status: value => <StatusBadge status={value} size="small" />,
                practitioner_name: (value, item) =>
                  item.practitioner?.name || '-',
                pharmacy_name: (value, item) => item.pharmacy?.name || '-',
                dosage: value => value || '-',
                frequency: value => value || '-',
                route: value => value || '-',
                indication: value =>
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
        title={editingMedication ? 'Edit Medication' : 'Add New Medication'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="medication_name">Medication Name *</label>
              <input
                type="text"
                id="medication_name"
                name="medication_name"
                value={formData.medication_name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Lisinopril, Metformin"
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
                placeholder="e.g., 10mg, 1 tablet"
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
                placeholder="e.g., Once daily, Twice daily"
              />
            </div>

            <div className="form-group">
              <label htmlFor="route">Route</label>
              <select
                id="route"
                name="route"
                value={formData.route}
                onChange={handleInputChange}
              >
                <option value="">Select Route</option>
                <option value="oral">Oral</option>
                <option value="injection">Injection</option>
                <option value="topical">Topical</option>
                <option value="intravenous">Intravenous</option>
                <option value="intramuscular">Intramuscular</option>
                <option value="subcutaneous">Subcutaneous</option>
                <option value="inhalation">Inhalation</option>
                <option value="nasal">Nasal</option>
                <option value="rectal">Rectal</option>
                <option value="sublingual">Sublingual</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="indication">Indication</label>
              <input
                type="text"
                id="indication"
                name="indication"
                value={formData.indication}
                onChange={handleInputChange}
                placeholder="What is this medication for?"
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
                  <option value="stopped">Stopped</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="effectivePeriod_start">Start Date</label>
                <input
                  type="date"
                  id="effectivePeriod_start"
                  name="effectivePeriod_start"
                  value={formData.effectivePeriod_start}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="effectivePeriod_end">End Date</label>
                <input
                  type="date"
                  id="effectivePeriod_end"
                  name="effectivePeriod_end"
                  value={formData.effectivePeriod_end}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="practitioner_id">Prescribing Provider</label>
                <select
                  id="practitioner_id"
                  name="practitioner_id"
                  value={formData.practitioner_id || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select Provider</option>
                  {practitioners.map(practitioner => (
                    <option key={practitioner.id} value={practitioner.id}>
                      {practitioner.name} - {practitioner.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pharmacy_id">Pharmacy</label>
                <select
                  id="pharmacy_id"
                  name="pharmacy_id"
                  value={formData.pharmacy_id || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select Pharmacy</option>
                  {pharmacies.map(pharmacy => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                      {pharmacy.city ? ` - ${pharmacy.city}` : ''}
                      {pharmacy.state ? `, ${pharmacy.state}` : ''}
                    </option>
                  ))}
                </select>
              </div>
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
              {editingMedication ? 'Update Medication' : 'Add Medication'}
            </button>
          </div>
        </form>
      </MedicalFormModal>
    </div>
  );
};

export default Medication;
