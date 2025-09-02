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
import { useDropdownScrollOptimization } from '../../hooks/useScrollThrottle';
import logger from '../../services/logger';
import performanceMonitor from '../../services/performanceMonitor';

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
  // Debug: Track render cycles and performance
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const emergencyModeRef = useRef(false);
  const measureRenderRef = useRef(null);
  
  // Register for emergency mode from performance monitor
  useEffect(() => {
    const unsubscribe = performanceMonitor.onEmergency((reason) => {
      logger.error('Form entering emergency mode', {
        component: 'BaseMedicalForm',
        reason
      });
      emergencyModeRef.current = true;
      // Force close after delay to prevent freeze
      setTimeout(() => {
        if (isOpen && emergencyModeRef.current) {
          onClose();
        }
      }, 500);
    });
    return unsubscribe;
  }, [isOpen, onClose]);
  
  // Performance monitoring and emergency fallback
  useEffect(() => {
    // Measure render performance
    if (measureRenderRef.current) {
      const duration = measureRenderRef.current();
      if (duration && duration > 100) {
        logger.warn('Slow render detected', {
          component: 'BaseMedicalForm',
          duration,
          performanceLevel: performance?.performanceLevel
        });
      }
    }
    measureRenderRef.current = performanceMonitor.startMeasure('BaseMedicalForm');
    
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    // Detect render loops and emergency situations
    if (timeSinceLastRender < 16 && renderCount.current > 50) {
      if (!emergencyModeRef.current) {
        emergencyModeRef.current = true;
        logger.error('Render loop detected, entering emergency mode', {
          component: 'BaseMedicalForm',
          renderCount: renderCount.current,
          timeSinceLastRender
        });
        performanceMonitor.triggerEmergencyMode({ renderLoop: true, renderCount: renderCount.current });
      }
    }
    
    // Development logging
    if (process.env.NODE_ENV === 'development') {
      if (renderCount.current % 10 === 0 || timeSinceLastRender < 50) {
        logger.debug('BaseMedicalForm render', {
          component: 'BaseMedicalForm',
          renderCount: renderCount.current,
          timeSinceLastRender,
          isOpen,
          performanceLevel: performance?.performanceLevel,
          fieldsCount: fields.length
        });
      }
    }
    
    // Reset on modal close
    if (!isOpen) {
      emergencyModeRef.current = false;
      renderCount.current = 0;
      if (measureRenderRef.current) {
        measureRenderRef.current();
        measureRenderRef.current = null;
      }
    }
    
    return () => {
      if (measureRenderRef.current) {
        measureRenderRef.current();
      }
    };
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

  // Optimize dropdown scroll performance for constrained viewports
  const dropdownRef = useDropdownScrollOptimization(isOpen, performance?.isConstrainedViewport);
  
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
  // Get responsive window dimensions with performance mode detection
  const windowDimensions = useWindowDimensions(150);
  const { 
    isSmallScreen, 
    isMobileWidth, 
    isTabletWidth,
    performance,
    accessibility,
    shouldReduceAnimations,
    shouldSimplifyLayout,
    shouldLimitDropdownItems,
    getMaxDropdownHeight,
    getModalSize,
    getDebounceDelay
  } = windowDimensions;
  
  // Log performance mode on mount and changes
  useEffect(() => {
    if (isOpen && performance) {
      logger.info('Form opened with performance mode', {
        component: 'BaseMedicalForm',
        performanceLevel: performance.performanceLevel,
        isConstrainedViewport: performance.isConstrainedViewport,
        isAccessibilityMode: accessibility?.isAccessibilityMode,
        fontSize: accessibility?.fontSize,
        features: performance.features
      });
    }
  }, [isOpen, performance?.performanceLevel]);

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

  // Use performance-aware dropdown height
  const getResponsiveDropdownHeight = useCallback((providedHeight) => {
    if (providedHeight) return providedHeight;
    // Use the performance-aware helper
    return getMaxDropdownHeight ? getMaxDropdownHeight() : 280;
  }, [getMaxDropdownHeight]);

  // Split renderField into smaller, focused callbacks for better performance
  
  // Callback for text-based input fields
  const renderTextInputField = useCallback((fieldConfig, baseProps) => {
    const { type, name } = fieldConfig;
    return (
      <TextInput
        {...baseProps}
        onChange={handleTextInputChange(name)}
        type={type === 'email' ? 'email' : type === 'tel' ? 'text' : type === 'url' ? 'url' : 'text'}
        inputMode={type === 'tel' ? 'tel' : undefined}
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

  // Callback for select fields with performance optimizations
  const renderSelectField = useCallback((fieldConfig, baseProps, selectOptions, isFieldLoading) => {
    const { name, dynamicOptions: dynamicOptionsKey, searchable, clearable, maxDropdownHeight } = fieldConfig;
    
    // Performance-based configuration
    const isSearchable = searchable && 
      performance?.features?.dropdownSearch !== false && 
      !isSmallScreen;
    
    const dropdownHeight = maxDropdownHeight || getResponsiveDropdownHeight();
    
    // Aggressive limiting for constrained viewports
    let itemLimit;
    if (performance?.performanceLevel === 'minimal') {
      itemLimit = 10;
    } else if (performance?.performanceLevel === 'reduced' || shouldLimitDropdownItems?.()) {
      itemLimit = 20;
    } else if (selectOptions.length > 100) {
      itemLimit = 50;
    }
    
    return (
      <Select
        {...baseProps}
        data={selectOptions}
        onChange={handleSelectChange(name)}
        searchable={isSearchable}
        clearable={clearable}
        maxDropdownHeight={dropdownHeight}
        disabled={isFieldLoading}
        placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : baseProps.placeholder}
        limit={itemLimit}
        withinPortal={performance?.performanceLevel !== 'minimal' && !performance?.isConstrainedViewport}
        isInScrollableContainer={performance?.isConstrainedViewport}
        transitionProps={shouldReduceAnimations?.() ? { duration: 0 } : undefined}
      />
    );
  }, [handleSelectChange, isSmallScreen, performance, getResponsiveDropdownHeight, shouldLimitDropdownItems, shouldReduceAnimations]);

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
            maxDropdownHeight={getMaxDropdownHeight ? getMaxDropdownHeight() : 200}
            disabled={isFieldLoading || performance?.features?.autoComplete === false}
            placeholder={isFieldLoading ? `Loading ${dynamicOptionsKey}...` : placeholder}
            limit={performance?.performanceLevel === 'minimal' ? 10 : 50}
            withinPortal={performance?.performanceLevel !== 'minimal'}
            transitionProps={shouldReduceAnimations?.() ? { duration: 0 } : undefined}
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
          
          // Sync local state when formData changes with performance guard
          useEffect(() => {
            // Skip effect in emergency mode
            if (emergencyModeRef.current) return;
            
            const currentValue = formData[name] || '';
            setValue(currentValue);
            
            // Skip expensive search in minimal performance mode
            if (performance?.performanceLevel === 'minimal') {
              setSearch(currentValue);
            } else {
              // Find if it's a known option to display the label instead of value
              const option = selectOptions.find(opt => opt.value === currentValue);
              if (option && option.label) {
                setSearch(option.label);
              } else {
                setSearch(currentValue);
              }
            }
          }, [formData[name], name]) // Intentionally not including performance to avoid loops

          // Performance-optimized option filtering
          let exactOptionMatch = null;
          let filteredOptions = selectOptions;
          
          if (performance?.performanceLevel === 'minimal' || emergencyModeRef.current) {
            // Skip filtering in minimal mode
            filteredOptions = selectOptions.slice(0, 10);
          } else {
            exactOptionMatch = selectOptions.find(
              (item) => item.value === search || item.label === search
            );
            
            filteredOptions = exactOptionMatch
              ? selectOptions
              : selectOptions.filter((item) =>
                  (item.label || item.value).toLowerCase().includes(search.toLowerCase().trim())
                ).slice(0, performance?.performanceLevel === 'reduced' ? 20 : 50);
          }

          const options = filteredOptions.map((item) => (
            <Combobox.Option value={item.value} key={item.value}>
              {item.label || item.value}
            </Combobox.Option>
          ));

          return (
            <Combobox
              store={combobox}
              withinPortal={!performance?.isConstrainedViewport && performance?.performanceLevel !== 'minimal'}
              position="bottom-start"
              middlewares={performance?.isConstrainedViewport ? 
                { flip: false, shift: false } : // Disable positioning middleware on constrained viewports
                { flip: true, shift: true }
              }
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
                    maxHeight: getMaxDropdownHeight ? `${getMaxDropdownHeight()}px` : '200px', 
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    willChange: 'transform', // Optimize for animations
                    backfaceVisibility: 'hidden' // Prevent flicker
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

      default:
        logger.warn(`Unknown field type: ${type} for field: ${name}`);
        return null;
    }
  }, [formData, dynamicOptions, loadingStates, fieldErrors, renderTextInputField, renderTextareaField, renderSelectField, renderNumberField, renderDateField, handleRatingChange, handleCheckboxChange, onInputChange]);

  // Group fields by row based on gridColumn values with performance optimization
  const groupFieldsIntoRows = useCallback((fields) => {
    // Skip complex layouts on minimal performance mode
    if (shouldSimplifyLayout?.()) {
      // Simple single-column layout for constrained viewports
      return fields.map(field => [{ ...field, gridColumn: 12 }]);
    }
    
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
  }, [shouldSimplifyLayout]);

  // Memoize field rows with performance consideration
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

  // Use performance-aware modal sizing
  const responsiveModalSize = useMemo(() => {
    if (getModalSize) {
      return getModalSize(modalSize);
    }
    // Fallback to legacy logic
    if (typeof modalSize === 'string') {
      if (isMobileWidth) return 'sm';
      if (isTabletWidth && modalSize === 'xl') return 'lg';
    }
    return modalSize;
  }, [modalSize, isMobileWidth, isTabletWidth, getModalSize]);

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
      centered={!performance?.isConstrainedViewport}
      className={
        performance?.performanceLevel === 'minimal' ? 'performance-minimal' :
        emergencyModeRef.current ? 'performance-emergency' : ''
      }
      styles={useMemo(() => ({
        body: { 
          padding: isMobileWidth || performance?.isConstrainedViewport ? '0.75rem' : '1.5rem', 
          paddingBottom: isMobileWidth || performance?.isConstrainedViewport ? '1rem' : '2rem',
          maxHeight: performance?.isConstrainedViewport ? '70vh' : undefined,
          overflowY: performance?.isConstrainedViewport ? 'auto' : undefined
        },
        header: { 
          paddingBottom: performance?.isConstrainedViewport ? '0.5rem' : '1rem',
          position: performance?.isConstrainedViewport ? 'sticky' : undefined,
          top: 0,
          zIndex: 10,
          backgroundColor: 'white'
        },
        content: {
          maxHeight: performance?.isConstrainedViewport ? '90vh' : undefined
        }
      }), [isMobileWidth, performance?.isConstrainedViewport])}
      overflow="inside"
      transitionProps={shouldReduceAnimations?.() || emergencyModeRef.current ? { duration: 0 } : undefined}
      withinPortal={!emergencyModeRef.current}
      portalProps={{
        style: {
          position: 'fixed',
          zIndex: emergencyModeRef.current ? 10000 : 9999
        }
      }}
      lockScroll={!performance?.isConstrainedViewport && !emergencyModeRef.current}
      closeOnClickOutside={!emergencyModeRef.current}
      trapFocus={!emergencyModeRef.current}
      returnFocus={!emergencyModeRef.current}
      keepMounted={false}
    >
      <form 
        onSubmit={handleSubmit}
        className={
          performance?.performanceLevel === 'minimal' ? 'performance-minimal' :
          emergencyModeRef.current ? 'performance-emergency' : ''
        }
      >
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