import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import '../../styles/pages/Practitioners.css';

const Practitioners = () => {
  const [practitioners, setPractitioners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showModal, setShowModal] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    practice: ''
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
    'Urology'
  ];

  useEffect(() => {
    fetchPractitioners();
  }, []);

  const fetchPractitioners = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPractitioners();
      setPractitioners(response || []);
      setError('');
    } catch (err) {
      setError('Failed to load practitioners. Please try again.');
      console.error('Error fetching practitioners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPractitioner = () => {
    setEditingPractitioner(null);
    setFormData({
      name: '',
      specialty: '',
      practice: ''
    });
    setShowModal(true);
  };

  const handleEditPractitioner = (practitioner) => {
    setEditingPractitioner(practitioner);
    setFormData({
      name: practitioner.name || '',
      specialty: practitioner.specialty || '',
      practice: practitioner.practice || ''
    });
    setShowModal(true);
  };

  const handleDeletePractitioner = async (practitionerId) => {
    if (window.confirm('Are you sure you want to delete this practitioner? This action cannot be undone.')) {
      try {
        await apiService.deletePractitioner(practitionerId);
        await fetchPractitioners();
        setSuccessMessage('Practitioner deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete practitioner. Please try again.');
        console.error('Error deleting practitioner:', err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPractitioner) {
        await apiService.updatePractitioner(editingPractitioner.id, formData);
        setSuccessMessage('Practitioner updated successfully');
      } else {
        await apiService.createPractitioner(formData);
        setSuccessMessage('Practitioner added successfully');
      }

      setShowModal(false);
      await fetchPractitioners();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save practitioner. Please try again.');
      console.error('Error saving practitioner:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get unique specialties from practitioners for filter
  const availableSpecialties = [...new Set(practitioners.map(p => p.specialty).filter(Boolean))].sort();

  const filteredPractitioners = practitioners
    .filter(practitioner => {
      const matchesSearch = practitioner.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          practitioner.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          practitioner.practice?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSpecialty = specialtyFilter === 'all' || practitioner.specialty === specialtyFilter;
      
      return matchesSearch && matchesSpecialty;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'specialty':
          return (a.specialty || '').localeCompare(b.specialty || '');
        case 'practice':
          return (a.practice || '').localeCompare(b.practice || '');
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });

  const getSpecialtyColor = (specialty) => {
    // Color coding for different specialties
    const specialtyColors = {
      'Cardiology': 'error',
      'Emergency Medicine': 'error',
      'Family Medicine': 'success',
      'Internal Medicine': 'success',
      'Pediatrics': 'info',
      'Surgery': 'warning',
      'General Surgery': 'warning',
      'Psychiatry': 'info',
      'Neurology': 'warning'
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
      <div className="practitioners-header">
        <h1 className="practitioners-title">Healthcare Practitioners</h1>
        <div className="practitioners-actions">
          <button className="add-practitioner-btn" onClick={handleAddPractitioner}>
            <span>+</span>
            Add Practitioner
          </button>
          <div className="practitioners-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search practitioners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="practitioners-filters">
        <div className="filter-group">
          <label>Specialty</label>
          <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
            <option value="all">All Specialties</option>
            {availableSpecialties.map(specialty => (
              <option key={specialty} value={specialty}>{specialty}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="specialty">Specialty</option>
            <option value="practice">Practice</option>
          </select>
        </div>
      </div>

      {filteredPractitioners.length === 0 ? (
        <div className="no-practitioners">
          <div className="no-practitioners-icon">👨‍⚕️</div>
          <h3>No Healthcare Practitioners Found</h3>
          <p>
            {searchTerm || specialtyFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Start by adding your first healthcare practitioner.'}
          </p>
          {!searchTerm && specialtyFilter === 'all' && (
            <button className="add-practitioner-btn" onClick={handleAddPractitioner}>
              Add Your First Practitioner
            </button>
          )}
        </div>
      ) : (
        <div className="practitioners-grid">
          {filteredPractitioners.map((practitioner) => (
            <MedicalCard
              key={practitioner.id}
              className="practitioner-card"
              onEdit={() => handleEditPractitioner(practitioner)}
              onDelete={() => handleDeletePractitioner(practitioner.id)}
            >
              <div className="practitioner-card-header">
                <div>
                  <h3 className="practitioner-name">{practitioner.name}</h3>
                  <p className="practitioner-practice">{practitioner.practice}</p>
                </div>
                <div className="practitioner-badge">
                  <StatusBadge 
                    status={practitioner.specialty} 
                    color={getSpecialtyColor(practitioner.specialty)} 
                  />
                </div>
              </div>

              <div className="practitioner-details">
                <div className="detail-item">
                  <span className="detail-label">Specialty</span>
                  <span className="detail-value">{practitioner.specialty}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Practice</span>
                  <span className="detail-value">{practitioner.practice}</span>
                </div>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPractitioner ? 'Edit Practitioner' : 'Add New Practitioner'}
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
              </div>

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

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPractitioner ? 'Update Practitioner' : 'Add Practitioner'}
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
