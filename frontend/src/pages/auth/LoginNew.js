import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-toastify';
import { authAPI } from '../../services/apiClient';
import '../../styles/pages/Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    username: '',
    password: '',
    email: '',
    fullName: ''
  });
  const [createUserError, setCreateUserError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
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

  const handleChange = (e) => {
    clearError(); // Clear any existing errors
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateUserChange = (e) => {
    setCreateUserError('');
    setCreateUserData({
      ...createUserData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData);
      if (result.success) {
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setCreateUserError('');

    // Client-side validation
    if (createUserData.password.length < 6) {
      setCreateUserError('Password must be at least 6 characters long');
      setIsCreatingUser(false);
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(createUserData.password);
    const hasNumber = /\d/.test(createUserData.password);
    if (!hasLetter || !hasNumber) {
      setCreateUserError('Password must contain at least one letter and one number');
      setIsCreatingUser(false);
      return;
    }

    if (createUserData.username.length < 3) {
      setCreateUserError('Username must be at least 3 characters long');
      setIsCreatingUser(false);
      return;
    }

    try {
      // Create the user
      const registerResult = await authAPI.register({
        username: createUserData.username,
        password: createUserData.password,
        email: createUserData.email,
        full_name: createUserData.fullName
      });

      if (registerResult.success) {
        toast.success('Account created successfully! Logging you in...');
        
        // Automatically log them in after successful registration
        const loginResult = await login({
          username: createUserData.username,
          password: createUserData.password
        });

        if (loginResult.success) {
          setShowCreateUser(false);
          const from = location.state?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        } else {
          toast.error('Account created but login failed. Please try logging in manually.');
          setShowCreateUser(false);
        }
      } else {
        setCreateUserError(registerResult.error || 'Failed to create account');
      }
    } catch (error) {
      setCreateUserError(error.message || 'Failed to create user. Please try again.');
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
      fullName: ''
    });
  };

  const closeCreateUserModal = () => {
    setShowCreateUser(false);
    setCreateUserError('');
  };

  // Show loading while checking authentication
  if (isLoading && isAuthenticated) {
    return <LoadingSpinner message="Redirecting..." fullScreen />;
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1>Medical Records System</h1>
            <p>Please sign in to access your medical records</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="form-control"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="form-control"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-login"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={openCreateUserModal}
                className="btn btn-link"
                disabled={isLoading}
              >
                Create Account
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="modal-overlay" onClick={closeCreateUserModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Account</h2>
              <button
                type="button"
                onClick={closeCreateUserModal}
                className="btn btn-close"
                disabled={isCreatingUser}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label htmlFor="createUsername">Username</label>
                <input
                  type="text"
                  id="createUsername"
                  name="username"
                  value={createUserData.username}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  className="form-control"
                  placeholder="Choose a username (min 3 characters)"
                  minLength="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="createEmail">Email</label>
                <input
                  type="email"
                  id="createEmail"
                  name="email"
                  value={createUserData.email}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  className="form-control"
                  placeholder="Enter your email address"
                />
              </div>

              <div className="form-group">
                <label htmlFor="createFullName">Full Name</label>
                <input
                  type="text"
                  id="createFullName"
                  name="fullName"
                  value={createUserData.fullName}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  className="form-control"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="createPassword">Password</label>
                <input
                  type="password"
                  id="createPassword"
                  name="password"
                  value={createUserData.password}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  className="form-control"
                  placeholder="Create a password (min 6 chars, letter + number)"
                  minLength="6"
                />
                <small className="form-text">
                  Password must be at least 6 characters and contain both letters and numbers
                </small>
              </div>

              {createUserError && (
                <div className="error-message">
                  {createUserError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeCreateUserModal}
                  disabled={isCreatingUser}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="btn btn-primary"
                >
                  {isCreatingUser ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
