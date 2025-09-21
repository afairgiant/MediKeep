import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  TextInput,
  Select,
  Autocomplete,
  Combobox,
  InputBase,
  useCombobox,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  Rating,
  Checkbox,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { ResponsiveModal } from '../adapters';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { MedicalFormLayoutStrategy } from '../../strategies/MedicalFormLayoutStrategy';
import { TagInput } from '../common/TagInput';
import logger from '../../services/logger';

// Initialize medical form layout strategy
const medicalFormStrategy = new MedicalFormLayoutStrategy();

/**
 * BaseMedicalForm - Reusable form component for medical data entry
 * 
 * This component abstracts common medical form patterns including:
 * - Modal wrapper with consistent styling
 * - Dynamic field rendering based on configuration
 * - Standardized form handlers and validation
 * - Consistent button layout and styling
 * - Responsive layout with medical form optimizations
 * - Breakpoint-aware column spans and spacing
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
  
  // Loading states for dynamic options
  loadingStates = {},

  // Form state
  editingItem = null,
  isLoading = false,
  
  // Custom content
  children,
  
  // Field errors
  fieldErrors = {},
  
  // Button customization
  submitButtonText,
  submitButtonColor,
  
  // Modal customization
  modalSize = "lg",
  
  // Form type for responsive optimization
  formType = 'standard',
  
  // Responsive props (injected by withResponsive)
  responsive,
}) => {

  // Get responsive state if not provided by HOC
  const responsiveFromHook = useResponsive();
  const responsiveState = responsive || responsiveFromHook;
  
  const { 
    handleTextInputChange, 
    handleSelectChange, 
    handleDateChange, 
    handleNumberChange 
  } = useFormHandlers(onInputChange);
  
  // Calculate responsive layout configuration
  const layoutConfig = useMemo(() => {
    const context = {
      fieldCount: fields.length,
      formType,
      complexity: fields.length > 10 ? 'high' : fields.length > 5 ? 'medium' : 'low',
      medical: true
    };
    
    return medicalFormStrategy.getLayoutConfig(responsiveState.breakpoint, context);
  }, [fields.length, formType, responsiveState.breakpoint]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleRatingChange = useCallback((field) => (value) => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  }, [onInputChange]);

  const handleCheckboxChange = useCallback((field) => (event) => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.currentTarget.checked,
        type: 'checkbox',
        checked: event.currentTarget.checked,
      },
    };
    onInputChange(syntheticEvent);
  }, [onInputChange]);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    onSubmit(e);
  }, [onSubmit]);

  // Standard dropdown height
  const getDropdownHeight = useCallback((providedHeight) => {
    return providedHeight || 280;
  }, []);

  // Split renderField into smaller, focused callbacks for better performance
  
  // Callback for text-based input fields
  const renderTextInputField = useCallback((fieldConfig, baseProps) => {
    const { type, name, minLength } = fieldConfig;
    return (
      <TextInput
        {...baseProps}
        onChange={handleTextInputChange(name)}
        type={type === 'email' ? 'email' : type === 'tel' ? 'text' : type === 'url' ? 'url' : 'text'}
        inputMode={type === 'tel' ? 'tel' : undefined}
        minLength={minLength}
      />
    );
  }, [handleTextInputChange]);

  // Callback for textarea fields
  const renderTextareaField = useCallback((fieldConfig, baseProps) => {
    const { name, minRows, maxRows } = fieldConfig;
    return (
      <Textarea
        {...baseProps}
        onChange={handleTextInputChange(name)}
        minRows={minRows}
        maxRows={maxRows}
      />
    );
  }, [handleTextInputChange]);

  // Callback for select fields
  const renderSelectField = useCallback((fieldConfig, baseProps, selectOptions, isFieldLoading) => {
    const { name, dynamicOptions: dynamicOptionsKey, searchable, clearable, maxDropdownHeight } = fieldConfig;
    
    const dropdownHeight = maxDropdownHeight || getDropdownHeight();
    const itemLimit = selectOptions.length > 100 ? 50 : undefined;
    
    return (
      <Select
        {...baseProps}
        data={selectOptions}
        onChange={handleSelectChange(name)}
        searchable={searchable}
        clearable={clearable}
        maxDropdownHeight={dropdownHeight}
        disabled={isFieldLoading}
        placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : baseProps.placeholder}
        limit={itemLimit}
        withinPortal
      />
    );
  }, [handleSelectChange, getDropdownHeight]);

  // Callback for number input fields
  const renderNumberField = useCallback((fieldConfig, baseProps) => {
    const { name, min, max } = fieldConfig;
    return (
      <NumberInput
        {...baseProps}
        onChange={handleNumberChange(name)}
        value={formData[name] !== undefined && formData[name] !== null && formData[name] !== '' ? Number(formData[name]) : ''}
        min={min}
        max={max}
      />
    );
  }, [handleNumberChange, formData]);

  // Callback for date input fields
  const renderDateField = useCallback((fieldConfig, baseProps) => {
    const { name, maxDate, minDate } = fieldConfig;
    // Parse date value with error handling
    let dateValue = null;
    if (formData[name]) {
      try {
        if (typeof formData[name] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData[name].trim())) {
          const [year, month, day] = formData[name].trim().split('-').map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            dateValue = new Date(year, month - 1, day);
          }
        } else {
          dateValue = new Date(formData[name]);
        }
        if (isNaN(dateValue.getTime())) {
          dateValue = null;
        }
      } catch (error) {
        logger.error(`Error parsing date for field ${name}:`, error);
        dateValue = null;
      }
    }

    // Calculate dynamic min/max dates  
    let dynamicMinDate = minDate;
    let dynamicMaxDate = typeof maxDate === 'function' ? maxDate() : maxDate;
    
    // Handle dynamic minDate for end date fields
    try {
      if (name === 'end_date' && formData.onset_date) {
        dynamicMinDate = new Date(formData.onset_date);
      } else if (name === 'end_date' && formData.start_date) {
        dynamicMinDate = new Date(formData.start_date);
      } else {
        // Generic pattern: derive start field name from end field name
        let startFieldName = null;
        if (name.endsWith('_end_date')) {
          startFieldName = name.substring(0, name.length - '_end_date'.length) + '_start_date';
        } else if (name.endsWith('_end') && name.includes('date')) {
          startFieldName = name.substring(0, name.length - '_end'.length) + '_start';
        } else if (name.includes('end_date')) {
          startFieldName = name.replace(/end_date/g, 'start_date');
        } else if (name.includes('_end_') && name.includes('date')) {
          startFieldName = name.replace(/_end_/g, '_start_');
        }
        
        if (startFieldName && formData[startFieldName]) {
          const tempDate = new Date(formData[startFieldName]);
          if (!isNaN(tempDate.getTime())) {
            dynamicMinDate = tempDate;
          }
        }
      }
    } catch (error) {
      logger.error(`Error calculating dynamic min date:`, error);
    }

    return (
      <DateInput
        {...baseProps}
        value={dateValue}
        onChange={handleDateChange(name)}
        firstDayOfWeek={0}
        clearable
        maxDate={dynamicMaxDate}
        minDate={dynamicMinDate}
      />
    );
  }, [handleDateChange, formData]);

  // Main renderField function now uses smaller callbacks - much simpler with fewer dependencies
  const renderField = useCallback((fieldConfig) => {
    const {
      name,
      type,
      dynamicOptions: dynamicOptionsKey,
      options = [],
      label,
      placeholder,
      description,
      required = false,
      maxLength,
      minLength,
    } = fieldConfig;

    // Get dynamic options if specified
    const selectOptions = dynamicOptionsKey 
      ? dynamicOptions[dynamicOptionsKey] || []
      : options;
     
    // Check if this dynamic option is loading
    const isFieldLoading = dynamicOptionsKey && loadingStates[dynamicOptionsKey];

    // Base field props
    const baseProps = {
      label,
      placeholder,
      description,
      required,
      withAsterisk: required,
      value: formData[name] || '',
      maxLength,
      minLength,
      error: fieldErrors[name] || null,
    };

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return renderTextInputField(fieldConfig, baseProps);

      case 'textarea':
        return renderTextareaField(fieldConfig, baseProps);

      case 'select':
        return renderSelectField(fieldConfig, baseProps, selectOptions, isFieldLoading);

      case 'number':
        return renderNumberField(fieldConfig, baseProps);

      case 'date':
        return renderDateField(fieldConfig, baseProps);

      case 'autocomplete':
        // Convert options to simple string array for Autocomplete
        const autocompleteOptions = selectOptions.map(option => 
          typeof option === 'object' ? option.value : option
        );
        
        return (
          <Autocomplete
            {...baseProps}
            data={autocompleteOptions}
            onChange={(value) => {
              // Call the form's input change handler
              onInputChange({ target: { name, value } });
            }}
            value={formData[name] || ''}
            maxDropdownHeight={getDropdownHeight()}
            disabled={isFieldLoading}
            placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : placeholder}
            limit={50}
            withinPortal
          />
        );

      case 'combobox':
        // Enhanced combobox for specialty selection with custom input capability
        const ComboboxField = () => {
          const combobox = useCombobox({
            onDropdownClose: () => combobox.resetSelectedOption(),
          });

          const [search, setSearch] = useState(formData[name] || '');
          const [value, setValue] = useState(formData[name] || '');
          
          // Sync local state when formData changes
          useEffect(() => {
            const currentValue = formData[name] || '';
            setValue(currentValue);
            
            // Find if it's a known option to display the label instead of value
            const option = selectOptions.find(opt => opt.value === currentValue);
            if (option && option.label) {
              setSearch(option.label);
            } else {
              setSearch(currentValue);
            }
          }, [formData[name], name])

          // Option filtering
          const exactOptionMatch = selectOptions.find(
            (item) => item.value === search || item.label === search
          );
          
          const filteredOptions = exactOptionMatch
            ? selectOptions
            : selectOptions.filter((item) =>
                (item.label || item.value).toLowerCase().includes(search.toLowerCase().trim())
              ).slice(0, 50);

          const options = filteredOptions.map((item) => (
            <Combobox.Option value={item.value} key={item.value}>
              {item.label || item.value}
            </Combobox.Option>
          ));

          return (
            <Combobox
              store={combobox}
              withinPortal
              position="bottom-start"
              onOptionSubmit={(val) => {
                if (val === '$create') {
                  setValue(search);
                  onInputChange({ target: { name, value: search } });
                  
                  // If this is the specialty field, add it to the cache for future use
                  if (name === 'specialty') {
                    // Dynamically import to avoid circular dependencies
                    import('../../config/medicalSpecialties').then(({ addSpecialtyToCache, clearSpecialtiesCache }) => {
                      addSpecialtyToCache(search);
                      // Also clear cache to force fresh load next time
                      clearSpecialtiesCache();
                    });
                  }
                } else {
                  const selectedOption = selectOptions.find(item => item.value === val);
                  const displayValue = selectedOption ? selectedOption.label || selectedOption.value : val;
                  setValue(displayValue);
                  setSearch(displayValue);
                  onInputChange({ target: { name, value: val } });
                }
                combobox.closeDropdown();
              }}
            >
              <Combobox.Target>
                <InputBase
                  {...baseProps}
                  rightSection={<Combobox.Chevron />}
                  value={search}
                  onChange={(event) => {
                    combobox.openDropdown();
                    combobox.updateSelectedOptionIndex();
                    setSearch(event.currentTarget.value);
                  }}
                  onClick={() => combobox.openDropdown()}
                  onFocus={() => combobox.openDropdown()}
                  onBlur={() => {
                    combobox.closeDropdown();
                    setSearch(value || '');
                  }}
                  placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : placeholder}
                  rightSectionPointerEvents="none"
                  disabled={isFieldLoading}
                />
              </Combobox.Target>

              <Combobox.Dropdown>
                <Combobox.Options 
                  style={{ 
                    maxHeight: `${getDropdownHeight()}px`, 
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}
                >
                  {search.trim() && !exactOptionMatch && (
                    <Combobox.Option value="$create" style={{ fontWeight: 'bold', borderBottom: '1px solid #e9ecef' }}>
                      + Add "{search}"
                    </Combobox.Option>
                  )}
                  {options}
                </Combobox.Options>
              </Combobox.Dropdown>
            </Combobox>
          );
        };

        return <ComboboxField />;

      case 'number':
        return renderNumberField(fieldConfig, baseProps);

      case 'date':
        return renderDateField(fieldConfig, baseProps);

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

      case 'custom':
        // Handle custom components
        if (fieldConfig.component === 'TagInput') {
          return (
            <TagInput
              value={formData[name] || []}
              onChange={(tags) => onInputChange({ target: { name, value: tags } })}
              placeholder={placeholder}
              maxTags={fieldConfig.maxTags || 15}
              disabled={false}
              error={fieldErrors[name]}
            />
          );
        }
        logger.warn(`Unknown custom component: ${fieldConfig.component} for field: ${name}`);
        return null;

      default:
        logger.warn(`Unknown field type: ${type} for field: ${name}`);
        return null;
    }
  }, [formData, dynamicOptions, loadingStates, fieldErrors, renderTextInputField, renderTextareaField, renderSelectField, renderNumberField, renderDateField, handleRatingChange, handleCheckboxChange, onInputChange]);

  // Group fields by row based on responsive column configuration
  const groupFieldsIntoRows = useCallback((fields) => {
    const totalColumns = layoutConfig.columns;
    const rows = [];
    let currentRow = [];
    let currentRowSpan = 0;

    fields.forEach((field) => {
      // Calculate responsive span based on field type and available columns
      const span = medicalFormStrategy.getFieldSpan(field, totalColumns);
      
      // If adding this field would exceed total columns, start a new row
      if (currentRowSpan + span > totalColumns) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [{ ...field, calculatedSpan: span }];
        currentRowSpan = span;
      } else {
        currentRow.push({ ...field, calculatedSpan: span });
        currentRowSpan += span;
      }
    });

    // Add the last row if it has fields
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    logger.debug('medical_form_field_grouping', 'Medical form fields grouped into rows', {
      component: 'BaseMedicalForm',
      breakpoint: responsiveState.breakpoint,
      totalColumns: totalColumns,
      fieldCount: fields.length,
      rowCount: rows.length
    });

    return rows;
  }, [layoutConfig.columns, responsiveState.breakpoint]);

  // Memoize field rows
  const fieldRows = useMemo(() => groupFieldsIntoRows(fields), [fields, groupFieldsIntoRows]);

  // Memoize submit button text to prevent recalculation
  const submitText = useMemo(() => {
    if (submitButtonText) return submitButtonText;
    
    const entityName = title.replace('Add ', '').replace('Edit ', '');
    return editingItem ? `Update ${entityName}` : `Add ${entityName}`;
  }, [submitButtonText, title, editingItem]);

  // Memoize submit button color based on form data
  const submitColor = useMemo(() => {
    if (submitButtonColor) return submitButtonColor;
    
    // Special case for allergy severity
    if (formData?.severity === 'life-threatening') {
      return 'red';
    }
    
    return undefined;
  }, [submitButtonColor, formData?.severity]);

  // Calculate responsive modal size
  const modalSizeValue = useMemo(() => {
    const context = {
      fieldCount: fields.length,
      complexity: fields.length > 10 ? 'high' : 'medium',
      formType
    };
    
    const responsiveSize = medicalFormStrategy.getModalSize(responsiveState.breakpoint, context);
    
    // Use explicit modalSize if provided, otherwise use responsive calculation
    return modalSize !== "lg" ? modalSize : responsiveSize;
  }, [modalSize, fields.length, formType, responsiveState.breakpoint]);

  return (
    <ResponsiveModal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size={modalSizeValue}
      centered
      styles={useMemo(() => ({
        body: { 
          padding: layoutConfig.container.padding || '1.5rem', 
          paddingBottom: '2rem'
        },
        header: { 
          paddingBottom: '1rem'
        }
      }), [layoutConfig.container.padding])}
      overflow="inside"
      withinPortal
      lockScroll
      closeOnClickOutside
      trapFocus
      returnFocus
      keepMounted={false}
      breakpoint={responsiveState.breakpoint}
      deviceType={responsiveState.deviceType}
    >
      <form 
        onSubmit={handleSubmit}
      >
        <Stack spacing={layoutConfig.spacing}>
          {/* Render form fields */}
          {fieldRows.map((row, rowIndex) => (
            <Grid key={rowIndex} columns={layoutConfig.columns}>
              {row.map((field) => (
                <Grid.Col key={field.name} span={field.calculatedSpan || field.gridColumn || Math.floor(layoutConfig.columns / row.length)}>
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
              color={submitColor}
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
              {submitText}
            </Button>
          </Group>
        </Stack>
      </form>
    </ResponsiveModal>
  );
};

// Wrap component with React.memo and custom comparison function
const MemoizedBaseMedicalForm = memo(BaseMedicalForm, (prevProps, nextProps) => {
  // Custom comparison function for React.memo to prevent excessive re-renders
  
  // Check primitive props
  const primitiveProps = ['isOpen', 'title', 'isLoading', 'modalSize', 'submitButtonText', 'submitButtonColor'];
  for (const prop of primitiveProps) {
    if (prevProps[prop] !== nextProps[prop]) {
      return false;
    }
  }
  
  // Check object/array props with shallow comparison
  if (prevProps.formData !== nextProps.formData) {
    return false;
  }
  
  if (prevProps.editingItem !== nextProps.editingItem) {
    return false;
  }
  
  // Check fields array (should be stable)
  if (prevProps.fields !== nextProps.fields || prevProps.fields?.length !== nextProps.fields?.length) {
    return false;
  }
  
  // Check dynamicOptions object (should be stable from parent)
  if (prevProps.dynamicOptions !== nextProps.dynamicOptions) {
    return false;
  }
  
  // Check loadingStates object
  if (prevProps.loadingStates !== nextProps.loadingStates) {
    return false;
  }
  
  // Check fieldErrors object  
  if (prevProps.fieldErrors !== nextProps.fieldErrors) {
    return false;
  }
  
  // Function props should be stable from parent useCallback
  const functionProps = ['onClose', 'onInputChange', 'onSubmit'];
  for (const prop of functionProps) {
    if (prevProps[prop] !== nextProps[prop]) {
      return false;
    }
  }
  
  return true; // Props are equal, skip re-render
});

// Set display name for better debugging
MemoizedBaseMedicalForm.displayName = 'BaseMedicalForm';

// Wrap with responsive HOC for enhanced responsive capabilities
const ResponsiveMedicalForm = withResponsive(MemoizedBaseMedicalForm, {
  injectResponsive: true,
  displayName: 'ResponsiveMedicalForm'
});

export default ResponsiveMedicalForm;