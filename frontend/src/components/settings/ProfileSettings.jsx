import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import { Card } from '../ui';
import { apiService } from '../../services/api';
import { EMAIL_REGEX } from '../../constants/validationConstants';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../services/logger';
import { notifySuccess } from '../../utils/notifyTranslated';

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

const EDITABLE_FIELDS = [
  'username',
  'email',
  'full_name',
  'first_name',
  'last_name',
];

const fieldsToFormValues = user =>
  Object.fromEntries(EDITABLE_FIELDS.map(field => [field, user?.[field] ?? '']));

const normalizeForCompare = (field, value) => {
  const trimmed = (value ?? '').trim();
  return field === 'username' ? trimmed.toLowerCase() : trimmed;
};

const diffPayload = (form, original) =>
  EDITABLE_FIELDS.reduce((payload, field) => {
    const next = normalizeForCompare(field, form[field]);
    const prev = normalizeForCompare(field, original[field]);
    if (next !== prev) {
      payload[field] = field === 'username' ? next : next || null;
    }
    return payload;
  }, {});

const ProfileSettings = () => {
  const { t } = useTranslation(['settings', 'shared']);
  const { user, updateUser, logout } = useAuth();

  const baseline = fieldsToFormValues(user);
  const [formValues, setFormValues] = useState(baseline);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const usernameChanged =
    (formValues.username ?? '').trim().toLowerCase() !==
    (baseline.username ?? '').trim().toLowerCase();
  const hasChanges = Object.keys(diffPayload(formValues, baseline)).length > 0;

  const handleChange = (field, value) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (submitError) setSubmitError('');
  };

  const handleReset = () => {
    setFormValues(baseline);
    setFieldErrors({});
    setSubmitError('');
  };

  const validate = payload => {
    const errors = {};

    if ('username' in payload) {
      const value = payload.username ?? '';
      if (value.length < 3 || value.length > 50) {
        errors.username = t('profile.errors.usernameLength');
      } else if (!USERNAME_PATTERN.test(value)) {
        errors.username = t('profile.errors.usernameChars');
      }
    }

    if ('email' in payload) {
      const value = payload.email ?? '';
      if (!value || !EMAIL_REGEX.test(value)) {
        errors.email = t('profile.errors.emailInvalid');
      }
    }

    for (const field of ['full_name', 'first_name', 'last_name']) {
      if (field in payload) {
        const value = (payload[field] ?? '').trim();
        const min = field === 'full_name' ? 2 : 1;
        const max = field === 'full_name' ? 100 : 50;
        if (value.length < min) {
          errors[field] = t('profile.errors.nameRequired');
        } else if (value.length > max) {
          errors[field] = t('profile.errors.nameTooLong', { max });
        }
      }
    }

    return errors;
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitError('');

    const payload = diffPayload(formValues, baseline);
    if (Object.keys(payload).length === 0) return;

    const errors = validate(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const updated = await apiService.updateUserProfile(payload);

      if (usernameChanged) {
        notifySuccess(t('profile.usernameChangedNotice'));
        logger.info('profile_username_changed_logout', {
          component: 'ProfileSettings',
          userId: user?.id,
        });
        await logout();
        return;
      }

      updateUser(updated);
      notifySuccess(t('profile.updateSuccess'));
    } catch (error) {
      logger.error('profile_update_failed', {
        component: 'ProfileSettings',
        error: error?.message,
      });
      setSubmitError(error?.message || t('profile.errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <div>
            <Text fw={600} size="lg">
              {t('profile.title')}
            </Text>
            <Text size="sm" c="dimmed">
              {t('profile.description')}
            </Text>
          </div>

          {submitError && (
            <Alert color="red" variant="light">
              {submitError}
            </Alert>
          )}

          {usernameChanged && (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertTriangle size={18} />}
            >
              {t('profile.usernameChangedLogoutWarning')}
            </Alert>
          )}

          <TextInput
            label={t('profile.fields.username')}
            value={formValues.username}
            onChange={event => handleChange('username', event.currentTarget.value)}
            error={fieldErrors.username}
            disabled={saving}
            autoComplete="username"
            required
          />

          <TextInput
            label={t('profile.fields.email')}
            type="email"
            value={formValues.email}
            onChange={event => handleChange('email', event.currentTarget.value)}
            error={fieldErrors.email}
            disabled={saving}
            autoComplete="email"
            required
          />

          <TextInput
            label={t('profile.fields.fullName')}
            value={formValues.full_name}
            onChange={event =>
              handleChange('full_name', event.currentTarget.value)
            }
            error={fieldErrors.full_name}
            disabled={saving}
            autoComplete="name"
          />

          <Group grow>
            <TextInput
              label={t('profile.fields.firstName')}
              value={formValues.first_name}
              onChange={event =>
                handleChange('first_name', event.currentTarget.value)
              }
              error={fieldErrors.first_name}
              disabled={saving}
              autoComplete="given-name"
            />
            <TextInput
              label={t('profile.fields.lastName')}
              value={formValues.last_name}
              onChange={event =>
                handleChange('last_name', event.currentTarget.value)
              }
              error={fieldErrors.last_name}
              disabled={saving}
              autoComplete="family-name"
            />
          </Group>

          <Group justify="flex-end" gap="sm">
            <Button
              type="button"
              variant="default"
              onClick={handleReset}
              disabled={saving || !hasChanges}
            >
              {t('shared:fields.reset', 'Reset')}
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={!hasChanges}
            >
              {t('profile.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};

export default ProfileSettings;
