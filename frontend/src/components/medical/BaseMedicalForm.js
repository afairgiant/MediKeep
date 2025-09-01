import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  Modal,
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
import { useWindowDimensions } from '../../hooks/useWindowDimensions';
import logger from '../../services/logger';

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
}) => {
  // Debug: Track render cycles
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  // Log renders in development - useEffect must be called unconditionally
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      renderCount.current++;
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime.current;
      lastRenderTime.current = now;
      
      // Only log every 10th render to reduce noise
      if (renderCount.current % 10 === 0 || timeSinceLastRender < 50) {
        logger.debug('BaseMedicalForm render', {
          component: 'BaseMedicalForm',
          renderCount: renderCount.current,
          timeSinceLastRender,
          isOpen,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          fieldsCount: fields.length,
          formDataKeys: Object.keys(formData || {}).length
        });
      }
      
      // Warn if rendering too frequently
      if (timeSinceLastRender < 50 && renderCount.current > 10) {
        logger.warn('Rapid re-rendering detected in BaseMedicalForm', {
          component: 'BaseMedicalForm',
          renderCount: renderCount.current,
          timeSinceLastRender
        });
      }
    }
  });
  
  // Set up performance observer to detect long tasks
  useEffect(() => {
    if (!isOpen || typeof PerformanceObserver === 'undefined') return;
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          logger.warn('Long task detected in BaseMedicalForm', {
            component: 'BaseMedicalForm',
            taskDuration: entry.duration,
            taskName: entry.name,
            windowHeight: window.innerHeight
          });
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      logger.debug('PerformanceObserver not supported for longtask', {
        component: 'BaseMedicalForm'
      });
    }
    
    return () => observer.disconnect();
  }, [isOpen]);

  // Add passive event listeners for better scroll performance
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e) => {
      // Allow default wheel behavior but mark as passive for better performance
      // This prevents the 215ms delay mentioned in the logs
    };

    const modalElement = document.querySelector('[data-mantine-modal]');
    if (modalElement) {
      modalElement.addEventListener('wheel', handleWheel, { passive: true });
      modalElement.addEventListener('touchmove', handleWheel, { passive: true });
      
      return () => {
        modalElement.removeEventListener('wheel', handleWheel);
        modalElement.removeEventListener('touchmove', handleWheel);
      };
    }
  }, [isOpen]);
  // Get responsive window dimensions with debounced updates
  const { isSmallScreen, isMobileWidth, isTabletWidth } = useWindowDimensions(150);

  const { 
    handleTextInputChange, 
    handleSelectChange, 
    handleDateChange, 
    handleNumberChange 
  } = useFormHandlers(onInputChange);

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

  // Memoized dropdown height to avoid recalculation on every render
  const getResponsiveDropdownHeight = useCallback((providedHeight) => {
    return providedHeight || (isSmallScreen ? 200 : 280); // Responsive but fixed heights
  }, [isSmallScreen]);

  // Memoize the render field function with stable dependencies
  const renderField = useCallback((fieldConfig) => {
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
      error: fieldErrors[name] || null,
    };

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <TextInput
            {...baseProps}
            onChange={handleTextInputChange(name)}
            type={type === 'email' ? 'email' : type === 'tel' ? 'text' : type === 'url' ? 'url' : 'text'}
            inputMode={type === 'tel' ? 'tel' : undefined}
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
        // Use inline responsive height to avoid function call
        const responsiveMaxHeight = maxDropdownHeight || (isSmallScreen ? 200 : 280);
        
        return (
          <Select
            {...baseProps}
            data={selectOptions}
            onChange={handleSelectChange(name)}
            searchable={searchable && !isSmallScreen} // Use cached screen size
            clearable={clearable}
            maxDropdownHeight={responsiveMaxHeight}
            disabled={isFieldLoading}
            placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : placeholder}
            limit={isSmallScreen ? 20 : selectOptions.length > 100 ? 50 : undefined}
            withScrollArea={selectOptions.length > 20} // Enable virtualization for large lists
          />
        );

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
            maxDropdownHeight={200}
            disabled={isFieldLoading}
            placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : placeholder}
            limit={50}
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
          
          // Sync local state when formData changes (e.g., when editing different records)
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
          }, [formData, name]); // Re-run when formData or name changes

          const exactOptionMatch = selectOptions.find(
            (item) => item.value === search || item.label === search
          );

          const filteredOptions = exactOptionMatch
            ? selectOptions
            : selectOptions.filter((item) =>
                (item.label || item.value).toLowerCase().includes(search.toLowerCase().trim())
              );

          const options = filteredOptions.map((item) => (
            <Combobox.Option value={item.value} key={item.value}>
              {item.label || item.value}
            </Combobox.Option>
          ));

          return (
            <Combobox
              store={combobox}
              withinPortal={true}
              position="bottom-start"
              middlewares={{ flip: true, shift: true }}
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
                    maxHeight: '200px', 
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
        return (
          <NumberInput
            {...baseProps}
            onChange={handleNumberChange(name)}

            value={formData[name] !== undefined && formData[name] !== null && formData[name] !== '' ? Number(formData[name]) : ''}

            min={min}
            max={max}
          />
        );

      case 'date':
        // Parse date value with error handling
        let dateValue = null;
        if (formData[name]) {
          try {
            if (typeof formData[name] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData[name].trim())) {
              const [year, month, day] = formData[name].trim().split('-').map(Number);
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                dateValue = new Date(year, month - 1, day); // month is 0-indexed
              }
            } else {
              dateValue = new Date(formData[name]);
            }
            // Validate the date
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
        
        // Handle dynamic minDate for any end date field based on corresponding start date
        try {
          if (name === 'end_date' && formData.onset_date) {
            dynamicMinDate = new Date(formData.onset_date);
          } else if (name === 'end_date' && formData.start_date) {
            dynamicMinDate = new Date(formData.start_date);
          } else {
            // Generic pattern: derive start field name from end field name
            let startFieldName = null;
            
            // Pattern 1: ends with '_end_date' -> replace with '_start_date'
            if (name.endsWith('_end_date')) {
              startFieldName = name.substring(0, name.length - '_end_date'.length) + '_start_date';
            }
            // Pattern 2: ends with '_end' -> replace with '_start'  
            else if (name.endsWith('_end') && name.includes('date')) {
              startFieldName = name.substring(0, name.length - '_end'.length) + '_start';
            }
            // Pattern 3: contains 'end_date' -> replace with 'start_date'
            else if (name.includes('end_date')) {
              startFieldName = name.replace(/end_date/g, 'start_date');
            }
            // Pattern 4: for fields like 'completion_end_date' -> 'completion_start_date'
            else if (name.includes('_end_') && name.includes('date')) {
              startFieldName = name.replace(/_end_/g, '_start_');
            }
            
            // Apply the derived start field if it exists in formData
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
        
        // Handle dynamic maxDate - use current date if maxDate is a function
        let dynamicMaxDate = maxDate;
        try {
          dynamicMaxDate = typeof maxDate === 'function' ? maxDate() : maxDate;
        } catch (error) {
          logger.error(`Error calculating dynamic max date:`, error);
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
        logger.warn(`Unknown field type: ${type} for field: ${name}`);
        return null;
    }
  }, [formData, dynamicOptions, loadingStates, fieldErrors, handleTextInputChange, handleSelectChange, handleDateChange, handleNumberChange, handleRatingChange, handleCheckboxChange, onInputChange, isSmallScreen]);

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

  // Memoize field rows to prevent recalculation on every render
  const fieldRows = useMemo(() => groupFieldsIntoRows(fields), [fields]);

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

  // Memoized responsive modal size using cached window dimensions
  const responsiveModalSize = useMemo(() => {
    if (typeof modalSize === 'string') {
      // Override modal size on small screens to prevent overflow
      if (isMobileWidth) {
        return 'sm'; // Force smaller modal on mobile
      } else if (isTabletWidth) {
        return modalSize === 'xl' ? 'lg' : modalSize; // Cap at 'lg' on tablets/small laptops
      }
    }
    return modalSize;
  }, [modalSize, isMobileWidth, isTabletWidth]);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size={responsiveModalSize}
      centered
      styles={useMemo(() => ({
        body: { 
          padding: isMobileWidth ? '1rem' : '1.5rem', 
          paddingBottom: isMobileWidth ? '1.5rem' : '2rem' 
        },
        header: { paddingBottom: '1rem' },
      }), [isMobileWidth])}
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
    </Modal>
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

export default MemoizedBaseMedicalForm;