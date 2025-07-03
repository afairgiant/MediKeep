import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData, useDataManagement } from '../../hooks';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineEmergencyContactForm from '../../components/medical/MantineEmergencyContactForm';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS } from '../../utils/statusConfig';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/EmergencyContacts.css';

const EmergencyContacts = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Standardized data management
  const {
    items: emergencyContacts,
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
    entityName: 'emergency_contact',
    apiMethodsConfig: {
      getAll: signal => apiService.getEmergencyContacts(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEmergencyContacts(patientId, signal),
      create: (data, signal) => apiService.createEmergencyContact(data, signal),
      update: (id, data, signal) =>
        apiService.updateEmergencyContact(id, data, signal),
      delete: (id, signal) => apiService.deleteEmergencyContact(id, signal),
    },
    requiresPatient: true,
  });

  // Standardized filtering and sorting using configuration
  const config = getMedicalPageConfig('emergency_contacts');
  const dataManagement = useDataManagement(emergencyContacts, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    phone_number: '',
    secondary_phone: '',
    email: '',
    is_primary: false,
    is_active: true,
    address: '',
    notes: '',
  });

  const handleAddContact = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      relationship: '',
      phone_number: '',
      secondary_phone: '',
      email: '',
      is_primary: false,
      is_active: true,
      address: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleEditContact = contact => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      relationship: contact.relationship || '',
      phone_number: contact.phone_number || '',
      secondary_phone: contact.secondary_phone || '',
      email: contact.email || '',
      is_primary: contact.is_primary || false,
      is_active: contact.is_active !== undefined ? contact.is_active : true,
      address: contact.address || '',
      notes: contact.notes || '',
    });
    setShowModal(true);
  };

  const handleDeleteContact = async contactId => {
    const success = await deleteItem(contactId);
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

    const contactData = {
      name: formData.name,
      relationship: formData.relationship,
      phone_number: formData.phone_number,
      secondary_phone: formData.secondary_phone || null,
      email: formData.email || null,
      is_primary: formData.is_primary,
      is_active: formData.is_active,
      address: formData.address || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingContact) {
      success = await updateItem(editingContact.id, contactData);
    } else {
      success = await createItem(contactData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const filteredContacts = dataManagement.data;

  // Helper function to get relationship icon
  const getRelationshipIcon = relationship => {
    const icons = {
      spouse: '💑',
      partner: '💑',
      parent: '👨‍👩‍👧‍👦',
      child: '👶',
      sibling: '👫',
      grandparent: '👴',
      grandchild: '👶',
      friend: '👥',
      neighbor: '🏠',
      caregiver: '👩‍⚕️',
      guardian: '🛡️',
      other: '👤',
    };
    return icons[relationship] || '👤';
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading emergency contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Emergency Contacts" icon="🚨" />

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
            <Button variant="primary" onClick={handleAddContact}>
              + Add Emergency Contact
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
          {filteredContacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🚨</div>
              <h3>No Emergency Contacts Found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : "It's important to have emergency contacts available in case of medical emergencies."}
              </p>
              {!dataManagement.hasActiveFilters && (
                <Button variant="primary" onClick={handleAddContact}>
                  Add Your First Emergency Contact
                </Button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={`medical-item-card ${contact.is_primary ? 'primary-contact' : ''}`}
                >
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className="contact-icon">
                          {getRelationshipIcon(contact.relationship)}
                        </span>
                        {contact.name}
                        {contact.is_primary && (
                          <span className="primary-badge">PRIMARY</span>
                        )}
                      </h3>
                    </div>
                    <div className="status-badges">
                      <span
                        className={`status-badge ${contact.is_active ? 'active' : 'inactive'}`}
                      >
                        {contact.is_active ? '✅ Active' : '⏸️ Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Relationship:</span>
                      <span className="value">
                        {contact.relationship.charAt(0).toUpperCase() +
                          contact.relationship.slice(1)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Phone:</span>
                      <span className="value">
                        <a href={`tel:${contact.phone_number}`}>
                          {contact.phone_number}
                        </a>
                      </span>
                    </div>
                    {contact.secondary_phone && (
                      <div className="detail-item">
                        <span className="label">Secondary Phone:</span>
                        <span className="value">
                          <a href={`tel:${contact.secondary_phone}`}>
                            {contact.secondary_phone}
                          </a>
                        </span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="detail-item">
                        <span className="label">Email:</span>
                        <span className="value">
                          <a href={`mailto:${contact.email}`}>
                            {contact.email}
                          </a>
                        </span>
                      </div>
                    )}
                  </div>

                  {contact.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">📝 Notes</div>
                      <div className="notes-content">{contact.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditContact(contact)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeleteContact(contact.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={filteredContacts}
              columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Relationship', accessor: 'relationship' },
                { header: 'Phone', accessor: 'phone_number' },
                { header: 'Email', accessor: 'email' },
                { header: 'Primary', accessor: 'is_primary' },
                { header: 'Status', accessor: 'is_active' },
              ]}
              patientData={currentPatient}
              tableName="Emergency Contacts"
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              formatters={{
                name: value => <span className="primary-field">{value}</span>,
                relationship: value =>
                  value.charAt(0).toUpperCase() + value.slice(1),
                phone_number: value =>
                  value ? <a href={`tel:${value}`}>{value}</a> : '-',
                email: value =>
                  value ? <a href={`mailto:${value}`}>{value}</a> : '-',
                is_primary: value => (value ? '⭐ Primary' : ''),
                is_active: value => (
                  <span
                    className={`status-badge ${value ? 'active' : 'inactive'}`}
                  >
                    {value ? '✅ Active' : '⏸️ Inactive'}
                  </span>
                ),
              }}
            />
          )}
        </div>
      </div>

      <MantineEmergencyContactForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingContact={editingContact}
      />
    </div>
  );
};

export default EmergencyContacts;
