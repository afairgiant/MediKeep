import { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Textarea,
  Select,
  Checkbox,
} from '@mantine/core';
import { IconUser, IconHome, IconNotes } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import SubmitButton from '../shared/SubmitButton';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { isValidPhoneNumber } from '../../utils/phoneUtils';
import logger from '../../services/logger';

const MantineEmergencyContactForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingContact = null,
  isLoading = false,
  statusMessage,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Form handlers
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Reset tab and clear field errors when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Input change handler with phone validation
  const handleInputChangeWithValidation = e => {
    const { name, value } = e.target;

    // Clear any existing error for this field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }

    // Handle phone number validation
    const isPhoneFieldCheck =
      name === 'phone_number' || name === 'secondary_phone';
    if (
      isPhoneFieldCheck &&
      value.trim() !== '' &&
      !isValidPhoneNumber(value)
    ) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: t('errors:form.invalidPhoneDigits'),
      }));
    }

    onInputChange(e);
  };

  // Wrap handleTextInputChange to route through phone validation
  const handleValidatedTextInput = fieldName => e => {
    handleInputChangeWithValidation({
      target: { name: fieldName, value: e.target.value },
    });
  };

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('emergency_contact_form_error', {
        message: 'Error in MantineEmergencyContactForm',
        contactId: editingContact?.id,
        error: error.message,
        component: 'MantineEmergencyContactForm',
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const relationshipOptions = [
    'spouse',
    'partner',
    'parent',
    'mother',
    'father',
    'child',
    'son',
    'daughter',
    'sibling',
    'brother',
    'sister',
    'grandparent',
    'grandmother',
    'grandfather',
    'grandchild',
    'grandson',
    'granddaughter',
    'aunt',
    'uncle',
    'cousin',
    'friend',
    'neighbor',
    'caregiver',
    'guardian',
    'other',
  ].map(key => ({
    value: key,
    label: t(`medical:emergencyContacts.form.relationship.options.${key}`),
  }));

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading && !isSubmitting}
      closeOnEscape={!isLoading && !isSubmitting}
    >
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={
          statusMessage?.title || t('medical:emergencyContacts.messages.saving')
        }
        submessage={statusMessage?.message}
        type={statusMessage?.type || 'loading'}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconUser size={16} />}>
                {t('medical:emergencyContacts.tabs.contactInfo')}
              </Tabs.Tab>
              <Tabs.Tab value="details" leftSection={<IconHome size={16} />}>
                {t('shared:tabs.details')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Contact Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 7 }}>
                    <TextInput
                      label={t('shared:fields.fullName')}
                      value={formData.name || ''}
                      onChange={handleTextInputChange('name')}
                      placeholder={t(
                        'medical:emergencyContacts.form.name.placeholder'
                      )}
                      description={t(
                        'medical:emergencyContacts.form.name.description'
                      )}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <Select
                      label={t('shared:labels.relationship')}
                      value={formData.relationship || null}
                      data={relationshipOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'relationship', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:fields.selectRelationship')}
                      description={t(
                        'medical:emergencyContacts.form.relationship.description'
                      )}
                      required
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t(
                        'medical:emergencyContacts.form.primaryPhone.label'
                      )}
                      value={formData.phone_number || ''}
                      onChange={handleValidatedTextInput('phone_number')}
                      placeholder={t(
                        'medical:emergencyContacts.form.primaryPhone.placeholder'
                      )}
                      description={t(
                        'medical:emergencyContacts.form.primaryPhone.description'
                      )}
                      error={fieldErrors.phone_number}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t(
                        'medical:emergencyContacts.form.secondaryPhone.label'
                      )}
                      value={formData.secondary_phone || ''}
                      onChange={handleValidatedTextInput('secondary_phone')}
                      placeholder={t(
                        'medical:emergencyContacts.form.secondaryPhone.placeholder'
                      )}
                      error={fieldErrors.secondary_phone}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput
                      label={t('shared:fields.emailAddress')}
                      value={formData.email || ''}
                      onChange={handleTextInputChange('email')}
                      placeholder={t(
                        'medical:emergencyContacts.form.email.placeholder'
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Details Tab */}
            <Tabs.Panel value="details">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <TextInput
                      label={t('shared:labels.address')}
                      value={formData.address || ''}
                      onChange={handleTextInputChange('address')}
                      placeholder={t(
                        'medical:emergencyContacts.form.address.placeholder'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Checkbox
                      label={t(
                        'medical:emergencyContacts.form.isPrimary.label'
                      )}
                      description={t(
                        'medical:emergencyContacts.form.isPrimary.description'
                      )}
                      checked={!!formData.is_primary}
                      onChange={e =>
                        onInputChange({
                          target: {
                            name: 'is_primary',
                            value: e.currentTarget.checked,
                          },
                        })
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Checkbox
                      label={t('medical:emergencyContacts.form.isActive.label')}
                      description={t(
                        'medical:emergencyContacts.form.isActive.description'
                      )}
                      checked={!!formData.is_active}
                      onChange={e =>
                        onInputChange({
                          target: {
                            name: 'is_active',
                            value: e.currentTarget.checked,
                          },
                        })
                      }
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('shared:tabs.notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t(
                    'medical:emergencyContacts.form.notes.placeholder'
                  )}
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={onClose}
              disabled={isLoading || isSubmitting}
            >
              {t('shared:fields.cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.name?.trim()}
            >
              {editingContact
                ? t('common:buttons.update')
                : t('common:buttons.create')}{' '}
              {t('shared:categories.emergency_contacts')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineEmergencyContactForm;
