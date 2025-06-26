import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import {
  MedicalCard,
  StatusBadge,
  PageHeader,
  FilterControls,
} from '../../components';
import {
  usePractitioners,
  useCacheManager,
  useDataManagement,
} from '../../hooks';
import {
  formatPhoneNumber,
  formatPhoneInput,
  cleanPhoneNumber,
} from '../../utils/phoneUtils';
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

  // Common specialties for the filter dropdown
  const commonSpecialties = [
    'Cardiology',
    'Dermatology',
    'Emergency Medicine',
    'Family Medicine',
    'Gastroenterology',
    'General Surgery',
    'Internal Medicine',
    'Neurology',
    'Obstetrics and Gynecology',
    'Oncology',
    'Ophthalmology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
    'Radiology',
    'Urology',
  ];

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

    if (name === 'phone_number') {
      // Format phone number as user types
      const formattedValue = formatPhoneInput(value);
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
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
      <PageHeader
        title="Healthcare Practitioners"
        icon="👩‍⚕️"
        actions={
          <button
            className="add-practitioner-btn"
            onClick={handleAddPractitioner}
          >
            <span>+</span>
            Add Practitioner
          </button>
        }
      />

      {error && <div className="error-message">{error}</div>}
      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      {/* Standardized Filter Controls */}
      <FilterControls
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
        getSortIndicator={dataManagement.getSortIndicator}
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
            <button
              className="add-practitioner-btn"
              onClick={handleAddPractitioner}
            >
              Add Your First Practitioner
            </button>
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
                  <span className="detail-value">{practitioner.specialty}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Practice</span>
                  <span className="detail-value">{practitioner.practice}</span>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPractitioner
                  ? 'Edit Practitioner'
                  : 'Add New Practitioner'}
              </h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Dr. John Smith"
                />
              </div>
              <div className="form-group">
                <label htmlFor="specialty">Specialty *</label>
                <input
                  type="text"
                  id="specialty"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Cardiology, Family Medicine"
                  list="specialties"
                />
                <datalist id="specialties">
                  {commonSpecialties.map(specialty => (
                    <option key={specialty} value={specialty} />
                  ))}
                </datalist>
              </div>{' '}
              <div className="form-group">
                <label htmlFor="practice">Practice/Hospital *</label>
                <input
                  type="text"
                  id="practice"
                  name="practice"
                  value={formData.practice}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., City General Hospital, Private Practice"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone_number">Phone Number</label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="e.g., https://www.example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="rating">Rating (0-5 stars)</label>
                <input
                  type="number"
                  id="rating"
                  name="rating"
                  value={formData.rating}
                  onChange={handleInputChange}
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="e.g., 4.5"
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPractitioner
                    ? 'Update Practitioner'
                    : 'Add Practitioner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Practitioners;
