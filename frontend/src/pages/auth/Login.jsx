import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notifyError } from '../../utils/notifyTranslated';
import { authService } from '../../services/auth/simpleAuthService';
import frontendLogger from '../../services/frontendLogger';
import { Button } from '../../components/ui';
import '../../styles/pages/Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [ssoConfig, setSSOConfig] = useState({ enabled: false });
  const [ssoLoading, setSSOLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, clearError, isAuthenticated } = useAuth();

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
    <div className="login-container">
      <div className="login-form">
        <h1><img src="/medikeep-icon.svg" alt="" width={40} height={40} style={{ verticalAlign: 'middle', marginRight: '8px' }} />MediKeep</h1>
        <h2>Login</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* SSO Login Option */}
        {ssoConfig.enabled && (
          <div className="sso-section">
            <div className="divider">
              <span>or</span>
            </div>
            <button
              type="button"
              className="sso-btn"
              onClick={handleSSOLogin}
              disabled={isLoading || ssoLoading}
            >
              {ssoLoading ? 'Redirecting...' : `Continue with ${ssoConfig.provider_type === 'google' ? 'Google' : ssoConfig.provider_type === 'github' ? 'GitHub' : 'SSO'}`}
            </button>
          </div>
        )}

        <div className="login-actions">
          {registrationEnabled ? (
            <button
              type="button"
              className="create-user-btn"
              onClick={handleCreateUserNavigation}
              disabled={isLoading}
            >
              Create New User Account
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
