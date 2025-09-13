import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
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
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
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
  const handleCreateUserChange = e => {
    setCreateUserError(''); // Clear errors when user types
    setCreateUserData({
      ...createUserData,
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
        
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async e => {
    e.preventDefault();
    setIsCreatingUser(true);
    setCreateUserError('');

    // Client-side validation
    if (createUserData.firstName.trim().length < 1) {
      setCreateUserError('Please enter your first name');
      setIsCreatingUser(false);
      return;
    }

    if (createUserData.lastName.trim().length < 1) {
      setCreateUserError('Please enter your last name');
      setIsCreatingUser(false);
      return;
    }

    if (createUserData.username.length < 3) {
      setCreateUserError('Username must be at least 3 characters long');
      setIsCreatingUser(false);
      return;
    }

    if (createUserData.password.length < 6) {
      setCreateUserError('Password must be at least 6 characters long');
      setIsCreatingUser(false);
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(createUserData.password);
    const hasNumber = /\d/.test(createUserData.password);
    if (!hasLetter || !hasNumber) {
      setCreateUserError(
        'Password must contain at least one letter and one number'
      );
      setIsCreatingUser(false);
      return;
    }
    try {
      // Create the user using the simple auth service
      const registerResult = await authService.register({
        username: createUserData.username,
        password: createUserData.password,
        email: createUserData.email,
        full_name: `${createUserData.firstName} ${createUserData.lastName}`,
        first_name: createUserData.firstName,
        last_name: createUserData.lastName,
      });

      if (registerResult.success) {
        toast.success('Account created successfully! Logging you in...');

        // Automatically log them in after successful registration
        const loginResult = await login({
          username: createUserData.username,
          password: createUserData.password,
        });

        if (loginResult.success) {
          setShowCreateUser(false);
          
          // Add a small delay to ensure auth state is fully saved before navigation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Redirect new users to patient info page in edit mode
          navigate('/patients/me?edit=true', { replace: true });
        } else {
          toast.error(
            'Account created but login failed. Please try logging in manually.'
          );
          setShowCreateUser(false);
        }
      } else {
        // Handle different error types
        let errorMessage = 'Failed to create account';

        if (typeof registerResult.error === 'string') {
          errorMessage = registerResult.error;
        } else if (
          registerResult.error &&
          typeof registerResult.error === 'object'
        ) {
          // Handle validation error objects
          if (Array.isArray(registerResult.error.detail)) {
            const validationErrors = registerResult.error.detail
              .map(err => {
                if (typeof err === 'object' && err.msg) {
                  return `${err.loc?.join('.')} - ${err.msg}`;
                }
                return String(err);
              })
              .join('; ');
            errorMessage = `Validation Error: ${validationErrors}`;
          } else if (registerResult.error.detail) {
            errorMessage = String(registerResult.error.detail);
          } else {
            errorMessage = JSON.stringify(registerResult.error);
          }
        }

        setCreateUserError(errorMessage);
      }
    } catch (error) {
      frontendLogger.logError('Error creating user', {
        error: error.message,
        component: 'Login',
      });

      // Handle different error formats
      let errorMessage = 'Failed to create user. Please try again.';

      if (error.detail && Array.isArray(error.detail)) {
        // Handle validation errors array
        errorMessage = error.detail
          .map(error => `${error.loc?.join('.')} - ${error.msg}`)
          .join('; ');
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setCreateUserError(errorMessage);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const openCreateUserModal = () => {
    setShowCreateUser(true);
    setCreateUserError('');
    setCreateUserData({
      username: '',
      password: '',
      email: '',
      firstName: '',
      lastName: '',
    });
  };

  const closeCreateUserModal = () => {
    setShowCreateUser(false);
    setCreateUserError('');
    setCreateUserData({
      username: '',
      password: '',
      email: '',
      firstName: '',
      lastName: '',
    });
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
      toast.error(error.message || 'Failed to start SSO login');
    } finally {
      setSSOLoading(false);
    }
  };
  return (
    <div className="login-container">
      <div className="login-form">
        <h1>🏥 Medical Records System</h1>
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
              onClick={openCreateUserModal}
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

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="modal-overlay" onClick={closeCreateUserModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New User Account</h2>
              <button className="close-btn" onClick={closeCreateUserModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              {createUserError && (
                <div className="error-message">{createUserError}</div>
              )}
              <div className="form-group">
                <label htmlFor="create-username">Username *</label>
                <input
                  type="text"
                  id="create-username"
                  name="username"
                  value={createUserData.username}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter username"
                />
              </div>{' '}
              <div className="form-group">
                <label htmlFor="create-password">Password *</label>
                <input
                  type="password"
                  id="create-password"
                  name="password"
                  value={createUserData.password}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter password (min 6 chars, include letter & number)"
                  minLength={6}
                />
                <div className="password-requirements">
                  <div
                    className={`requirement ${createUserData.password.length >= 6 ? 'valid' : ''}`}
                  >
                    ✓ At least 6 characters
                  </div>
                  <div
                    className={`requirement ${/[a-zA-Z]/.test(createUserData.password) ? 'valid' : ''}`}
                  >
                    ✓ Contains at least one letter
                  </div>
                  <div
                    className={`requirement ${/[0-9]/.test(createUserData.password) ? 'valid' : ''}`}
                  >
                    ✓ Contains at least one number
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="create-email">Email *</label>
                <input
                  type="email"
                  id="create-email"
                  name="email"
                  value={createUserData.email}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter email address"
                />
              </div>
              <div className="form-group">
                <label htmlFor="create-firstname">First Name *</label>
                <input
                  type="text"
                  id="create-firstname"
                  name="firstName"
                  value={createUserData.firstName}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter first name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="create-lastname">Last Name *</label>
                <input
                  type="text"
                  id="create-lastname"
                  name="lastName"
                  value={createUserData.lastName}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter last name"
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={closeCreateUserModal}
                  disabled={isCreatingUser}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isCreatingUser}
                  loading={isCreatingUser}
                >
                  Create Account
                </Button>
              </div>
            </form>

            <div className="create-user-info">
              <p>
                <strong>Note:</strong> A patient record will be automatically
                created for this user with default role "user".
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
