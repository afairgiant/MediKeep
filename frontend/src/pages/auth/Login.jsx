import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { notifyError } from '../../utils/notifyTranslated';
import { authService } from '../../services/auth/simpleAuthService';
import frontendLogger from '../../services/frontendLogger';
import { Button } from '../../components/ui';
import { IconUser, IconLock, IconEye, IconEyeOff } from '@tabler/icons-react';
import styles from '../../styles/pages/Login.module.css';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [ssoConfig, setSSOConfig] = useState({ enabled: false });
  const [ssoLoading, setSSOLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, clearError, isAuthenticated } = useAuth();
  const { t } = useTranslation('common');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Check registration status and SSO config on mount
  useEffect(() => {
    const checkRegistration = async () => {
      const status = await authService.checkRegistrationEnabled();
      setRegistrationEnabled(status.registration_enabled);
      setRegistrationMessage(status.message || '');
    };

    const checkSSO = async () => {
      const config = await authService.getSSOConfig();
      setSSOConfig(config);
    };

    checkRegistration();
    checkSSO();
  }, []);

  const handleChange = e => {
    clearError(); // Clear any existing errors
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData);
      if (result.success) {
        // Add a small delay to ensure auth state is fully saved before navigation
        await new Promise(resolve => setTimeout(resolve, 500));

        if (result.mustChangePassword) {
          navigate('/change-password', { replace: true });
        } else {
          const from = location.state?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        }
      } else {
        notifyError('notifications:toasts.auth.loginFailed');
      }
    } catch (error) {
      frontendLogger.logError('Login failed', {
        error: error && error.message ? error.message : String(error),
        component: 'Login',
      });
      notifyError('notifications:toasts.auth.loginFailed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUserNavigation = () => {
    navigate('/user-creation');
  };

  const handleSSOLogin = async () => {
    setSSOLoading(true);
    try {
      // Store current location for redirect after SSO
      const returnUrl = location.state?.from?.pathname || '/dashboard';
      sessionStorage.setItem('sso_return_url', returnUrl);

      const result = await authService.initiateSSOLogin(returnUrl);
      // Redirect to SSO provider
      window.location.href = result.auth_url;
    } catch (error) {
      frontendLogger.logError('SSO login initiation failed', {
        error: error.message,
        component: 'Login',
      });
      notifyError('notifications:toasts.auth.ssoFailed');
    } finally {
      setSSOLoading(false);
    }
  };
  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginForm}>
        <div className={styles.loginHeader}>
          <h1>
            <img
              src="/medikeep-icon.svg"
              alt=""
              width={40}
              height={40}
              style={{ verticalAlign: 'middle', marginRight: '8px' }}
            />
            MediKeep
          </h1>
        </div>

        <div className={styles.loginDivider}>
          <span>{t('auth.login.title')}</span>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username">{t('auth.login.username')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIconPrefix}>
                <IconUser size={18} />
              </span>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder={t('auth.login.usernamePlaceholder')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">{t('auth.login.password')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIconPrefix}>
                <IconLock size={18} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('auth.login.passwordPlaceholder')}
                required
                disabled={isLoading}
              />
              <span
                className={styles.inputIconSuffix}
                onClick={() => setShowPassword(!showPassword)}
                role="button"
                tabIndex={0}
                aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              >
                {showPassword ? (
                  <IconEyeOff size={18} />
                ) : (
                  <IconEye size={18} />
                )}
              </span>
            </div>
          </div>


          <button type="submit" disabled={isLoading} className={styles.submitBtn}>
            {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        {/* SSO Login Option */}
        {ssoConfig.enabled && (
          <div className={styles.ssoSection}>
            <div className={styles.divider}>
              <span>{t('auth.login.or')}</span>
            </div>
            <button
              type="button"
              className={styles.ssoBtn}
              onClick={handleSSOLogin}
              disabled={isLoading || ssoLoading}
            >
              {ssoLoading ? t('labels.loading') : t('auth.login.continueWith', { provider: ssoConfig.provider_type === 'google' ? 'Google' : ssoConfig.provider_type === 'github' ? 'GitHub' : 'SSO' })}
            </button>
          </div>
        )}

        <div className={styles.loginActions}>
          {registrationEnabled ? (
            <button
              type="button"
              className={styles.createUserBtn}
              onClick={handleCreateUserNavigation}
              disabled={isLoading}
            >
              {t('auth.login.createAccount')}
            </button>
          ) : (
            <div className="registration-disabled-message">
              {registrationMessage || 'New user registration is currently disabled.'}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Login;
