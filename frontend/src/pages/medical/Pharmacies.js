import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader, Button } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MantinePharmacyForm from '../../components/medical/MantinePharmacyForm';
import { formatPhoneNumber } from '../../utils/phoneUtils';
import { usePharmacies } from '../../hooks/useGlobalData';
import '../../styles/pages/Practitioners.css';
import '../../styles/shared/MedicalPageShared.css';

const Pharmacies = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);

  // Use global state for pharmacies data
  const {
    pharmacies,
    loading,
    error: globalError,
    refresh: refreshPharmacies,
  } = usePharmacies();

  // Get standardized configuration
  const config = getMedicalPageConfig('pharmacies');

  // Use standardized data management
  const dataManagement = useDataManagement(pharmacies || [], config);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    street_address: '',
    city: '',
    store_number: '',
    phone_number: '',
    website: '',
  });

  // Handle global error
  useEffect(() => {
    if (globalError) {
      setError('Failed to load pharmacies. Please try again.');
    }
  }, [globalError]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      street_address: '',
      city: '',
      store_number: '',
      phone_number: '',
      website: '',
    });
    setEditingPharmacy(null);
    setShowModal(false);
  };

  const handleAddPharmacy = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditPharmacy = pharmacy => {
    setFormData({
      name: pharmacy.name || '',
      brand: pharmacy.brand || '',
      street_address: pharmacy.street_address || '',
      city: pharmacy.city || '',
      store_number: pharmacy.store_number || '',
      phone_number: pharmacy.phone_number || '',
      website: pharmacy.website || '',
    });
    setEditingPharmacy(pharmacy);
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      setError('');
      setSuccessMessage('');
      const pharmacyData = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        street_address: formData.street_address.trim(),
        city: formData.city.trim(),
        store_number: formData.store_number.trim(),
        phone_number: formData.phone_number.trim() || null,
        website: formData.website.trim() || null,
      };

      if (editingPharmacy) {
        await apiService.updatePharmacy(editingPharmacy.id, pharmacyData);
        setSuccessMessage('Pharmacy updated successfully!');
      } else {
        await apiService.createPharmacy(pharmacyData);
        setSuccessMessage('Pharmacy added successfully!');
      }

      await refreshPharmacies(); // Refresh global cache
      resetForm();
    } catch (error) {
      setError(`Failed to save pharmacy: ${error.message}`);
    }
  };

  const handleDeletePharmacy = async pharmacyId => {
    if (!window.confirm('Are you sure you want to delete this pharmacy?')) {
      return;
    }

    try {
      setError('');
      await apiService.deletePharmacy(pharmacyId);
      setSuccessMessage('Pharmacy deleted successfully!');
      await refreshPharmacies(); // Refresh global cache
    } catch (error) {
      setError(`Failed to delete pharmacy: ${error.message}`);
    }
  };

  // Get processed data from data management
  const filteredPharmacies = dataManagement.data;

  if (loading) {
    return (
      <div className="medical-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading pharmacies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page">
      <PageHeader title="Pharmacies" icon="🏥" />

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <Button variant="primary" onClick={handleAddPharmacy}>
              + Add New Pharmacy
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

        <div className="medical-items-list">
          {filteredPharmacies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              {(pharmacies?.length || 0) === 0 ? (
                <>
                  <h3>No pharmacies found</h3>
                  <p>Click "Add New Pharmacy" to get started.</p>
                </>
              ) : (
                <>
                  <h3>No pharmacies match your filters</h3>
                  <p>
                    Try adjusting your search criteria or clear the filters to
                    see all pharmacies.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="medical-items-grid">
              {filteredPharmacies.map(pharmacy => (
                <div key={pharmacy.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">{pharmacy.name}</h3>
                    {pharmacy.brand && (
                      <span className="brand-badge">{pharmacy.brand}</span>
                    )}
                  </div>

                  <div className="medical-item-details">
                    {pharmacy.street_address && (
                      <div className="detail-item">
                        <span className="label">Address:</span>
                        <span className="value">{pharmacy.street_address}</span>
                      </div>
                    )}
                    {pharmacy.city && (
                      <div className="detail-item">
                        <span className="label">City:</span>
                        <span className="value">{pharmacy.city}</span>
                      </div>
                    )}
                    {pharmacy.store_number && (
                      <div className="detail-item">
                        <span className="label">Store Number:</span>
                        <span className="value">{pharmacy.store_number}</span>
                      </div>
                    )}
                    {pharmacy.phone_number && (
                      <div className="detail-item">
                        <span className="label">Phone:</span>
                        <span className="value">
                          {formatPhoneNumber(pharmacy.phone_number)}
                        </span>
                      </div>
                    )}
                    {pharmacy.website && (
                      <div className="detail-item">
                        <span className="label">Website:</span>
                        <span className="value">
                          <a
                            href={
                              pharmacy.website.startsWith('http')
                                ? pharmacy.website
                                : `https://${pharmacy.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="website-link"
                          >
                            Visit Website ↗
                          </a>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="medical-item-actions">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEditPharmacy(pharmacy)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDeletePharmacy(pharmacy.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <MantinePharmacyForm
          isOpen={showModal}
          onClose={resetForm}
          title={editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingPharmacy={editingPharmacy}
        />
      </div>
    </div>
  );
};

export default Pharmacies;
