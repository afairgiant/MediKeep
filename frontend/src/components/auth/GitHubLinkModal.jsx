import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../adapters/Modal';
import Button from '../adapters/Button';
import FormInput from '../adapters/FormInput';

const GitHubLinkModal = ({ 
  isOpen, 
  onClose, 
  githubUserInfo, 
  tempToken, 
  onLinkComplete,
  onError 
}) => {
  const { t } = useTranslation(['auth', 'shared']);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Basic validation
    if (!formData.username || !formData.password) {
      setErrors({ general: t('github.validationError') });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/sso/resolve-github-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          temp_token: tempToken,
          username: formData.username,
          password: formData.password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'Failed to link GitHub account');
      }

      const data = await response.json();
      onLinkComplete(data);
    } catch (error) {
      setErrors({ general: error.message });
      onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (errors[name] || errors.general) {
      setErrors({});
    }
  };

  const handleCreateNew = () => {
    // For now, just show a message that this isn't supported yet
    setErrors({
      general: t('github.createNewNotSupported')
    });
  };

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={t('github.title')}
      className="github-link-modal"
    >
      <div className="github-link-content">
        <div className="github-info-section">
          <h4>{t('github.accountDetails')}</h4>
          <div className="github-user-info">
            <p><strong>{t('github.githubUsername')}</strong> {githubUserInfo?.github_username}</p>
            <p><strong>{t('github.githubId')}</strong> {githubUserInfo?.github_id}</p>
            {githubUserInfo?.name && (
              <p><strong>{t('shared:labels.name')}:</strong> {githubUserInfo.name}</p>
            )}
          </div>
        </div>

        <div className="link-options">
          <h4>{t('github.linkToExisting')}</h4>
          <p>
            {t('github.noPublicEmail')}
          </p>

          <form onSubmit={handleSubmit} className="link-form">
            <FormInput
              label={t('shared:labels.username')}
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              placeholder={t('github.enterExistingUsername')}
              required
              disabled={isLoading}
              error={errors.username}
            />

            <FormInput
              label={t('shared:labels.password')}
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder={t('github.enterExistingPassword')}
              required
              disabled={isLoading}
              error={errors.password}
            />

            {errors.general && (
              <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
                {errors.general}
              </div>
            )}

            <div className="modal-buttons">
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? t('github.linking') : t('github.linkAccounts')}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCreateNew}
                disabled={isLoading}
              >
                {t('github.createNewAccount')}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                {t('shared:fields.cancel')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .github-link-content {
          padding: 1rem 0;
        }

        .github-info-section {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .github-info-section h4 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }

        .github-user-info p {
          margin: 0.25rem 0;
          font-size: 0.9rem;
        }

        .link-options h4 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }

        .link-options p {
          margin-bottom: 1rem;
          color: #666;
          line-height: 1.4;
        }

        .link-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .modal-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .modal-buttons button {
          flex: 1;
          min-width: 120px;
        }

        .error-message {
          padding: 0.75rem;
          background-color: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        @media (max-width: 480px) {
          .modal-buttons {
            flex-direction: column;
          }
          
          .modal-buttons button {
            width: 100%;
          }
        }
      `}</style>
    </Modal>
  );
};

export default GitHubLinkModal;