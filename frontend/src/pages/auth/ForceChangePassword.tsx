import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { AuthContextType } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { Button, Alert } from '../../components/ui';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import logger from '../../services/logger';
import styles from '../../styles/pages/Login.module.css';
import '../../components/auth/ChangePasswordModal.css';

/**
 * Forced password change page.
 *
 * Shown when a user logs in with an account flagged as must_change_password=true
 * (e.g. the emergency admin account). The form cannot be dismissed — the user
 * must set a new password before accessing the rest of the application.
 */
const ForceChangePassword = () => {
  const { t } = useTranslation('common');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { logout, clearMustChangePassword } = useAuth() as AuthContextType;
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError(t('settings.security.password.forceChange.errors.allFieldsRequired'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('settings.security.password.forceChange.errors.passwordsMustMatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError(t('settings.security.password.forceChange.errors.passwordTooShort'));
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(passwordData.newPassword);
    const hasNumber = /[0-9]/.test(passwordData.newPassword);
    if (!hasLetter || !hasNumber) {
      setError(t('settings.security.password.forceChange.errors.passwordComplexity'));
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setError(t('settings.security.password.forceChange.errors.passwordMustDiffer'));
      return;
    }

    try {
      setIsSubmitting(true);
      await apiService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      logger.info('Password changed successfully via forced change', {
        component: 'ForceChangePassword',
        event: 'force_password_change_success',
      });

      clearMustChangePassword();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to change password on forced change', {
        component: 'ForceChangePassword',
        event: 'force_password_change_failed',
        error: message,
      });
      setError(t('settings.security.password.forceChange.errors.changeFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.loginContainer}>
      <div className={`${styles.loginForm} ${styles.loginFormWide}`}>
        <FormLoadingOverlay
          visible={isSubmitting}
          message={t('settings.security.password.forceChange.submitting')}
        />
        <h1>
          <img
            src="/medikeep-icon.svg"
            alt="MediKeep"
            width={40}
            height={40}
            style={{ verticalAlign: 'middle', marginRight: '8px' }}
          />
          MediKeep
        </h1>
        <h2>{t('settings.security.password.forceChange.title')}</h2>
        <p style={{ color: 'var(--color-text-secondary, #666)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {t('settings.security.password.forceChange.subtitle')}
        </p>

        <div className="change-password-content">
          {error && <Alert type="error" id="fcp-error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="password-form">
            <div className="form-group">
              <label htmlFor="currentPassword">
                {t('settings.security.password.currentPassword')}
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handleChange}
                required
                className="form-input"
                disabled={isSubmitting}
                autoFocus
                aria-describedby={error ? 'fcp-error' : undefined}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">
                {t('settings.security.password.newPassword')}
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handleChange}
                required
                className="form-input"
                minLength={6}
                disabled={isSubmitting}
                aria-describedby={error ? 'fcp-error' : undefined}
              />
              <small className="form-help">
                {t('settings.security.password.passwordHelp')}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                {t('settings.security.password.confirmPassword')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handleChange}
                required
                className="form-input"
                disabled={isSubmitting}
                aria-describedby={error ? 'fcp-error' : undefined}
              />
            </div>

            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                disabled={isSubmitting}
              >
                {t('navigation:menu.logout')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
              >
                {t('settings.security.password.forceChange.submit')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForceChangePassword;
