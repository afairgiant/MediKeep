import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import {
  Select as MantineSelect,
  Loader,
  Group,
  Text,
  Box,
  rem,
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
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
export const ResponsiveSelect = memo(
  ({
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
    variant: _variant,

    // Medical form specific
    medicalContext = 'general', // 'practitioners', 'pharmacies', 'medications', 'general'
    showCount = false,

    // Advanced features
    onSearch,
    onCreate: _onCreate,
    creatable: _creatable = false,

    // Accessibility
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,

    ...props
  }) => {
    const { t } = useTranslation('shared');
    const { breakpoint, deviceType, isMobile, isTablet, isDesktop } =
      useResponsive();
    const [searchValue, setSearchValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Component logging context
    const componentContext = useMemo(
      () => ({
        component: 'ResponsiveSelect',
        breakpoint,
        deviceType,
        medicalContext,
        optionsCount: options.length,
      }),
      [breakpoint, deviceType, medicalContext, options.length]
    );

    // Log component mount and responsive changes
    useEffect(() => {
      logger.debug('ResponsiveSelect mounted', componentContext);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only log; componentContext changes every render
    }, []);

    useEffect(() => {
      logger.debug('ResponsiveSelect breakpoint changed', {
        ...componentContext,
        previousBreakpoint: breakpoint,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fires only on breakpoint change; componentContext changes every render
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
            middlewares: { flip: true, shift: true },
          },
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
            position: 'bottom-start',
          },
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
            shadow: 'sm',
          },
        },
      };

      if (isMobile) return config.mobile;
      if (isTablet) return config.tablet;
      return config.desktop;
    }, [isMobile, isTablet, searchable, options.length, size]);

    // Handle onChange with logging and validation
    const handleChange = useCallback(
      selectedValue => {
        logger.info('Select option changed', {
          ...componentContext,
          selectedValue,
          previousValue: value,
          searchValue: searchable ? searchValue : undefined,
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
            selectedValue,
          });
        }
      },
      [componentContext, value, onChange, name, searchValue, searchable]
    );

    // Handle search with debouncing and external search support
    const handleSearch = useCallback(
      query => {
        setSearchValue(query);

        if (onSearch) {
          logger.debug('External search triggered', {
            ...componentContext,
            query,
            queryLength: query.length,
          });
          onSearch(query);
        }
      },
      [componentContext, onSearch]
    );

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
      let processedData = options
        .filter(option => option != null) // Remove null/undefined entries
        .map(option => {
          // Handle different option formats
          if (typeof option === 'string') {
            return { value: option, label: option };
          }

          if (typeof option !== 'object') {
            return null;
          }

          const groupValue =
            option.group || (groupBy && option[groupBy]) || undefined;

          return {
            value: option.value,
            label: option.label ?? option.value ?? '',
            // Only include these keys when truthy to avoid Mantine v8 misinterpreting undefined group
            ...(option.disabled && { disabled: option.disabled }),
            ...(groupValue && { group: groupValue }),
            // Medical context enhancements
            ...(medicalContext === 'practitioners' && {
              description: option.specialty || option.description,
            }),
            ...(medicalContext === 'pharmacies' && {
              description: option.address || option.description,
            }),
            ...(medicalContext === 'medications' && {
              description:
                option.dosage || option.strength || option.description,
            }),
          };
        })
        .filter(item => item != null && item.value != null); // Remove null entries and entries with no usable value

      // Apply grouping if specified - use Mantine v8 group format { group, items }
      if (groupBy && !isMobile) {
        const grouped = processedData.reduce((acc, option) => {
          const group = option.group || 'Other';
          if (!acc[group]) acc[group] = [];
          // Remove group key from individual items since it's now the group header
          const { group: _g, ...itemWithoutGroup } = option;
          acc[group].push(itemWithoutGroup);
          return acc;
        }, {});

        processedData = Object.entries(grouped).map(([group, items]) => ({
          group,
          items,
        }));
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
    const accessibilityProps = useMemo(
      () => ({
        'aria-label': ariaLabel || label || `${medicalContext} selection`,
        'aria-describedby':
          ariaDescribedBy || (description && `${name}-description`),
        'aria-required': required,
        'aria-invalid': !!error,
        'aria-expanded': isOpen,
        'aria-haspopup': 'listbox',
        role: 'combobox',
      }),
      [
        ariaLabel,
        label,
        medicalContext,
        ariaDescribedBy,
        description,
        name,
        required,
        error,
        isOpen,
      ]
    );

    // Error handling for malformed data
    if (!Array.isArray(options)) {
      logger.error('ResponsiveSelect received invalid options prop', {
        ...componentContext,
        optionsType: typeof options,
        options,
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
      <Box>
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
          onSearchChange={
            responsiveConfig.searchable ? handleSearch : undefined
          }
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
          rightSection={
            loading ? <Loader size="xs" /> : <IconChevronDown size={rem(16)} />
          }
          // Mobile-specific enhancements
          {...(isMobile && {
            styles: _theme => ({
              input: {
                minHeight: rem(48), // Larger touch target
                fontSize: rem(16), // Prevent zoom on iOS
              },
              dropdown: {
                maxHeight: '60vh',
                overflowY: 'auto',
              },
            }),
          })}
          // Medical context specific props
          {...(medicalContext === 'practitioners' && {
            rightSectionPointerEvents: 'none',
          })}
          // Additional props
          {...props}
        />
        {/* Option count display rendered outside Select to avoid void element children error */}
        {processedOptions.length > 0 && showCount && (
          <Group
            justify="space-between"
            px="xs"
            py="xs"
            bg="var(--color-bg-secondary)"
          >
            <Text size="xs" c="dimmed">
              {t('labels.countTotal', { count: processedOptions.length })}
            </Text>
          </Group>
        )}
      </Box>
    );
  }
);

ResponsiveSelect.displayName = 'ResponsiveSelect';

export default ResponsiveSelect;
