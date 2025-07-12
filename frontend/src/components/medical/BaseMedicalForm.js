import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  Rating,
  Anchor,
  Checkbox,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useFormHandlers } from '../../hooks/useFormHandlers';

/**
 * BaseMedicalForm - Reusable form component for medical data entry
 * 
 * This component abstracts common medical form patterns including:
 * - Modal wrapper with consistent styling
 * - Dynamic field rendering based on configuration
 * - Standardized form handlers and validation
 * - Consistent button layout and styling
 */
const BaseMedicalForm = ({
  // Modal props
  isOpen,
  onClose,
  title,
  
  // Form data and handlers
  formData,
  onInputChange,
  onSubmit,
  
  // Field configuration
  fields = [],
  
  // Dynamic options for select fields
  dynamicOptions = {},
  
  // Form state
  editingItem = null,
  isLoading = false,
  
  // Custom content
  children,
  
  // Button customization
  submitButtonText,
  submitButtonColor,
  
  // Modal customization
  modalSize = "lg",
}) => {
  const { 
    handleTextInputChange, 
    handleSelectChange, 
    handleDateChange, 
    handleNumberChange 
  } = useFormHandlers(onInputChange);

  // Handle Rating onChange (receives value directly)
  const handleRatingChange = (field) => (value) => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle Checkbox onChange
  const handleCheckboxChange = (field) => (event) => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.currentTarget.checked,
        type: 'checkbox',
        checked: event.currentTarget.checked,
      },
    };
    onInputChange(syntheticEvent);
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  // Render individual form field based on configuration
  const renderField = (fieldConfig) => {
    const {
      name,
      type,
      label,
      placeholder,
      required = false,
      description,
      options = [],
      dynamicOptions: dynamicOptionsKey,
      searchable = false,
      clearable = false,
      minRows,
      maxRows,
      maxDate,
      minDate,
      maxLength,
      min,
      max,
      maxDropdownHeight,
    } = fieldConfig;

    // Get dynamic options if specified
    const selectOptions = dynamicOptionsKey 
      ? dynamicOptions[dynamicOptionsKey] || []
      : options;

    // Base field props
    const baseProps = {
      label,
      placeholder,
      description,
      required,
      withAsterisk: required,
      value: formData[name] || '',
      maxLength,
    };

    switch (type) {
      case 'text':
      case 'email':
        return (
          <TextInput
            {...baseProps}
            onChange={handleTextInputChange(name)}
            type={type === 'email' ? 'email' : 'text'}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...baseProps}
            onChange={handleTextInputChange(name)}
            minRows={minRows}
            maxRows={maxRows}
          />
        );

      case 'select':
        return (
          <Select
            {...baseProps}
            data={selectOptions}
            onChange={handleSelectChange(name)}
            searchable={searchable}
            clearable={clearable}
            maxDropdownHeight={maxDropdownHeight}
          />
        );

      case 'number':
        return (
          <NumberInput
            {...baseProps}
            onChange={handleNumberChange(name)}
            value={formData[name] ? Number(formData[name]) : ''}
            min={min}
            max={max}
          />
        );

      case 'date':
        // Handle dynamic minDate for end_date based on onset_date
        const dynamicMinDate = name === 'end_date' && formData.onset_date 
          ? new Date(formData.onset_date) 
          : minDate;
          
        return (
          <DateInput
            {...baseProps}
            value={formData[name] ? new Date(formData[name]) : null}
            onChange={handleDateChange(name)}
            firstDayOfWeek={0}
            clearable
            maxDate={maxDate}
            minDate={dynamicMinDate}
          />
        );

      case 'rating':
        return (
          <div>
            <Text size="sm" fw={500} style={{ marginBottom: '8px' }}>
              {label}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Rating
                value={formData[name] ? parseFloat(formData[name]) : 0}
                onChange={handleRatingChange(name)}
                fractions={2}
                size="lg"
              />
              <Text size="sm" c="dimmed">
                {formData[name] ? `${formData[name]}/5 stars` : 'No rating'}
              </Text>
            </div>
            {description && (
              <Text size="xs" c="dimmed" style={{ marginTop: '4px' }}>
                {description}
              </Text>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <Checkbox
            label={label}
            description={description}
            checked={!!formData[name]}
            onChange={handleCheckboxChange(name)}
          />
        );

      case 'divider':
        return (
          <div style={{ width: '100%' }}>
            <Divider my="md" />
            {label && (
              <Text size="sm" fw={600} mb="sm">
                {label}
              </Text>
            )}
          </div>
        );

      default:
        console.warn(`Unknown field type: ${type} for field: ${name}`);
        return null;
    }
  };

  // Group fields by row based on gridColumn values
  const groupFieldsIntoRows = (fields) => {
    const rows = [];
    let currentRow = [];
    let currentRowSpan = 0;

    fields.forEach((field) => {
      const span = field.gridColumn || 12;
      
      // If adding this field would exceed 12 columns, start a new row
      if (currentRowSpan + span > 12) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [field];
        currentRowSpan = span;
      } else {
        currentRow.push(field);
        currentRowSpan += span;
      }
    });

    // Add the last row if it has fields
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  };

  const fieldRows = groupFieldsIntoRows(fields);

  // Determine submit button text
  const getSubmitButtonText = () => {
    if (submitButtonText) return submitButtonText;
    
    const entityName = title.replace('Add ', '').replace('Edit ', '');
    return editingItem ? `Update ${entityName}` : `Add ${entityName}`;
  };

  // Determine submit button color based on form data
  const getSubmitButtonColor = () => {
    if (submitButtonColor) return submitButtonColor;
    
    // Special case for allergy severity
    if (formData.severity === 'life-threatening') {
      return 'red';
    }
    
    return undefined;
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size={modalSize}
      centered
      styles={{
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Render form fields */}
          {fieldRows.map((row, rowIndex) => (
            <Grid key={rowIndex}>
              {row.map((field) => (
                <Grid.Col key={field.name} span={field.gridColumn || 12}>
                  {renderField(field)}
                </Grid.Col>
              ))}
            </Grid>
          ))}

          {/* Custom content section */}
          {children}

          {/* Form action buttons */}
          <Group justify="flex-end" mt="lg" mb="sm">
            <Button
              variant="subtle"
              onClick={onClose}
              disabled={isLoading}
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="filled"
              color={getSubmitButtonColor()}
              loading={isLoading}
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getSubmitButtonText()}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default BaseMedicalForm;