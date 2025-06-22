import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/MedicationTable.css';

const Medication = () => {
  // Using global state for patient, practitioners, and pharmacies data
  const { 
    patient: patientDataObject, 
    practitioners: practitionersObject, 
    pharmacies: pharmaciesObject, 
    loading: globalDataLoading 
  } = usePatientWithStaticData();

  // Extract the actual data from the nested objects
  const patientData = patientDataObject.patient;
  const practitioners = practitionersObject.practitioners;
  const pharmacies = pharmaciesObject.pharmacies;

  const [medications, setMedications] = useState([]);
  const [medicationsLoading, setMedicationsLoading] = useState(true);
  // Combine loading states
  const loading = medicationsLoading || globalDataLoading;
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [sortBy, setSortBy] = useState('active');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // all, current, past, future

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

  const navigate = useNavigate();

  // Define fetchMedications before using it in useEffect
  const fetchMedications = useCallback(async () => {
    if (!patientData?.id) {
      setMedicationsLoading(false);
      return;
    }

    try {
      setMedicationsLoading(true);
      setError('');

      // Only fetch medications - patient and static data comes from global state
      const medicationData = await apiService.getPatientMedications(
        patientData.id
      );
      setMedications(medicationData);
    } catch (error) {
      console.error('Error fetching medications:', error);
      setError('Failed to load medication data. Please try again.');
    } finally {
      setMedicationsLoading(false);
    }
  }, [patientData?.id]);

  // Fetch medications when patient data becomes available
  useEffect(() => {
    if (patientData?.id) {
      fetchMedications();
    } else if (patientData === null && !globalDataLoading) {
      // If patient data is null and global loading is done, stop medications loading
      setMedicationsLoading(false);
    }
  }, [patientData?.id, patientData, globalDataLoading, fetchMedications]);
  const handleInputChange = e => {
    const { name, value } = e.target;

    // Convert empty string to null for ID fields (practitioner_id, pharmacy_id)
    let processedValue = value;
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
  const resetForm = () => {
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
    setEditingMedication(null);
    setShowAddForm(false);
  };

  const handleAddMedication = () => {
    resetForm();
    setShowAddForm(true);
  };
  const handleEditMedication = medication => {
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
    setEditingMedication(medication);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Check authentication first
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in again.');
      navigate('/login');
      return;
    }

    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      // Debug auth and patient data
      console.log('🔐 Auth token length:', token.length);
      console.log('🏥 Patient data:', patientData); // Clean and validate medication data
      const medicationData = {
        medication_name: formData.medication_name?.trim() || '',
        dosage: formData.dosage?.trim() || '',
        frequency: formData.frequency?.trim() || '',
        route: formData.route?.trim() || '',
        indication: formData.indication?.trim() || '',
        status: formData.status || 'active',
        patient_id: patientData.id,
        practitioner_id: formData.practitioner_id,
        pharmacy_id: formData.pharmacy_id,
      };

      // Only include dates if they have values
      if (formData.effectivePeriod_start) {
        medicationData.effectivePeriod_start = formData.effectivePeriod_start;
      }
      if (formData.effectivePeriod_end) {
        medicationData.effectivePeriod_end = formData.effectivePeriod_end;
      }

      console.log('🚀 Final medication data:', medicationData);
      console.log('🔍 Data type check:', typeof medicationData);
      console.log(
        '🔍 Is object?',
        medicationData && typeof medicationData === 'object'
      );
      console.log('🔍 JSON stringify test:', JSON.stringify(medicationData));

      console.log('🚀 Submitting medication data:', medicationData);
      console.log('🔍 Form data breakdown:', {
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        route: formData.route,
        indication: formData.indication,
        effectivePeriod_start: formData.effectivePeriod_start,
        effectivePeriod_end: formData.effectivePeriod_end,
        status: formData.status,
        practitioner_id: formData.practitioner_id,
        pharmacy_id: formData.pharmacy_id,
        patient_id: patientData.id,
      });

      if (editingMedication) {
        console.log('✏️ Updating medication:', editingMedication.id);
        await apiService.updateMedication(editingMedication.id, medicationData);
        setSuccessMessage('Medication updated successfully!');
      } else {
        console.log('📝 Creating new medication...');
        const result = await apiService.createMedication(medicationData);
        console.log('✅ Create result:', result);
        setSuccessMessage('Medication added successfully!');
      }

      resetForm();
      await fetchPatientAndMedications();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('❌ Error saving medication:', error);
      if (
        error.message?.includes('Authentication') ||
        error.message?.includes('401') ||
        error.message?.includes('403')
      ) {
        setError('Authentication failed. Please log in again.');
        navigate('/login');
      } else {
        setError(
          error.response?.data?.detail ||
            error.message ||
            'Failed to save medication'
        );
      }
    }
  };

  const handleDeleteMedication = async medicationId => {
    if (!window.confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteMedication(medicationId);
      setSuccessMessage('Medication deleted successfully!');
      await fetchPatientAndMedications();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting medication:', error);
      setError(error.message || 'Failed to delete medication');
    }
  };
  const getSortedMedications = () => {
    const sorted = [...medications].sort((a, b) => {
      // First sort by active status (active first)
      if (sortBy === 'active') {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';

        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        // If both have same active status, sort by medication name
        return a.medication_name.localeCompare(b.medication_name);
      }

      // Sort by other fields
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.medication_name.localeCompare(b.medication_name)
          : b.medication_name.localeCompare(a.medication_name);
      }

      if (sortBy === 'start_date') {
        const aDate = new Date(a.effectivePeriod_start || 0);
        const bDate = new Date(b.effectivePeriod_start || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return 0;
    });

    return sorted;
  };

  const getFilteredAndSortedMedications = () => {
    let filtered = medications;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        med =>
          med.medication_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          med.indication?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          med.dosage?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(med => med.status === statusFilter);
    }

    // Apply route filter
    if (routeFilter !== 'all') {
      filtered = filtered.filter(med => med.route === routeFilter);
    }

    // Apply date range filter
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(med => {
        const startDate = med.effectivePeriod_start
          ? new Date(med.effectivePeriod_start)
          : null;
        const endDate = med.effectivePeriod_end
          ? new Date(med.effectivePeriod_end)
          : null;

        switch (dateRangeFilter) {
          case 'current':
            // Currently active medications (started and not yet ended)
            return (
              (!startDate || startDate <= today) &&
              (!endDate || endDate >= today)
            );
          case 'past':
            // Medications that have ended
            return endDate && endDate < today;
          case 'future':
            // Medications that haven't started yet
            return startDate && startDate > today;
          default:
            return true;
        }
      });
    }

    // Apply sorting to filtered results
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'active') {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';

        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        return a.medication_name.localeCompare(b.medication_name);
      }

      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.medication_name.localeCompare(b.medication_name)
          : b.medication_name.localeCompare(a.medication_name);
      }

      if (sortBy === 'start_date') {
        const aDate = new Date(a.effectivePeriod_start || 0);
        const bDate = new Date(b.effectivePeriod_start || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return 0;
    });

    return sorted;
  };
  // Get unique values for filter dropdowns
  const getUniqueStatuses = () => {
    const statuses = [
      ...new Set(medications.map(med => med.status).filter(Boolean)),
    ];
    return statuses.sort();
  };

  const getUniqueRoutes = () => {
    const routes = [
      ...new Set(medications.map(med => med.route).filter(Boolean)),
    ];
    return routes.sort();
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      searchTerm.trim() !== '' ||
      statusFilter !== 'all' ||
      routeFilter !== 'all' ||
      dateRangeFilter !== 'all'
    );
  };

  const handleSortChange = newSortBy => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const getStatusBadgeClass = status => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'stopped':
        return 'status-stopped';
      case 'on-hold':
        return 'status-on-hold';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-unknown';
    }
  };
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
      <header className="medical-page-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>💊 Medications</h1>
      </header>

      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}{' '}
        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddMedication}>
              + Add New Medication
            </button>
          </div>

          <div className="controls-center">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                📋 Cards
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📊 Table
              </button>
            </div>
          </div>

          <div className="controls-right">
            {viewMode === 'table' && (
              <button className="print-button" onClick={() => window.print()}>
                🖨️ Print
              </button>
            )}
            <div className="sort-controls">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={e => handleSortChange(e.target.value)}
              >
                <option value="active">Status (Active First)</option>
                <option value="name">Medication Name</option>
                <option value="start_date">Start Date</option>
              </select>
              {sortBy !== 'active' && (
                <button
                  className="sort-order-button"
                  onClick={() =>
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              )}{' '}
            </div>
          </div>
        </div>
        {/* Filtering Section */}
        <div className="medical-page-filters">
          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="search">🔍 Search:</label>
              <input
                type="text"
                id="search"
                placeholder="Search medications, indications, or dosages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="status-filter">Status:</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Statuses</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="route-filter">Route:</label>
              <select
                id="route-filter"
                value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Routes</option>
                {getUniqueRoutes().map(route => (
                  <option key={route} value={route}>
                    {route.charAt(0).toUpperCase() + route.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="date-filter">Time Period:</label>
              <select
                id="date-filter"
                value={dateRangeFilter}
                onChange={e => setDateRangeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Time Periods</option>
                <option value="current">Currently Active</option>
                <option value="past">Past Medications</option>
                <option value="future">Future Medications</option>
              </select>
            </div>

            <div className="filter-group">
              <button
                className="clear-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setRouteFilter('all');
                  setDateRangeFilter('all');
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="filter-summary">
            {hasActiveFilters() && (
              <span className="active-filters-indicator">
                🔍 Filters Active •{' '}
              </span>
            )}
            {getFilteredAndSortedMedications().length} of {medications.length}{' '}
            medications shown
          </div>
        </div>
        {showAddForm && (
          <div className="medical-form-overlay">
            <div className="medical-form-modal">
              {' '}
              <div className="form-header">
                <h3>
                  {editingMedication ? 'Edit Medication' : 'Add New Medication'}
                </h3>
                <button className="close-button" onClick={resetForm}>
                  ×
                </button>
              </div>
              <div className="medical-form-content">
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
                    </div>{' '}
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
                    <div className="form-group">
                      <label htmlFor="practitioner_id">
                        Prescribing Provider
                      </label>
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
                            {pharmacy.name} - {pharmacy.city}, {pharmacy.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>{' '}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-button">
                      {editingMedication
                        ? 'Update Medication'
                        : 'Add Medication'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}{' '}
        <div className="medical-items-list">
          {getFilteredAndSortedMedications().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💊</div>
              {medications.length === 0 ? (
                <>
                  <h3>No medications found</h3>
                  <p>Click "Add New Medication" to get started.</p>
                </>
              ) : (
                <>
                  <h3>No medications match your filters</h3>
                  <p>
                    Try adjusting your search criteria or clear the filters to
                    see all medications.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setRouteFilter('all');
                      setDateRangeFilter('all');
                    }}
                  >
                    Clear All Filters
                  </button>
                </>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {getFilteredAndSortedMedications().map(medication => (
                <div key={medication.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">{medication.medication_name}</h3>
                    <span
                      className={`status-badge ${getStatusBadgeClass(medication.status)}`}
                    >
                      {medication.status || 'Unknown'}
                    </span>
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
                    )}{' '}
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
                    <div className="detail-item">
                      <span className="label">Start Date:</span>
                      <span className="value">
                        {formatDate(medication.effectivePeriod_start)}
                      </span>
                    </div>
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
            <div className="medications-table-container">
              <div className="print-header">
                <h2>
                  Medication List - {patientData?.first_name}{' '}
                  {patientData?.last_name}
                </h2>
                <p>Generated on: {new Date().toLocaleDateString()}</p>
              </div>
              <table className="medications-table">
                {' '}
                <thead>
                  <tr>
                    <th>Medication Name</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Route</th>
                    <th>Indication</th>
                    <th>Prescriber</th>
                    <th>Pharmacy</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th className="no-print">Actions</th>
                  </tr>
                </thead>{' '}
                <tbody>
                  {' '}
                  {getFilteredAndSortedMedications().map(medication => (
                    <tr key={medication.id}>
                      <td className="medication-name">
                        {medication.medication_name}
                      </td>
                      <td>{medication.dosage || '-'}</td>
                      <td>{medication.frequency || '-'}</td>
                      <td>{medication.route || '-'}</td>
                      <td>{medication.indication || '-'}</td>
                      <td>{medication.practitioner?.name || '-'}</td>
                      <td>{medication.pharmacy?.name || '-'}</td>
                      <td>{formatDate(medication.effectivePeriod_start)}</td>
                      <td>
                        {medication.effectivePeriod_end
                          ? formatDate(medication.effectivePeriod_end)
                          : '-'}
                      </td>
                      <td>
                        <span
                          className={`status-badge-small ${getStatusBadgeClass(medication.status)}`}
                        >
                          {medication.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="no-print">
                        <div className="table-actions">
                          <button
                            className="edit-button-small"
                            onClick={() => handleEditMedication(medication)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-button-small"
                            onClick={() =>
                              handleDeleteMedication(medication.id)
                            }
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Medication;
