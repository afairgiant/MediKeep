import React, { useState } from 'react';
import { notifySuccess } from '../../utils/notifyTranslated';
import { authService } from '../../services/auth/simpleAuthService';
import frontendLogger from '../../services/frontendLogger';
import { Button } from '../ui';

const UserRegistrationForm = ({ onSuccess, onCancel, isAdminContext = false }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'user', // Default to 'user' role
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => {
    setError(''); // Clear errors when user types
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (formData.firstName.trim().length < 1) {
      setError('Please enter your first name');
      return false;
    }

    if (formData.lastName.trim().length < 1) {
      setError('Please enter your last name');
      return false;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /\d/.test(formData.password);
    if (!hasLetter || !hasNumber) {
      setError('Password must contain at least one letter and one number');
      return false;
    }

    return true;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const registerResult = await authService.register({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        full_name: `${formData.firstName} ${formData.lastName}`,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
      });

      if (registerResult.success) {
        const successMessage = isAdminContext 
          ? 'User account created successfully!'
          : 'Account created successfully! Logging you in...';
        
        notifySuccess(successMessage);
        
        // Call success callback with user data and context info
        onSuccess && onSuccess({
          userData: registerResult.data,
          formData: formData,
          isAdminContext: isAdminContext
        });
      } else {
        // Handle different error types
        let errorMessage = 'Failed to create account';

        if (typeof registerResult.error === 'string') {
          errorMessage = registerResult.error;
        } else if (registerResult.error && typeof registerResult.error === 'object') {
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

        setError(errorMessage);
      }
    } catch (error) {
      frontendLogger.logError('Error creating user', {
        error: error.message,
        component: 'UserRegistrationForm',
        isAdminContext: isAdminContext
      });

      let errorMessage = 'Failed to create user. Please try again.';

      if (error.detail && Array.isArray(error.detail)) {
        errorMessage = error.detail
          .map(error => `${error.loc?.join('.')} - ${error.msg}`)
          .join('; ');
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="username">Username *</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder="Enter username"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password *</label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder="Enter password (min 6 chars, include letter & number)"
          minLength={6}
        />
        <div className="password-requirements">
          <div className={`requirement ${formData.password.length >= 6 ? 'valid' : ''}`}>
            ✓ At least 6 characters
          </div>
          <div className={`requirement ${/[a-zA-Z]/.test(formData.password) ? 'valid' : ''}`}>
            ✓ Contains at least one letter
          </div>
          <div className={`requirement ${/[0-9]/.test(formData.password) ? 'valid' : ''}`}>
            ✓ Contains at least one number
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder="Enter email address"
        />
      </div>

      {isAdminContext && (
        <div className="form-group">
          <label htmlFor="role">Role *</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            disabled={isCreating}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="firstName">First Name *</label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder="Enter first name"
        />
      </div>

      <div className="form-group">
        <label htmlFor="lastName">Last Name *</label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder="Enter last name"
        />
      </div>

      <div className="form-actions">
        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isCreating}
          loading={isCreating}
        >
          Create Account
        </Button>
      </div>

      {!isAdminContext && (
        <div className="create-user-info">
          <p>
            <strong>Note:</strong> A patient record will be automatically
            created for this user with default role "user".
          </p>
        </div>
      )}
    </form>
  );
};

export default UserRegistrationForm;