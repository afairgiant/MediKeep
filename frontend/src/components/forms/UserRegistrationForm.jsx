import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { notifySuccess } from '../../utils/notifyTranslated';
import { authService } from '../../services/auth/simpleAuthService';
import { adminApiService } from '../../services/api/adminApi';
import frontendLogger from '../../services/frontendLogger';
import { Button, Checkbox, Select } from '../ui';

const UserRegistrationForm = ({ onSuccess, onCancel, isAdminContext = false }) => {
  const { t } = useTranslation('common');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Patient linking state (admin only)
  const [linkExistingPatient, setLinkExistingPatient] = useState(false);
  const [allPatients, setAllPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Load all patients when linking is enabled
  useEffect(() => {
    if (!linkExistingPatient || !isAdminContext) {
      return;
    }

    let cancelled = false;
    const loadPatients = async () => {
      setIsLoadingPatients(true);
      try {
        const response = await adminApiService.searchAllPatients();
        if (!cancelled) {
          setAllPatients(response.patients || []);
        }
      } catch (err) {
        frontendLogger.logError('Failed to load patients', {
          error: err.message,
          component: 'UserRegistrationForm',
        });
        if (!cancelled) {
          setAllPatients([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPatients(false);
        }
      }
    };

    loadPatients();
    return () => { cancelled = true; };
  }, [linkExistingPatient, isAdminContext]);

  // Build dropdown options from patient data
  const patientOptions = useMemo(() => {
    return allPatients.map(patient => {
      const selfTag = patient.is_self_record ? ' [Self-Record]' : '';
      const ownerInfo = patient.owner_full_name
        ? ` (${t('admin.createUser.linkPatient.owner', 'Owner')}: ${patient.owner_full_name})`
        : '';
      const dobInfo = patient.birth_date
        ? ` - ${t('admin.createUser.linkPatient.dob', 'DOB')}: ${patient.birth_date}`
        : '';

      return {
        value: String(patient.id),
        label: `${patient.first_name} ${patient.last_name}${selfTag}${dobInfo}${ownerInfo}`,
      };
    });
  }, [allPatients, t]);

  // Get the full patient object for the currently selected ID
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return allPatients.find(p => String(p.id) === selectedPatientId) || null;
  }, [selectedPatientId, allPatients]);

  const handleChange = e => {
    setError('');
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLinkToggle = (checked) => {
    setLinkExistingPatient(checked);
    if (!checked) {
      setSelectedPatientId(null);
    }
    setError('');
  };

  const handlePatientSelect = (value) => {
    setSelectedPatientId(value);
    setError('');
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      setError(t('admin.createUser.validation.firstNameRequired', 'Please enter the first name'));
      return false;
    }

    if (!formData.lastName.trim()) {
      setError(t('admin.createUser.validation.lastNameRequired', 'Please enter the last name'));
      return false;
    }

    if (formData.username.length < 3) {
      setError(t('admin.createUser.validation.usernameMinLength', 'Username must be at least 3 characters long'));
      return false;
    }

    if (formData.password.length < 6) {
      setError(t('admin.createUser.validation.passwordMinLength', 'Password must be at least 6 characters long'));
      return false;
    }

    if (!/[a-zA-Z]/.test(formData.password) || !/\d/.test(formData.password)) {
      setError(t('admin.createUser.validation.passwordRequirements', 'Password must contain at least one letter and one number'));
      return false;
    }

    return true;
  };

  // Extract a user-friendly message from various API error shapes
  const parseErrorMessage = (err, fallback) => {
    if (typeof err === 'string') return err;

    if (err?.detail && Array.isArray(err.detail)) {
      return err.detail
        .map(e => (typeof e === 'object' && e.msg) ? `${e.loc?.join('.')} - ${e.msg}` : String(e))
        .join('; ');
    }

    if (err?.detail) return String(err.detail);
    if (err?.message) return err.message;
    if (typeof err === 'object') return JSON.stringify(err);

    return fallback;
  };

  const buildPayload = () => ({
    username: formData.username,
    password: formData.password,
    email: formData.email,
    full_name: `${formData.firstName} ${formData.lastName}`,
    first_name: formData.firstName,
    last_name: formData.lastName,
    role: formData.role,
  });

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      if (isAdminContext) {
        const payload = buildPayload();

        if (linkExistingPatient && selectedPatient) {
          payload.link_patient_id = selectedPatient.id;
        }

        const result = await adminApiService.createUserWithPatientLink(payload);

        if (result.status === 'success' || result.status === 'partial_success') {
          const successKey = result.data?.linked_patient_id
            ? 'notifications:toasts.auth.userCreatedWithLinkSuccess'
            : 'notifications:toasts.auth.userCreatedSuccess';

          notifySuccess(successKey);

          if (result.status === 'partial_success') {
            frontendLogger.logError('Partial success creating user with patient link', {
              message: result.message,
              component: 'UserRegistrationForm',
            });
          }

          onSuccess?.({
            userData: result.data,
            formData,
            isAdminContext: true,
            linkedPatientId: result.data?.linked_patient_id,
          });
        } else {
          setError(result.message || t('admin.createUser.errors.createFailed', 'Failed to create user'));
        }
      } else {
        const registerResult = await authService.register(buildPayload());

        if (registerResult.success) {
          notifySuccess('notifications:toasts.auth.accountCreatedSuccess');

          onSuccess?.({
            userData: registerResult.data,
            formData,
            isAdminContext: false,
          });
        } else {
          setError(parseErrorMessage(
            registerResult.error,
            t('admin.createUser.errors.accountCreateFailed', 'Failed to create account')
          ));
        }
      }
    } catch (err) {
      frontendLogger.logError('Error creating user', {
        error: err.message,
        component: 'UserRegistrationForm',
        isAdminContext,
      });

      setError(parseErrorMessage(
        err,
        t('admin.createUser.errors.createRetry', 'Failed to create user. Please try again.')
      ));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="username">{t('admin.createUser.username', 'Username')} *</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder={t('admin.createUser.usernamePlaceholder', 'Enter username')}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">{t('admin.createUser.password', 'Password')} *</label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder={t('admin.createUser.passwordPlaceholder', 'Enter password (min 6 chars, include letter & number)')}
          minLength={6}
        />
        <div className="password-requirements">
          <div className={`requirement ${formData.password.length >= 6 ? 'valid' : ''}`}>
            {t('admin.createUser.passwordReqs.minLength', 'At least 6 characters')}
          </div>
          <div className={`requirement ${/[a-zA-Z]/.test(formData.password) ? 'valid' : ''}`}>
            {t('admin.createUser.passwordReqs.hasLetter', 'Contains at least one letter')}
          </div>
          <div className={`requirement ${/[0-9]/.test(formData.password) ? 'valid' : ''}`}>
            {t('admin.createUser.passwordReqs.hasNumber', 'Contains at least one number')}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">{t('admin.createUser.email', 'Email')} *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder={t('admin.createUser.emailPlaceholder', 'Enter email address')}
        />
      </div>

      {isAdminContext && (
        <div className="form-group">
          <label htmlFor="role">{t('admin.createUser.role', 'Role')} *</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            disabled={isCreating}
          >
            <option value="user">{t('admin.createUser.roleUser', 'User')}</option>
            <option value="admin">{t('admin.createUser.roleAdmin', 'Admin')}</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="firstName">{t('admin.createUser.firstName', 'First Name')} *</label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder={t('admin.createUser.firstNamePlaceholder', 'Enter first name')}
        />
      </div>

      <div className="form-group">
        <label htmlFor="lastName">{t('admin.createUser.lastName', 'Last Name')} *</label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          required
          disabled={isCreating}
          placeholder={t('admin.createUser.lastNamePlaceholder', 'Enter last name')}
        />
      </div>

      {isAdminContext && (
        <div className="form-group patient-link-section">
          <Checkbox
            checked={linkExistingPatient}
            onChange={handleLinkToggle}
            label={t('admin.createUser.linkPatient.checkbox', 'Link to existing patient record')}
            disabled={isCreating}
            id="linkExistingPatient"
          />
          <p className="field-hint">
            {t('admin.createUser.linkPatient.hint', 'Instead of creating a new patient record, link the new user to an existing patient (e.g., a child who now needs their own login).')}
          </p>

          {linkExistingPatient && (
            <div className="patient-select-container">
              <Select
                value={selectedPatientId}
                onChange={handlePatientSelect}
                options={patientOptions}
                placeholder={
                  isLoadingPatients
                    ? t('admin.createUser.linkPatient.loading', 'Loading patients...')
                    : t('admin.createUser.linkPatient.selectPlaceholder', 'Select a patient...')
                }
                disabled={isCreating || isLoadingPatients}
                searchable
                clearable
              />

              {selectedPatient && (
                <div className="selected-patient-card">
                  <div className="selected-patient-info">
                    <p>
                      <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong>
                      {selectedPatient.is_self_record && (
                        <span className="self-record-badge">
                          {t('admin.createUser.linkPatient.selfRecordBadge', 'Self-Record')}
                        </span>
                      )}
                    </p>
                    <p>{t('admin.createUser.linkPatient.patientId', 'ID')}: {selectedPatient.id}</p>
                    {selectedPatient.birth_date && (
                      <p>{t('admin.createUser.linkPatient.dob', 'DOB')}: {selectedPatient.birth_date}</p>
                    )}
                    {selectedPatient.owner_full_name && (
                      <p>{t('admin.createUser.linkPatient.currentOwner', 'Current Owner')}: {selectedPatient.owner_full_name}</p>
                    )}
                  </div>
                  {selectedPatient.is_self_record && (
                    <div className="self-record-warning">
                      <strong>{t('admin.createUser.linkPatient.selfRecordWarningTitle', 'Note:')}</strong>{' '}
                      {t('admin.createUser.linkPatient.selfRecordWarning', 'This is the current owner\'s self-record. A new self-record will be created for the original owner with their demographics copied over. The original owner will receive edit access to this patient.')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isCreating}
          >
            {t('buttons.cancel', 'Cancel')}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isCreating}
          loading={isCreating}
        >
          {t('admin.createUser.submitButton', 'Create Account')}
        </Button>
      </div>

      {!isAdminContext && (
        <div className="create-user-info">
          <p>
            <strong>{t('admin.createUser.noteLabel', 'Note:')}</strong> {t('admin.createUser.noteText', 'A patient record will be automatically created for this user with default role "user".')}
          </p>
        </div>
      )}
    </form>
  );
};

export default UserRegistrationForm;
