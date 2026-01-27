import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '../ui';
import '../../styles/components/ChannelFormModal.css';

/**
 * Channel types with their configuration fields
 */
const CHANNEL_CONFIGS = {
  discord: {
    fields: [
      {
        name: 'webhook_url',
        label: 'Webhook URL',
        type: 'text',
        placeholder: 'https://discord.com/api/webhooks/...',
        required: true,
        helpText: 'Get this from Discord Server Settings > Integrations > Webhooks',
      },
    ],
  },
  email: {
    fields: [
      { name: 'smtp_host', label: 'SMTP Server', type: 'text', placeholder: 'smtp.gmail.com', required: true },
      { name: 'smtp_port', label: 'SMTP Port', type: 'number', placeholder: '587', required: true, defaultValue: 587 },
      { name: 'smtp_user', label: 'Username', type: 'text', placeholder: 'user@gmail.com', required: true },
      { name: 'smtp_password', label: 'Password', type: 'password', placeholder: 'App password', required: true },
      { name: 'from_email', label: 'From Email', type: 'email', placeholder: 'sender@gmail.com', required: true },
      { name: 'to_email', label: 'To Email', type: 'email', placeholder: 'recipient@example.com', required: true },
      { name: 'use_tls', label: 'Use TLS', type: 'checkbox', defaultValue: true },
    ],
  },
  gotify: {
    fields: [
      { name: 'server_url', label: 'Server URL', type: 'text', placeholder: 'https://gotify.example.com', required: true },
      { name: 'app_token', label: 'App Token', type: 'password', placeholder: 'Application token', required: true },
      { name: 'priority', label: 'Priority (0-10)', type: 'number', placeholder: '5', defaultValue: 5, min: 0, max: 10 },
    ],
  },
  webhook: {
    fields: [
      { name: 'url', label: 'Webhook URL', type: 'text', placeholder: 'https://api.example.com/webhook', required: true },
      { name: 'method', label: 'Method', type: 'select', options: ['POST', 'GET'], defaultValue: 'POST' },
      { name: 'auth_token', label: 'Auth Token (optional)', type: 'password', placeholder: 'Bearer token' },
    ],
  },
};

const CHANNEL_TYPES = [
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email (SMTP)' },
  { value: 'gotify', label: 'Gotify' },
  { value: 'webhook', label: 'Webhook' },
];

/**
 * ChannelFormModal Component
 *
 * Modal form for creating/editing notification channels
 */
