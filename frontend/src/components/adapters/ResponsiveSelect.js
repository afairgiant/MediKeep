import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { Select as MantineSelect, Loader, Group, Text, Box, rem } from '@mantine/core';
import { IconSearch, IconChevronDown } from '@tabler/icons-react';
import { useResponsive } from '../../hooks/useResponsive';
import logger from '../../services/logger';

/**
 * ResponsiveSelect Component
 * 
 * Enhances Mantine's Select component with responsive behavior optimized for medical forms.
 * Adapts UI and functionality based on screen size and device capabilities.
 * 
 * Features:
 * - Mobile: Native-style with larger touch targets and enhanced search
 * - Tablet: Standard dropdown with improved spacing
 * - Desktop: Full dropdown with grouping and advanced features
 * - Accessibility: Full ARIA support, keyboard navigation, screen reader friendly
 * - Performance: Virtualization for large lists, memoized options
 */
export const ResponsiveSelect = memo(({
  // Core props
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  
  // Form integration
  label,
  name,
  error,
  required = false,
  disabled = false,
  description,
  
  // Responsive behavior
  searchable,
  clearable = true,
  limit,
  groupBy,
  
  // Loading and async
  loading = false,
  loadingText = 'Loading options...',
  
  // Styling
  className = '',
  size,
  variant,
  
  // Medical form specific
  medicalContext = 'general', // 'practitioners', 'pharmacies', 'medications', 'general'
  showCount = false,
  
  // Advanced features
  onSearch,
  onCreate,
  creatable = false,
  
  // Accessibility
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  
  ...props
}) => {
  const { breakpoint, deviceType, isMobile, isTablet, isDesktop } = useResponsive();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Component logging context
  const componentContext = useMemo(() => ({
    component: 'ResponsiveSelect',
    breakpoint,
    deviceType,
    medicalContext,
    optionsCount: options.length
  }), [breakpoint, deviceType, medicalContext, options.length]);

  // Log component mount and responsive changes
  useEffect(() => {
    logger.debug('ResponsiveSelect mounted', componentContext);
  }, []);

  useEffect(() => {
    logger.debug('ResponsiveSelect breakpoint changed', {
      ...componentContext,
      previousBreakpoint: breakpoint
    });
  }, [breakpoint]);

  // Responsive configuration based on breakpoint
  const responsiveConfig = useMemo(() => {
    const config = {
      // Mobile configuration (xs, sm)
      mobile: {
        size: size || 'md',
        searchable: searchable !== false, // Default true for mobile
        maxDropdownHeight: '60vh',
        withinPortal: true,
        transitionProps: { duration: 200, transition: 'slide-up' },
        dropdownPosition: 'bottom',
        comboboxProps: {
          shadow: 'lg',
          position: 'bottom-start',
          middlewares: { flip: true, shift: true }
        }
      },
      
      // Tablet configuration (md)
      tablet: {
        size: size || 'md',
        searchable: searchable !== false && options.length > 10,
        maxDropdownHeight: rem(320),
        withinPortal: true,
        transitionProps: { duration: 150, transition: 'fade' },
        dropdownPosition: 'bottom',
        comboboxProps: {
          shadow: 'md',
          position: 'bottom-start'
        }
      },
      
      // Desktop configuration (lg+)
      desktop: {
        size: size || 'sm',
        searchable: searchable !== false && options.length > 5,
        maxDropdownHeight: rem(280),
        withinPortal: false,
        transitionProps: { duration: 100, transition: 'fade' },
        dropdownPosition: 'bottom',
        comboboxProps: {
          shadow: 'sm'
        }
      }
    };

    if (isMobile) return config.mobile;
    if (isTablet) return config.tablet;
    return config.desktop;
  }, [isMobile, isTablet, isDesktop, searchable, options.length, size]);

  // Handle onChange with logging and validation
  const handleChange = useCallback((selectedValue) => {
    logger.info('Select option changed', {
      ...componentContext,
      selectedValue,
      previousValue: value,
      searchValue: searchable ? searchValue : undefined
    });

    try {
      // For form integration - create synthetic event if name is provided
      if (name && onChange) {
        const syntheticEvent = {
          target: {
            name: name,
            value: selectedValue,
          },
        };
        onChange(syntheticEvent);
      } else if (onChange) {
        onChange(selectedValue);
      }
    } catch (error) {
      logger.error('Error in ResponsiveSelect onChange handler', {
        ...componentContext,
        error: error.message,
        selectedValue
      });
    }
  }, [componentContext, value, onChange, name, searchValue, searchable]);

  // Handle search with debouncing and external search support
  const handleSearch = useCallback((query) => {
    setSearchValue(query);
    
    if (onSearch) {
      logger.debug('External search triggered', {
        ...componentContext,
        query,
        queryLength: query.length
      });
      onSearch(query);
    }
  }, [componentContext, onSearch]);

  // Handle dropdown state changes
  const handleDropdownOpen = useCallback(() => {
    setIsOpen(true);
    logger.debug('Select dropdown opened', componentContext);
  }, [componentContext]);

  const handleDropdownClose = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
    logger.debug('Select dropdown closed', componentContext);
  }, [componentContext]);

  // Transform options with grouping and medical context enhancements
  const processedOptions = useMemo(() => {
    let processedData = options.map(option => {
      // Handle different option formats
      if (typeof option === 'string') {
        return { value: option, label: option };
      }
      
      return {
        value: option.value,
        label: option.label,
        disabled: option.disabled,
        group: option.group || (groupBy && option[groupBy]),
        // Medical context enhancements
        ...(medicalContext === 'practitioners' && {
          description: option.specialty || option.description
        }),
        ...(medicalContext === 'pharmacies' && {
          description: option.address || option.description
        }),
        ...(medicalContext === 'medications' && {
          description: option.dosage || option.strength || option.description
        })
      };
    });

    // Apply grouping if specified
    if (groupBy && !isMobile) {
      const grouped = processedData.reduce((acc, option) => {
        const group = option.group || 'Other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(option);
        return acc;
      }, {});

      processedData = Object.entries(grouped).flatMap(([group, groupOptions]) => [
        { group, disabled: true }, // Group header
        ...groupOptions
      ]);
    }

    return processedData;
  }, [options, groupBy, medicalContext, isMobile]);

  // Optimize limit based on responsive context and performance
  const optimizedLimit = useMemo(() => {
    if (limit !== undefined) return limit;
    
    // More aggressive limits on mobile for performance
    if (isMobile && options.length > 50) return 25;
    if (isTablet && options.length > 100) return 50;
    if (isDesktop && options.length > 200) return 100;
    
    return undefined;
  }, [limit, options.length, isMobile, isTablet, isDesktop]);

  // Enhanced accessibility props
  const accessibilityProps = useMemo(() => ({
    'aria-label': ariaLabel || label || `${medicalContext} selection`,
    'aria-describedby': ariaDescribedBy || (description && `${name}-description`),
    'aria-required': required,
    'aria-invalid': !!error,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox',
    role: 'combobox'
  }), [ariaLabel, label, medicalContext, ariaDescribedBy, description, name, required, error, isOpen]);

  // Error handling for malformed data
  if (!Array.isArray(options)) {
    logger.error('ResponsiveSelect received invalid options prop', {
      ...componentContext,
      optionsType: typeof options,
      options
    });
    return (
      <MantineSelect
        label={label}
        error="Invalid options data"
        disabled
        placeholder="Error loading options"
        {...accessibilityProps}
      />
    );
  }

  return (
    <MantineSelect
      // Core props
      label={label}
      name={name}
      value={value}
      onChange={handleChange}
      data={processedOptions}
      placeholder={loading ? loadingText : placeholder}
      error={error}
      required={required}
      disabled={disabled || loading}
      description={description}
      className={className}
      
      // Responsive configuration
      size={responsiveConfig.size}
      searchable={responsiveConfig.searchable}
      clearable={clearable && !required}
      limit={optimizedLimit}
      maxDropdownHeight={responsiveConfig.maxDropdownHeight}
      withinPortal={responsiveConfig.withinPortal}
      transitionProps={responsiveConfig.transitionProps}
      dropdownPosition={responsiveConfig.dropdownPosition}
      comboboxProps={responsiveConfig.comboboxProps}
      
      // Search functionality
      onSearchChange={responsiveConfig.searchable ? handleSearch : undefined}
      searchValue={responsiveConfig.searchable ? searchValue : undefined}
      
      // Dropdown events
      onDropdownOpen={handleDropdownOpen}
      onDropdownClose={handleDropdownClose}
      
      // Performance optimizations
      withScrollArea={options.length > 20}
      
      // Accessibility
      withAsterisk={required}
      {...accessibilityProps}
      
      // Loading state
      rightSection={loading ? (
        <Loader size="xs" />
      ) : (
        <IconChevronDown size={rem(16)} />
      )}
      
      // Mobile-specific enhancements
      {...(isMobile && {
        styles: (theme) => ({
          input: {
            minHeight: rem(48), // Larger touch target
            fontSize: rem(16), // Prevent zoom on iOS
          },
          dropdown: {
            maxHeight: '60vh',
            overflowY: 'auto'
          }
        })
      })}
      
      // Medical context specific props
      {...(medicalContext === 'practitioners' && {
        rightSectionPointerEvents: 'none'
      })}
      
      // Additional props
      {...props}
    >
      {/* Custom option rendering for medical contexts */}
      {processedOptions.length > 0 && showCount && (
        <Group justify="space-between" px="xs" py="xs" bg="gray.0">
          <Text size="xs" c="dimmed">
            {processedOptions.length} option{processedOptions.length !== 1 ? 's' : ''} available
          </Text>
        </Group>
      )}
    </MantineSelect>
  );
});

ResponsiveSelect.displayName = 'ResponsiveSelect';

export default ResponsiveSelect;