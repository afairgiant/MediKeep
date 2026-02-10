import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Select,
  Textarea,
  NumberInput,
  Checkbox,
  Text,
  Divider,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconUser,
  IconShield,
  IconPhone,
  IconFileText,
} from '@tabler/icons-react';
import { getFormFields } from '../../../utils/medicalFormFields';
import { isValidPhoneNumber, isPhoneField } from '../../../utils/phoneUtils';
import { formatDateInputChange, parseDateInput } from '../../../utils/dateUtils';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';
import { useTranslation } from 'react-i18next';
import { translateField } from '../../../utils/translateField';

const InsuranceFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem = null,
  children,
  onFileUploadComplete,
}) => {
  const { t } = useTranslation(['medical', 'common']);

  // Get insurance form fields
  const fields = getFormFields('insurance');

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Form handlers
  const {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
    handleNumberChange,
  } = useFormHandlers(onInputChange);

  // Reset tab and clear errors when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setFieldErrors({});
    } else {
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Input change handler with phone validation and logging
  const handleInputChange = (e) => {
    try {
      const { name, value } = e.target;
      
      // Clear any existing error for this field
      if (fieldErrors[name]) {
        setFieldErrors(prev => ({
          ...prev,
          [name]: null
        }));
      }
      
      // Handle phone number validation using centralized detection
      const fieldInfo = fields.find(f => f.name === name);
      const isPhoneFieldCheck = isPhoneField(name, fieldInfo?.type);
      if (isPhoneFieldCheck) {
        if (value.trim() !== '' && !isValidPhoneNumber(value)) {
          setFieldErrors(prev => ({
            ...prev,
            [name]: t('common:errors.invalidPhone', 'Please enter a valid phone number')
          }));
        }

        onInputChange(e);
        return;
      }
      
      // Log important field changes
      if (['insurance_type', 'company_name', 'status'].includes(name)) {
        logger.info('Insurance form field changed', {
          field: name,
          value: value,
          editing: !!editingItem,
          insurance_id: editingItem?.id,
        });
      }

      onInputChange(e);
    } catch (error) {
      logger.error('Error handling insurance form input change:', error);
    }
  };

  // Validate form data based on insurance type
  const validateForm = () => {
    const errors = [];
    const selectedType = formData.insurance_type;
    
    // Basic required fields validation
    const basicRequiredFields = ['insurance_type', 'company_name', 'member_name', 'member_id', 'effective_date', 'status'];
    basicRequiredFields.forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === '') {
        errors.push(`${field.replace(/_/g, ' ')} is required`);
      }
    });
    
    // Conditional required fields based on insurance type
    if (selectedType === 'prescription') {
      if (!formData.bin_number || formData.bin_number.trim() === '') {
        errors.push('BIN Number is required for prescription insurance');
      }
      if (!formData.pcn_number || formData.pcn_number.trim() === '') {
        errors.push('PCN Number is required for prescription insurance');
      }
    }
    
    // Date validation
    if (formData.expiration_date && formData.effective_date) {
      const effectiveDate = new Date(formData.effective_date);
      const expirationDate = new Date(formData.expiration_date);
      if (expirationDate <= effectiveDate) {
        errors.push('Expiration date must be after effective date');
      }
    }
    
    // Numeric field validation
    const numericFields = [
      'deductible_individual', 'deductible_family', 'copay_primary_care', 'copay_specialist',
      'copay_emergency_room', 'copay_urgent_care', 'annual_maximum', 'preventive_coverage',
      'basic_coverage', 'major_coverage', 'exam_copay', 'frame_allowance', 'contact_allowance',
      'copay_generic', 'copay_brand', 'copay_specialty'
    ];
    
    numericFields.forEach(field => {
      if (formData[field] && formData[field] !== '') {
        const value = parseFloat(formData[field]);
        if (isNaN(value) || value < 0) {
          errors.push(`${field.replace(/_/g, ' ')} must be a positive number`);
        }
        
        // Percentage validation
        if (field.includes('coverage') && value > 100) {
          errors.push(`${field.replace(/_/g, ' ')} cannot exceed 100%`);
        }
      }
    });
    
    // Phone number validation
    const phoneFields = ['customer_service_phone', 'preauth_phone', 'provider_services_phone'];
    phoneFields.forEach(field => {
      if (formData[field] && formData[field].trim() !== '') {
        if (!isValidPhoneNumber(formData[field])) {
          errors.push(`${field.replace(/_/g, ' ')} must be a valid phone number`);
        }
      }
    });
    
    return errors;
  };

  // Enhanced submit handler with field-level validation and logging
  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      logger.info('Insurance form submission started', {
        editing: !!editingItem,
        insurance_id: editingItem?.id,
        insurance_type: formData.insurance_type,
        company: formData.company_name,
      });

      // Validate all fields and collect errors
      const newFieldErrors = {};
      let hasErrors = false;
      
      // Basic required fields validation
      const basicRequiredFields = ['insurance_type', 'company_name', 'member_name', 'member_id', 'effective_date', 'status'];
      basicRequiredFields.forEach(field => {
        if (!formData[field] || formData[field].toString().trim() === '') {
          newFieldErrors[field] = `${field.replace(/_/g, ' ')} is required`;
          hasErrors = true;
        }
      });
      
      // Phone validation using centralized detection
      const filteredFields = getFilteredFields();
      Object.keys(formData).forEach(fieldName => {
        const fieldConfig = filteredFields.find(f => f.name === fieldName);
        const isPhoneFieldCheck = isPhoneField(fieldName, fieldConfig?.type);
                            
        if (isPhoneFieldCheck && formData[fieldName] && formData[fieldName].trim() !== '') {
          if (!isValidPhoneNumber(formData[fieldName])) {
            newFieldErrors[fieldName] = t('common:errors.invalidPhone', 'Please enter a valid phone number');
            hasErrors = true;
          }
        }
      });
      
      // Conditional required fields validation
      const selectedType = formData.insurance_type;
      if (selectedType === 'prescription') {
        if (!formData.bin_number || formData.bin_number.trim() === '') {
          newFieldErrors.bin_number = 'BIN Number is required for prescription insurance';
          hasErrors = true;
        }
        if (!formData.pcn_number || formData.pcn_number.trim() === '') {
          newFieldErrors.pcn_number = 'PCN Number is required for prescription insurance';
          hasErrors = true;
        }
      }
      
      // Date validation
      if (formData.expiration_date && formData.effective_date) {
        const effectiveDate = new Date(formData.effective_date);
        const expirationDate = new Date(formData.expiration_date);
        if (expirationDate <= effectiveDate) {
          newFieldErrors.expiration_date = 'Expiration date must be after effective date';
          hasErrors = true;
        }
      }

      // If there are validation errors, set them and prevent submission
      if (hasErrors) {
        setFieldErrors(newFieldErrors);
        setIsSubmitting(false);
        logger.warn('Insurance form validation failed', {
          fieldErrors: newFieldErrors,
          insurance_type: formData.insurance_type,
        });
        return; // Don't proceed with submission
      }

      // Clear any existing field errors
      setFieldErrors({});

      await onSubmit(e);

      logger.info('Insurance form submission completed', {
        editing: !!editingItem,
        insurance_id: editingItem?.id,
        insurance_type: formData.insurance_type,
      });

      setIsSubmitting(false);
    } catch (error) {
      logger.error('Error in insurance form submission:', error);
      setIsSubmitting(false);
      throw error; // Re-throw to let parent handle UI feedback
    }
  };

  // Filter fields based on insurance type for dynamic rendering
  const getFilteredFields = () => {
    const selectedInsuranceType = formData.insurance_type;
    
    // If no insurance type is selected, show basic fields up to insurance type
    if (!selectedInsuranceType) {
      return fields.filter(field => {
        // Show fields without showFor property and insurance_type field
        return !field.showFor || field.name === 'insurance_type';
      });
    }

    // Filter fields based on showFor property
    return fields.filter(field => {
      // Always show fields without showFor property (universal fields)
      if (!field.showFor) {
        return true;
      }
      
      // Show fields that are specified for the current insurance type
      if (field.showFor.includes(selectedInsuranceType)) {
        return true;
      }
      
      // Hide fields not meant for this insurance type
      return false;
    }).map(field => {
      // Handle conditional required fields
      if (field.requiredFor && field.requiredFor.includes(selectedInsuranceType)) {
        return {
          ...field,
          required: true
        };
      }
      return field;
    });
  };

  // Group fields by section for tabs
  const getFieldsBySection = () => {
    const filteredFields = getFilteredFields();

    const basicFields = filteredFields.filter(f =>
      !f.type || f.type === 'divider' ||  ['insurance_type', 'company_name', 'plan_name', 'employer_group'].includes(f.name)
    );

    const memberFields = filteredFields.filter(f =>
      ['member_name', 'member_id', 'policy_holder_name', 'relationship_to_holder', 'group_number'].includes(f.name)
    );

    const coverageFields = filteredFields.filter(f =>
      ['effective_date', 'expiration_date', 'status', 'is_primary'].includes(f.name) ||
      (f.showFor && !['customer_service_phone', 'preauth_phone', 'provider_services_phone', 'website_url', 'claims_address', 'pharmacy_network_info'].includes(f.name))
    );

    const contactFields = filteredFields.filter(f =>
      ['customer_service_phone', 'preauth_phone', 'provider_services_phone', 'website_url', 'claims_address', 'pharmacy_network_info'].includes(f.name)
    );

    const notesField = filteredFields.filter(f => f.name === 'notes' || f.name === 'tags');

    return { basicFields, memberFields, coverageFields, contactFields, notesField };
  };

  // Render a single field
  const renderField = (field) => {
    if (field.type === 'divider') {
      return null; // Skip dividers in tabbed layout
    }

    // Translate field configuration
    const translatedField = translateField(field, t);

    const commonProps = {
      key: translatedField.name,
      label: translatedField.label,
      placeholder: translatedField.placeholder,
      required: translatedField.required,
      description: translatedField.description,
      value: formData[translatedField.name] || '',
      error: fieldErrors[translatedField.name],
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <TextInput
            {...commonProps}
            onChange={handleTextInputChange(field.name)}
            type={field.type === 'email' ? 'email' : 'text'}
            maxLength={field.maxLength}
          />
        );

      case 'select':
        return (
          <Select
            key={field.name}
            label={translatedField.label}
            placeholder={translatedField.placeholder}
            required={field.required}
            description={translatedField.description}
            value={formData[field.name] || null}
            error={fieldErrors[field.name]}
            data={translatedField.options || []}
            onChange={(value) => {
              // Create a synthetic event for consistency
              onInputChange({ target: { name: field.name, value: value || '' } });
            }}
            searchable={field.searchable}
            clearable={field.clearable}
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'date':
        return (
          <DateInput
            {...commonProps}
            value={parseDateInput(formData[field.name])}
            onChange={(date) => {
              const formattedDate = formatDateInputChange(date);
              onInputChange({ target: { name: field.name, value: formattedDate } });
            }}
            valueFormat="YYYY-MM-DD"
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        );

      case 'number':
        return (
          <NumberInput
            {...commonProps}
            onChange={(value) => onInputChange({ target: { name: field.name, value } })}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={handleTextInputChange(field.name)}
            minRows={field.minRows || 3}
            maxRows={field.maxRows || 6}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            key={field.name}
            label={translatedField.label}
            description={translatedField.description}
            checked={formData[field.name] || false}
            onChange={(e) => onInputChange({ target: { name: field.name, value: e.currentTarget.checked } })}
          />
        );

      case 'custom':
        if (field.component === 'TagInput') {
          return (
            <Box key={field.name}>
              <Text size="sm" fw={500} mb="xs">
                {translatedField.label}
                {field.required && <span style={{ color: 'red' }}> *</span>}
              </Text>
              {translatedField.description && (
                <Text size="xs" c="dimmed" mb="xs">
                  {translatedField.description}
                </Text>
              )}
              <TagInput
                value={formData[field.name] || []}
                onChange={(tags) => {
                  onInputChange({ target: { name: field.name, value: tags } });
                }}
                placeholder={translatedField.placeholder}
                maxTags={field.maxTags}
              />
            </Box>
          );
        }
        return null;

      default:
        return null;
    }
  };

  const { basicFields, memberFields, coverageFields, contactFields, notesField } = getFieldsBySection();

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <FormLoadingOverlay visible={isSubmitting} message={t('insurance.form.saving', 'Saving insurance...')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('insurance.form.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="member" leftSection={<IconUser size={16} />}>
                {t('insurance.form.tabs.member', 'Member')}
              </Tabs.Tab>
              <Tabs.Tab value="coverage" leftSection={<IconShield size={16} />}>
                {t('insurance.form.tabs.coverage', 'Coverage')}
              </Tabs.Tab>
              {contactFields.length > 0 && (
                <Tabs.Tab value="contact" leftSection={<IconPhone size={16} />}>
                  {t('insurance.form.tabs.contact', 'Contact')}
                </Tabs.Tab>
              )}
              {editingItem && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('insurance.form.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconFileText size={16} />}>
                {t('insurance.form.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  {basicFields.map(field => (
                    <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Member Info Tab */}
            <Tabs.Panel value="member">
              <Box mt="md">
                <Grid>
                  {memberFields.map(field => (
                    <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                      {renderField(field)}
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Coverage Tab */}
            <Tabs.Panel value="coverage">
              <Box mt="md">
                <Stack gap="md">
                  <div>
                    <Text fw={600} size="sm" mb="sm">{t('insurance.form.coveragePeriodStatus', 'Coverage Period & Status')}</Text>
                    <Grid>
                      {coverageFields.filter(f => ['effective_date', 'expiration_date', 'status', 'is_primary'].includes(f.name)).map(field => (
                        <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                          {renderField(field)}
                        </Grid.Col>
                      ))}
                    </Grid>
                  </div>

                  {coverageFields.filter(f => !['effective_date', 'expiration_date', 'status', 'is_primary'].includes(f.name)).length > 0 && (
                    <div>
                      <Divider mt="md" mb="md" />
                      <Text fw={600} size="sm" mb="sm">{t('insurance.viewModal.coverageDetails', 'Coverage Details')}</Text>
                      <Grid>
                        {coverageFields.filter(f => !['effective_date', 'expiration_date', 'status', 'is_primary'].includes(f.name)).map(field => (
                          <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                            {renderField(field)}
                          </Grid.Col>
                        ))}
                      </Grid>
                    </div>
                  )}
                </Stack>
              </Box>
            </Tabs.Panel>

            {/* Contact Tab */}
            {contactFields.length > 0 && (
              <Tabs.Panel value="contact">
                <Box mt="md">
                  <Grid>
                    {contactFields.map(field => (
                      <Grid.Col span={{ base: 12, sm: field.gridColumn || 6 }} key={field.name}>
                        {renderField(field)}
                      </Grid.Col>
                    ))}
                  </Grid>
                </Box>
              </Tabs.Panel>
            )}

            {/* Documents Tab */}
            {editingItem && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>{t('insurance.viewModal.attachedDocuments', 'Attached Documents')}</Title>
                    <DocumentManagerWithProgress
                      entityType="insurance"
                      entityId={editingItem.id}
                      mode="edit"
                      onUploadComplete={(success, completedCount, failedCount) => {
                        if (onFileUploadComplete) {
                          onFileUploadComplete(success, completedCount, failedCount);
                        }
                      }}
                      onError={(error) => {
                        logger.error('Document manager error in insurance form:', error);
                      }}
                      showProgressModal={true}
                    />
                  </Stack>
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                {notesField.map(field => renderField(field))}
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Custom children content */}
          {children}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('buttons.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editingItem ? t('insurance.form.updateInsurance', 'Update Insurance') : t('insurance.form.addInsurance', 'Add Insurance')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default InsuranceFormWrapper;