const ChannelFormModal = ({ isOpen, onClose, onSave, channel }) => {
  const { t } = useTranslation(['notifications', 'common']);
  const [formData, setFormData] = useState({
    name: '',
    channel_type: 'discord',
    config: {},
    is_enabled: true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!channel;

  // Initialize form data when channel changes
  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name || '',
        channel_type: channel.channel_type || 'discord',
        config: channel.config_masked || {},
        is_enabled: channel.is_enabled !== false,
      });
    } else {
      setFormData({
        name: '',
        channel_type: 'discord',
        config: {},
        is_enabled: true,
      });
    }
    setErrors({});
  }, [channel, isOpen]);

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when field changes
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleConfigChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [fieldName]: value,
      },
    }));
    // Clear error when field changes
    if (errors[`config.${fieldName}`]) {
      setErrors(prev => ({ ...prev, [`config.${fieldName}`]: null }));
    }
  };

  const handleChannelTypeChange = e => {
    const newType = e.target.value;
    // Reset config when type changes, but keep name
    setFormData(prev => ({
      ...prev,
      channel_type: newType,
      config: {},
    }));
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('channels.errors.nameRequired', 'Channel name is required');
    }

    // Validate config fields based on channel type
    const typeConfig = CHANNEL_CONFIGS[formData.channel_type];
    if (typeConfig) {
      typeConfig.fields.forEach(field => {
        if (field.required) {
          const value = formData.config[field.name];
          if (!value || (typeof value === 'string' && !value.trim())) {
            // Don't require masked fields when editing
            if (!(isEditing && field.type === 'password' && value?.includes('...'))) {
              newErrors[`config.${field.name}`] = t('channels.errors.fieldRequired', '{{field}} is required', { field: field.label });
            }
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      // Build the data to send
      const dataToSave = {
        name: formData.name.trim(),
        is_enabled: formData.is_enabled,
      };

      // For new channels, always include type and full config
      // For edits, only include config if changed (skip masked password fields)
      if (!isEditing) {
        dataToSave.channel_type = formData.channel_type;
        dataToSave.config = { ...formData.config };
      } else {
        // Only include config fields that have been changed
        const configToSave = {};
        const typeConfig = CHANNEL_CONFIGS[formData.channel_type];
        let hasConfigChanges = false;

        if (typeConfig) {
          typeConfig.fields.forEach(field => {
            const value = formData.config[field.name];
            // Skip masked values (they haven't been changed)
            if (value && typeof value === 'string' && !value.includes('...')) {
              configToSave[field.name] = value;
              hasConfigChanges = true;
            } else if (typeof value === 'boolean' || typeof value === 'number') {
              configToSave[field.name] = value;
              hasConfigChanges = true;
            }
          });
        }

        if (hasConfigChanges) {
          dataToSave.config = configToSave;
        }
      }

      await onSave(dataToSave, isEditing);
    } catch {
      // Error handled in parent
    } finally {
      setSaving(false);
    }
  };

  const renderConfigFields = () => {
    const typeConfig = CHANNEL_CONFIGS[formData.channel_type];
    if (!typeConfig) return null;

    return typeConfig.fields.map(field => {
      const value = formData.config[field.name] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
      const error = errors[`config.${field.name}`];

      if (field.type === 'checkbox') {
        return (
          <div key={field.name} className="form-group form-group-checkbox">
            <label>
              <input type="checkbox" checked={!!value} onChange={e => handleConfigChange(field.name, e.target.checked)} />
              <span>{field.label}</span>
            </label>
          </div>
        );
      }

      if (field.type === 'select') {
        return (
          <div key={field.name} className="form-group">
            <label>{field.label}</label>
            <select value={value || field.defaultValue || ''} onChange={e => handleConfigChange(field.name, e.target.value)}>
              {field.options.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {error && <span className="field-error">{error}</span>}
          </div>
        );
      }

      return (
        <div key={field.name} className={`form-group ${error ? 'has-error' : ''}`}>
          <label>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <input
            type={field.type}
            value={value}
            onChange={e => handleConfigChange(field.name, field.type === 'number' ? parseInt(e.target.value, 10) || '' : e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
          />
          {field.helpText && <span className="field-help">{field.helpText}</span>}
          {error && <span className="field-error">{error}</span>}
        </div>
      );
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? t('channels.edit', 'Edit Channel') : t('channels.add', 'Add Channel')}>
      <form className="channel-form" onSubmit={handleSubmit}>
        <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
          <label>
            {t('channels.fields.name', 'Channel Name')}
            <span className="required">*</span>
          </label>
          <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder={t('channels.fields.namePlaceholder', 'My Discord Server')} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        {!isEditing && (
          <div className="form-group">
            <label>{t('channels.fields.type', 'Channel Type')}</label>
            <select name="channel_type" value={formData.channel_type} onChange={handleChannelTypeChange}>
              {CHANNEL_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group form-group-checkbox">
          <label>
            <input type="checkbox" name="is_enabled" checked={formData.is_enabled} onChange={handleInputChange} />
            <span>{t('channels.fields.enabled', 'Enable this channel')}</span>
          </label>
        </div>

        <div className="config-section">
          <h4>
            {t('channels.configTitle', '{{type}} Configuration', {
              type: CHANNEL_TYPES.find(t => t.value === formData.channel_type)?.label || formData.channel_type,
            })}
          </h4>
          {renderConfigFields()}
        </div>

        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            {t('common:buttons.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" type="submit" loading={saving} disabled={saving}>
            {saving ? t('common:buttons.saving', 'Saving...') : isEditing ? t('common:buttons.save', 'Save') : t('common:buttons.create', 'Create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

ChannelFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  channel: PropTypes.object,
};

ChannelFormModal.defaultProps = {
  channel: null,
};

export default ChannelFormModal;
