import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge, PageHeader, Button } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MantinePractitionerForm from '../../components/medical/MantinePractitionerForm';
import {
  usePractitioners,
  useCacheManager,
  useDataManagement,
} from '../../hooks';
import { formatPhoneNumber, cleanPhoneNumber } from '../../utils/phoneUtils';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import '../../styles/pages/Practitioners.css';
import '../../styles/shared/MedicalPageShared.css';

const Practitioners = () => {
  const navigate = useNavigate();

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

  if (loading) {
    return (
      <div className="practitioners-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="practitioners-page">
      <PageHeader title="Healthcare Practitioners" icon="👩‍⚕️" />

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddPractitioner}>
              + Add Practitioner
            </Button>
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

        {filteredPractitioners.length === 0 ? (
          <div className="no-practitioners">
            <div className="no-practitioners-icon">👨‍⚕️</div>
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
        ) : (
          <div className="practitioners-grid">
            {filteredPractitioners.map(practitioner => (
              <MedicalCard
                key={practitioner.id}
                className="practitioner-card"
                onEdit={() => handleEditPractitioner(practitioner)}
                onDelete={() => handleDeletePractitioner(practitioner.id)}
              >
                <div className="practitioner-card-header">
                  <div>
                    <h3 className="practitioner-name">{practitioner.name}</h3>
                    <p className="practitioner-practice">
                      {practitioner.practice}
                    </p>
                  </div>
                  <div className="practitioner-badge">
                    <StatusBadge
                      status={practitioner.specialty}
                      color={getSpecialtyColor(practitioner.specialty)}
                    />
                  </div>
                </div>{' '}
                <div className="practitioner-details">
                  <div className="detail-item">
                    <span className="detail-label">Specialty</span>
                    <span className="detail-value">
                      {practitioner.specialty}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Practice</span>
                    <span className="detail-value">
                      {practitioner.practice}
                    </span>
                  </div>{' '}
                  {practitioner.phone_number && (
                    <div className="detail-item">
                      <span className="detail-label">Phone</span>
                      <span className="detail-value">
                        {formatPhoneNumber(practitioner.phone_number)}
                      </span>
                    </div>
                  )}
                  {practitioner.website && (
                    <div className="detail-item">
                      <span className="detail-label">Website</span>
                      <span className="detail-value">
                        <a
                          href={practitioner.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="website-link"
                        >
                          Visit Website ↗
                        </a>
                      </span>
                    </div>
                  )}
                  {practitioner.rating !== null &&
                    practitioner.rating !== undefined && (
                      <div className="detail-item">
                        <span className="detail-label">Rating</span>
                        <span className="detail-value">
                          <div className="rating-display">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span
                                key={star}
                                className={`star ${star <= practitioner.rating ? 'filled' : 'empty'}`}
                              >
                                ⭐
                              </span>
                            ))}
                            <span className="rating-number">
                              ({practitioner.rating}/5)
                            </span>
                          </div>
                        </span>
                      </div>
                    )}
                  {practitioner.id && (
                    <div className="detail-item">
                      <span className="detail-label">ID</span>
                      <span className="detail-value">{practitioner.id}</span>
                    </div>
                  )}
                </div>
              </MedicalCard>
            ))}
          </div>
        )}
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
