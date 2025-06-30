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
import MantineProcedureForm from '../../components/medical/MantineProcedureForm';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';
import '../../styles/pages/ProcedureCards.css';

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

  // Get standardized configuration
  const config = getMedicalPageConfig('procedures');

  // Use standardized data management
  const dataManagement = useDataManagement(procedures, config);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState(null);
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

  // Get processed data from data management
  const filteredProcedures = dataManagement.data;

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

  return (
    <div className="medical-page-container">
      <PageHeader title="Procedures" icon="🔬" />

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
            <Button variant="primary" onClick={handleAddProcedure}>
              + Add Procedure
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
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        <div className="medical-items-list">
          {filteredProcedures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <h3>No Procedures Found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first procedure.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <Button variant="primary" onClick={handleAddProcedure}>
                  Add Your First Procedure
                </Button>
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
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditProcedure(procedure)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteProcedure(procedure.id)}
                    >
                      🗑️ Delete
                    </Button>
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

      <MantineProcedureForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProcedure ? 'Edit Procedure' : 'Add New Procedure'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitioners={practitioners}
        editingProcedure={editingProcedure}
      />
    </div>
  );
};

export default Procedures;
