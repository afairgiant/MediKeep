import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Procedures = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Modern data management with useMedicalData
  const {
    items: procedures,
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
    entityName: 'procedure',
    apiMethodsConfig: {
      getAll: signal => apiService.getProcedures(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientProcedures(patientId, signal),
      create: (data, signal) => apiService.createProcedure(data, signal),
      update: (id, data, signal) =>
        apiService.updateProcedure(id, data, signal),
      delete: (id, signal) => apiService.deleteProcedure(id, signal),
    },
    requiresPatient: true,
  });

  // Form and filter state
  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('procedure_date');
  const [formData, setFormData] = useState({
    procedure_name: '',
    procedure_type: '',
    description: '',
    procedure_date: '',
    status: 'scheduled',
    notes: '',
    facility: '',
    practitioner_id: '',
  });

  const handleAddProcedure = () => {
    setEditingProcedure(null);
    setFormData({
      procedure_name: '',
      procedure_type: '',
      description: '',
      procedure_date: '',
      status: 'scheduled',
      notes: '',
      facility: '',
      practitioner_id: '',
    });
    setShowModal(true);
  };

  const handleEditProcedure = procedure => {
    setEditingProcedure(procedure);
    setFormData({
      procedure_name: procedure.procedure_name || '',
      procedure_type: procedure.code || '',
      description: procedure.description || '',
      procedure_date: procedure.date || '',
      status: procedure.status || 'scheduled',
      notes: procedure.notes || '',
      facility: procedure.facility || '',
      practitioner_id: procedure.practitioner_id || '',
    });
    setShowModal(true);
  };

  const handleDeleteProcedure = async procedureId => {
    const success = await deleteItem(procedureId);
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

    if (!formData.procedure_name.trim()) {
      setError('Procedure name is required');
      return;
    }

    if (!formData.procedure_date) {
      setError('Procedure date is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const procedureData = {
      procedure_name: formData.procedure_name,
      code: formData.procedure_type || null,
      description: formData.description,
      date: formData.procedure_date || null,
      status: formData.status,
      notes: formData.notes || null,
      facility: formData.facility || null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id)
        : null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingProcedure) {
      success = await updateItem(editingProcedure.id, procedureData);
    } else {
      success = await createItem(procedureData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  // Enhanced filtering and sorting logic
  const getFilteredAndSortedProcedures = () => {
    return procedures
      .filter(procedure => {
        const matchesSearch =
          procedure.procedure_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          procedure.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          procedure.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || procedure.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'procedure_name':
            return (a.procedure_name || '').localeCompare(
              b.procedure_name || ''
            );
          case 'status':
            return (a.status || '').localeCompare(b.status || '');
          case 'procedure_date':
          default:
            return new Date(b.date || 0) - new Date(a.date || 0);
        }
      });
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'scheduled':
        return '📅';
      case 'in-progress':
        return '🔄';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      case 'postponed':
        return '⏸️';
      default:
        return '❓';
    }
  };

  const getProcedureTypeIcon = type => {
    switch (type?.toLowerCase()) {
      case 'surgical':
        return '🔬';
      case 'diagnostic':
        return '🔍';
      case 'therapeutic':
        return '💊';
      case 'preventive':
        return '🛡️';
      case 'emergency':
        return '🚨';
      default:
        return '🏥';
    }
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading procedures...</p>
        </div>
      </div>
    );
  }

  const filteredProcedures = getFilteredAndSortedProcedures();

  return (
    <div className="medical-page-container">
      <PageHeader title="Procedures" icon="🔬" />

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
            <button className="add-button" onClick={handleAddProcedure}>
              + Add Procedure
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
                placeholder="Search procedures..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        <div className="filters-container">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="filter-select"
            >
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
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="procedure_date">Procedure Date</option>
              <option value="procedure_name">Procedure Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

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
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredProcedures.map(procedure => (
                <div key={procedure.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className="type-icon">
                          {getProcedureTypeIcon(procedure.code)}
                        </span>
                        {procedure.procedure_name}
                      </h3>
                      {procedure.code && (
                        <div className="item-subtitle">{procedure.code}</div>
                      )}
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={procedure.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    {procedure.date && (
                      <div className="detail-item">
                        <span className="label">Procedure Date:</span>
                        <span className="value">
                          {formatDate(procedure.date)}
                        </span>
                      </div>
                    )}
                    {procedure.facility && (
                      <div className="detail-item">
                        <span className="label">Facility:</span>
                        <span className="value">{procedure.facility}</span>
                      </div>
                    )}
                    {procedure.practitioner_id && (
                      <div className="detail-item">
                        <span className="label">Performing Practitioner:</span>
                        <span className="value">
                          {practitioners.find(
                            p => p.id === procedure.practitioner_id
                          )?.name ||
                            `Practitioner ID: ${procedure.practitioner_id}`}
                        </span>
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
          ) : (
            <MedicalTable
              data={filteredProcedures}
              columns={[
                { header: 'Procedure Name', accessor: 'procedure_name' },
                { header: 'Code', accessor: 'code' },
                { header: 'Date', accessor: 'date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Facility', accessor: 'facility' },
                { header: 'Practitioner', accessor: 'practitioner_name' },
                { header: 'Description', accessor: 'description' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Procedures"
              onEdit={handleEditProcedure}
              onDelete={handleDeleteProcedure}
              formatters={{
                procedure_name: value => (
                  <span className="primary-field">{value}</span>
                ),
                date: value => (value ? formatDate(value) : '-'),
                status: value => <StatusBadge status={value} size="small" />,
                practitioner_name: (value, item) => {
                  if (!item.practitioner_id) return '-';
                  return (
                    practitioners.find(p => p.id === item.practitioner_id)
                      ?.name || `Practitioner ID: ${item.practitioner_id}`
                  );
                },
                description: value =>
                  value ? (
                    <span title={value}>
                      {value.length > 50
                        ? `${value.substring(0, 50)}...`
                        : value}
                    </span>
                  ) : (
                    '-'
                  ),
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
        title={editingProcedure ? 'Edit Procedure' : 'Add New Procedure'}
      >
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

            <div className="form-row">
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
            </div>

            <div className="form-row">
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

              <div className="form-group">
                <label htmlFor="practitioner_id">Performing Practitioner</label>
                <select
                  id="practitioner_id"
                  name="practitioner_id"
                  value={formData.practitioner_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select practitioner</option>
                  {practitioners.map(practitioner => (
                    <option key={practitioner.id} value={practitioner.id}>
                      {practitioner.name} - {practitioner.specialty}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
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

            <div className="form-group">
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
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="save-button">
              {editingProcedure ? 'Update Procedure' : 'Add Procedure'}
            </button>
          </div>
        </form>
      </MedicalFormModal>
    </div>
  );
};

export default Procedures;
