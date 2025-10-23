import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/pages/PlaceholderPage.css';

const PlaceholderPage = () => {
  const { section } = useParams();
  const navigate = useNavigate();

  const getSectionTitle = () => {
    switch (section) {
      case 'patients':
        return 'Patient Information';
      case 'lab-results':
        return 'Lab Results';
      case 'medications':
        return 'Medications';
      case 'immunizations':
        return 'Immunizations';
      case 'procedures':
        return 'Procedures';
      case 'allergies':
        return 'Allergies';
      case 'conditions':
        return 'Conditions';
      case 'treatments':
        return 'Treatments';
      case 'visits':
        return 'Visit History';
      default:
        return 'Medical Records';
    }
  };

  return (
    <div className="placeholder-container">
      <div className="placeholder-content">
        <h1>🚧 {getSectionTitle()}</h1>
        <p>This section is currently under development.</p>
        <p>Check back soon for updates!</p>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PlaceholderPage;
