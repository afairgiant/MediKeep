import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('auth');
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
      title={t('profile.title')}
      size="medium"
      closeOnOverlayClick={false}
      className="profile-completion-modal"
    >
      <div className="profile-completion-content">
        <div className="completion-header">
          <div className="completion-icon">
            <img src="/medikeep-icon.svg" alt="" width={48} height={48} />
          </div>
          <p className="completion-message">{message}</p>
        </div>

        <div className="completion-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${completion.completionPercentage}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {t('profile.medicalProfile', {
              percentage: completion.completionPercentage,
            })}
          </span>
        </div>

        <div className="completion-benefits">
          <h4>{t('profile.whyComplete')}</h4>
          <ul>
            <li>{t('profile.accurateRecords')}</li>
            <li>{t('profile.betterTracking')}</li>
            <li>{t('profile.emergencySituations')}</li>
            <li>{t('profile.enhancedCoordination')}</li>
          </ul>
        </div>

        {(completion.missingFields.length > 0 ||
          placeholders.hasPlaceholders) && (
          <div className="missing-fields">
            <button
              className="details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '\u25BC' : '\u25B6'} {t('profile.whatNeedsUpdate')}
            </button>

            {showDetails && (
              <div className="details-content">
                {completion.missingFields.length > 0 && (
                  <div className="missing-section">
                    <h5>{t('profile.missingInformation')}</h5>
                    <ul>
                      {completion.missingFields.map((field, index) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {placeholders.hasPlaceholders && (
                  <div className="placeholder-section">
                    <h5>{t('profile.placeholderValues')}</h5>
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
            {t('profile.completeProfile')}
          </Button>

          <Button
            variant="secondary"
            onClick={handleCompleteSetup}
            className="skip-btn"
          >
            {t('profile.skipForNow')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileCompletionModal;
