import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { PageHeader, Button } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import StatusBadge from '../../components/medical/StatusBadge';
import MantinePractitionerForm from '../../components/medical/MantinePractitionerForm';
import {
  usePractitioners,
  useCacheManager,
  useDataManagement,
} from '../../hooks';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phoneUtils';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Practitioners = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Using global state for practitioners data
  const {
    practitioners,
    loading,
    error: practitionersError,
    refresh,
  } = usePractitioners();
  const { invalidatePractitioners } = useCacheManager();

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Standardized filtering and sorting
  const config = getMedicalPageConfig('practitioners');
  const dataManagement = useDataManagement(practitioners, config);
  const [editingPractitioner, setEditingPractitioner] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    practice: '',
    phone_number: '',
    website: '',
    rating: '',
  });

  // Handle global error state
  useEffect(() => {
    if (practitionersError) {
      setError('Failed to load practitioners. Please try again.');
    } else {
      setError('');
    }
  }, [practitionersError]);
  const handleAddPractitioner = () => {
    setEditingPractitioner(null);
    setFormData({
      name: '',
      specialty: '',
      practice: '',
      phone_number: '',
      website: '',
      rating: '',
    });
    setShowModal(true);
  };

  const handleEditPractitioner = practitioner => {
    setEditingPractitioner(practitioner);
    setFormData({
      name: practitioner.name || '',
      specialty: practitioner.specialty || '',
      practice: practitioner.practice || '',
      phone_number: formatPhoneNumber(practitioner.phone_number) || '',
      website: practitioner.website || '',
      rating: practitioner.rating || '',
    });
    setShowModal(true);
  };

  const handleDeletePractitioner = async practitionerId => {
    if (
      window.confirm(
        'Are you sure you want to delete this practitioner? This action cannot be undone.'
      )
    ) {
      try {
        await apiService.deletePractitioner(practitionerId);
        // Refresh global practitioners data
        await refresh();
        setSuccessMessage('Practitioner deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete practitioner. Please try again.');
        console.error('Error deleting practitioner:', err);
      }
    }
  };
  const handleSubmit = async e => {
    e.preventDefault();
    try {
      // Clean the data before sending to API
      const dataToSubmit = {
        ...formData,
        phone_number: cleanPhoneNumber(formData.phone_number) || null,
        website:
          formData.website && formData.website.trim() !== ''
            ? formData.website.trim()
            : null,
        rating:
          formData.rating && formData.rating.trim() !== ''
            ? parseFloat(formData.rating)
            : null,
      };

      if (editingPractitioner) {
        await apiService.updatePractitioner(
          editingPractitioner.id,
          dataToSubmit
        );
        setSuccessMessage('Practitioner updated successfully');
      } else {
        await apiService.createPractitioner(dataToSubmit);
        setSuccessMessage('Practitioner added successfully');
      }

      setShowModal(false);
      // Refresh global practitioners data
      await refresh();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save practitioner. Please try again.');
      console.error('Error saving practitioner:', err);
    }
  };
  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const filteredPractitioners = dataManagement.data;

  const getSpecialtyColor = specialty => {
    // Color coding for different specialties
    const specialtyColors = {
      Cardiology: 'error',
      'Emergency Medicine': 'error',
      'Family Medicine': 'success',
      'Internal Medicine': 'success',
      Pediatrics: 'info',
      Surgery: 'warning',
      'General Surgery': 'warning',
      Psychiatry: 'info',
      Neurology: 'warning',
    };

    return specialtyColors[specialty] || 'info';
  };

  const getSpecialtyIcon = specialty => {
    // Return empty string to remove icons
    return '';
  };

  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading practitioners...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="medical-page-container">
      <PageHeader title="Practitioners" />

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <Button variant="ghost" size="small" onClick={() => setError('')}>
              ×
            </Button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddPractitioner}>
              + Add Practitioner
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
          {filteredPractitioners.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">MD</div>
              <h3>No Healthcare Practitioners Found</h3>
              <p>
                {dataManagement.hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Start by adding your first healthcare practitioner.'}
              </p>
              {!dataManagement.hasActiveFilters && (
                <Button variant="primary" onClick={handleAddPractitioner}>
                  Add Your First Practitioner
                </Button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {filteredPractitioners.map(practitioner => (
                <div key={practitioner.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className="practitioner-icon">
                          {getSpecialtyIcon(practitioner.specialty)}
                        </span>
                        {practitioner.name}
                      </h3>
                      <p className="item-subtitle">{practitioner.practice}</p>
                    </div>
                    <div className="status-badges">
                      <StatusBadge
                        status={practitioner.specialty}
                        color={getSpecialtyColor(practitioner.specialty)}
                      />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Specialty:</span>
                      <span className="value">{practitioner.specialty}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Practice:</span>
                      <span className="value">{practitioner.practice}</span>
                    </div>
                    {practitioner.phone_number && (
                      <div className="detail-item">
                        <span className="label">Phone:</span>
                        <span className="value">
                          {formatPhoneNumber(practitioner.phone_number)}
                        </span>
                      </div>
                    )}
                    {practitioner.website && (
                      <div className="detail-item">
                        <span className="label">Website:</span>
                        <span className="value">
                          <a
                            href={practitioner.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="website-link"
                          >
                            Visit Website
                          </a>
                        </span>
                      </div>
                    )}
                    {practitioner.rating !== null &&
                      practitioner.rating !== undefined && (
                        <div className="detail-item">
                          <span className="label">Rating:</span>
                          <span className="value">
                            <div className="rating-display">
                              <span className="rating-number">
                                {practitioner.rating}/5 stars
                              </span>
                            </div>
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditPractitioner(practitioner)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeletePractitioner(practitioner.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={filteredPractitioners}
              columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Specialty', accessor: 'specialty' },
                { header: 'Practice', accessor: 'practice' },
                { header: 'Phone', accessor: 'phone_number' },
                { header: 'Rating', accessor: 'rating' },
              ]}
              tableName="Healthcare Practitioners"
              onEdit={handleEditPractitioner}
              onDelete={handleDeletePractitioner}
              formatters={{
                name: value => <span className="primary-field">{value}</span>,
                specialty: value => (
                  <StatusBadge
                    status={value}
                    color={getSpecialtyColor(value)}
                    size="small"
                  />
                ),
                phone_number: value => (value ? formatPhoneNumber(value) : '-'),
                rating: value =>
                  value !== null && value !== undefined ? (
                    <span className="rating-number">{value}/5 stars</span>
                  ) : (
                    '-'
                  ),
              }}
            />
          )}
        </div>
      </div>

      <MantinePractitionerForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingPractitioner ? 'Edit Practitioner' : 'Add New Practitioner'
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingPractitioner={editingPractitioner}
      />
    </div>
  );
};

export default Practitioners;
