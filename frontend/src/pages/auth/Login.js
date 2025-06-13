import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import '../../styles/pages/Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
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
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateUserChange = (e) => {
    setCreateUserData({
      ...createUserData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await apiService.login(formData.username, formData.password);
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };  const handleCreateUser = async (e) => {
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
    }

    try {
      // Create the user
      await apiService.register(
        createUserData.username,
        createUserData.password,
        createUserData.email,
        createUserData.fullName
      );

      // Automatically log them in after successful registration
      const loginData = await apiService.login(createUserData.username, createUserData.password);
      localStorage.setItem('token', loginData.access_token);
      
      // Close modal and navigate to dashboard
      setShowCreateUser(false);
      navigate('/dashboard');
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