import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { authService } from '../../services/auth/simpleAuthService';
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
  });  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  
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
    setCreateUserError(''); // Clear errors when user types
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
      toast.error(error.message || 'Login failed');    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setCreateUserError('');

    // Client-side validation - Updated to 6 characters minimum
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
    }    try {      // Create the user using the simple auth service
      const registerResult = await authService.register({
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
        }      } else {
        // Handle different error types
        let errorMessage = 'Failed to create account';
        
        if (typeof registerResult.error === 'string') {
          errorMessage = registerResult.error;
        } else if (registerResult.error && typeof registerResult.error === 'object') {
          // Handle validation error objects
          if (Array.isArray(registerResult.error.detail)) {
            const validationErrors = registerResult.error.detail.map(err => {
              if (typeof err === 'object' && err.msg) {
                return `${err.loc?.join('.')} - ${err.msg}`;
              }
              return String(err);
            }).join('; ');
            errorMessage = `Validation Error: ${validationErrors}`;
          } else if (registerResult.error.detail) {
            errorMessage = String(registerResult.error.detail);
          } else {
            errorMessage = JSON.stringify(registerResult.error);
          }
        }
        
        setCreateUserError(errorMessage);
      }    } catch (error) {
      console.error('Error creating user:', error);
      
      // Handle different error formats
      let errorMessage = 'Failed to create user. Please try again.';
      
      if (error.detail && Array.isArray(error.detail)) {
        // Handle validation errors array
        errorMessage = error.detail.map(error => 
          `${error.loc?.join('.')} - ${error.msg}`
        ).join('; ');
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
      fullName: ''
    });
  };

  const closeCreateUserModal = () => {
    setShowCreateUser(false);
    setCreateUserError('');
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

        <div className="login-actions">
          <button 
            type="button" 
            className="create-user-btn"
            onClick={openCreateUserModal}
            disabled={isLoading}
          >
            Create New User Account
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="modal-overlay" onClick={closeCreateUserModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New User Account</h2>
              <button className="close-btn" onClick={closeCreateUserModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              {createUserError && <div className="error-message">{createUserError}</div>}
              
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
              </div>              <div className="form-group">
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
                  <div className={`requirement ${createUserData.password.length >= 6 ? 'valid' : ''}`}>
                    ✓ At least 6 characters
                  </div>
                  <div className={`requirement ${/[a-zA-Z]/.test(createUserData.password) ? 'valid' : ''}`}>
                    ✓ Contains at least one letter
                  </div>
                  <div className={`requirement ${/[0-9]/.test(createUserData.password) ? 'valid' : ''}`}>
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
                <label htmlFor="create-fullname">Full Name *</label>
                <input
                  type="text"
                  id="create-fullname"
                  name="fullName"
                  value={createUserData.fullName}
                  onChange={handleCreateUserChange}
                  required
                  disabled={isCreatingUser}
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeCreateUserModal}
                  disabled={isCreatingUser}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>

            <div className="create-user-info">
              <p><strong>Note:</strong> A patient record will be automatically created for this user with default role "user".</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;