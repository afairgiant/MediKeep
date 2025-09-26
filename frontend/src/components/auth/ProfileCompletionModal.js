import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from '../ui';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import {
  checkPatientProfileCompletion,
  checkForPatientPlaceholderValues,
  getPatientProfileCompletionMessage,
  markFirstLoginCompleted,
} from '../../utils/profileUtils';
import './ProfileCompletionModal.css';

const ProfileCompletionModal = ({ isOpen, onClose, onComplete }) => {
  const { user } = useAuth();
  const { patient } = useCurrentPatient();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  if (!user || !patient) return null;

  const completion = checkPatientProfileCompletion(patient);
  const placeholders = checkForPatientPlaceholderValues(patient);
  const message = getPatientProfileCompletionMessage(patient);

  const handleUpdateProfile = () => {
    markFirstLoginCompleted(user.username);
    onClose();
    navigate('/patients/me');
  };

  const handleCompleteSetup = () => {
    // Mark first login as completed
    markFirstLoginCompleted(user.username);
    onClose();
    if (onComplete) onComplete();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCompleteSetup}
      title="Welcome! Complete Your Profile"
      size="medium"
      closeOnOverlayClick={false}
      className="profile-completion-modal"
    >
      <div className="profile-completion-content">
        <div className="completion-header">
          <div className="completion-icon">🏥</div>
          <p className="completion-message">
            Welcome to MediKeep! {message}
          </p>
        </div>

        <div className="completion-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${completion.completionPercentage}%` }}
            ></div>
          </div>
          <span className="progress-text">
            Medical Profile: {completion.completionPercentage}% Complete
          </span>
        </div>

        <div className="completion-benefits">
          <h4>Why complete your medical profile?</h4>
          <ul>
            <li>🏥 Accurate medical record keeping</li>
            <li>📊 Better health tracking and insights</li>
            <li>🚨 Important for emergency situations</li>
            <li>👨‍⚕️ Enhanced healthcare coordination</li>
          </ul>
        </div>

        {(completion.missingFields.length > 0 ||
          placeholders.hasPlaceholders) && (
          <div className="missing-fields">
            <button
              className="details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '▼' : '▶'} What needs to be updated?
            </button>

            {showDetails && (
              <div className="details-content">
                {completion.missingFields.length > 0 && (
                  <div className="missing-section">
                    <h5>Missing Information:</h5>
                    <ul>
                      {completion.missingFields.map((field, index) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {placeholders.hasPlaceholders && (
                  <div className="placeholder-section">
                    <h5>Placeholder Values:</h5>
                    <ul>
                      {placeholders.placeholderFields.map((field, index) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="completion-actions">
          <Button
            variant="primary"
            onClick={handleUpdateProfile}
            className="update-btn"
          >
            Complete Medical Profile
          </Button>

          <Button
            variant="secondary"
            onClick={handleCompleteSetup}
            className="skip-btn"
          >
            Skip for Now
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileCompletionModal;
