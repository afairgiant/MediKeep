import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { PageHeader } from '../../components';
import { formatPhoneNumber } from '../../utils/phoneUtils';
import { usePharmacies } from '../../hooks/useGlobalData';
import '../../styles/pages/Practitioners.css';
import '../../styles/shared/MedicalPageShared.css';

const Pharmacies = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showModal, setShowModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    street_address: '',
    city: '',
    store_number: '',
  });

  // Use global state for pharmacies data
  const {
    pharmacies,
    loading,
    error: globalError,
    refresh: refreshPharmacies,
  } = usePharmacies();

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

  const getFilteredAndSortedPharmacies = () => {
    if (!pharmacies) return [];
    let filtered = [...pharmacies];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        pharmacy =>
          pharmacy.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pharmacy.store_number
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply brand filter
    if (brandFilter !== 'all') {
      filtered = filtered.filter(pharmacy => pharmacy.brand === brandFilter);
    }

    // Apply city filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(pharmacy => pharmacy.city === cityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'brand':
          return (a.brand || '').localeCompare(b.brand || '');
        case 'city':
          return (a.city || '').localeCompare(b.city || '');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getUniqueBrands = () => {
    if (!pharmacies) return [];
    const brands = [...new Set(pharmacies.map(p => p.brand).filter(Boolean))];
    return brands.sort();
  };

  const getUniqueCities = () => {
    if (!pharmacies) return [];
    const cities = [...new Set(pharmacies.map(p => p.city).filter(Boolean))];
    return cities.sort();
  };

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
            <button className="add-button" onClick={handleAddPharmacy}>
              + Add New Pharmacy
            </button>
          </div>

          <div className="controls-right">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name">Name</option>
                <option value="brand">Brand</option>
                <option value="city">City</option>
              </select>
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="search-group">
            <input
              type="text"
              placeholder="Search pharmacies..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="brand-filter">Brand:</label>
            <select
              id="brand-filter"
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Brands</option>
              {getUniqueBrands().map(brand => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="city-filter">City:</label>
            <select
              id="city-filter"
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Cities</option>
              {getUniqueCities().map(city => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || brandFilter !== 'all' || cityFilter !== 'all') && (
            <button
              className="clear-filters-btn"
              onClick={() => {
                setSearchTerm('');
                setBrandFilter('all');
                setCityFilter('all');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="results-summary">
          <span>
            {(searchTerm || brandFilter !== 'all' || cityFilter !== 'all') && (
              <span className="filter-indicator">🔍 Filters Active • </span>
            )}
            {getFilteredAndSortedPharmacies().length} of{' '}
            {pharmacies?.length || 0} pharmacies shown
          </span>
        </div>

        <div className="medical-items-list">
          {getFilteredAndSortedPharmacies().length === 0 ? (
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
              {getFilteredAndSortedPharmacies().map(pharmacy => (
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
                  </div>

                  <div className="medical-item-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEditPharmacy(pharmacy)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeletePharmacy(pharmacy.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="medical-form-overlay">
            <div className="medical-form-modal">
              <div className="form-header">
                <h3>
                  {editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy'}
                </h3>
                <button className="close-button" onClick={resetForm}>
                  ×
                </button>
              </div>

              <div className="medical-form-content">
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="name">Pharmacy Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., CVS Pharmacy - Main Street"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="brand">Brand</label>
                    <input
                      type="text"
                      id="brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      placeholder="e.g., CVS, Walgreens, Independent"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="street_address">Address</label>
                    <input
                      type="text"
                      id="street_address"
                      name="street_address"
                      value={formData.street_address}
                      onChange={handleInputChange}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="San Francisco"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="store_number">Store Number</label>
                    <input
                      type="text"
                      id="store_number"
                      name="store_number"
                      value={formData.store_number}
                      onChange={handleInputChange}
                      placeholder="e.g., 1234, Store #5678"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-button">
                      {editingPharmacy ? 'Update Pharmacy' : 'Add Pharmacy'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pharmacies;
