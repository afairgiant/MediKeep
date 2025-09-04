import React, { memo, useMemo, useRef, useEffect } from 'react';
import { Select as MantineSelect } from '@mantine/core';
import logger from '../../services/logger';

export const Select = memo(({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  searchable = true,
  clearable = true,
  limit = undefined,
  transitionProps,
  withinPortal = true,
  isInScrollableContainer = false,
  ...props
}) => {
  // Performance tracking refs - declare early
  const renderCount = useRef(0);
  const lastOptionsLength = useRef(options.length);
  
  // Simplified performance calculations to avoid initialization issues
  const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const isNarrowScreen = width < 1024 || height < 768;
  const needsPerformanceMode = options.length > 200;
  const shouldUsePortal = !isInScrollableContainer && !isNarrowScreen && !needsPerformanceMode && withinPortal;
  const isNarrowScreenWithScroll = isNarrowScreen; // Simplified for now
  
  useEffect(() => {
    renderCount.current++;
    
    // Warn if options are changing too frequently
    if (options.length !== lastOptionsLength.current && renderCount.current > 1) {
      if (renderCount.current % 5 === 0) {
        logger.debug('Select options changed frequently', {
          component: 'Select',
          renderCount: renderCount.current,
          optionsLength: options.length,
          previousLength: lastOptionsLength.current
        });
      }
      lastOptionsLength.current = options.length;
    }
    
    // Log performance mode detection for debugging
    if (isNarrowScreenWithScroll && renderCount.current === 1) {
      logger.debug('Narrow screen with scroll detected - optimizing dropdown performance', {
        component: 'Select',
        width,
        height,
        isNarrowScreen,
        needsPerformanceMode,
        shouldUsePortal
      });
    }
  }, [options.length, isNarrowScreenWithScroll, shouldUsePortal]);

  // Handle the onChange - old component passes value directly, Mantine passes value
  const handleChange = selectedValue => {
    onChange(selectedValue);
  };

  // Memoize options transformation to prevent unnecessary re-renders
  const mantineOptions = useMemo(() => 
    options.map(option => ({
      value: option.value,
      label: option.label,
    })), [options]
  );

  // Aggressive optimization for large datasets
  const optimizedLimit = useMemo(() => {
    if (limit !== undefined) return limit;
    
    // More aggressive limits based on dataset size
    if (options.length > 500) return 20;
    if (options.length > 200) return 30;
    if (options.length > 100) return 50;
    return undefined;
  }, [limit, options.length]);
  
  // Optimize searchable based on options count and performance
  const optimizedSearchable = useMemo(() => {
    if (!searchable) return false;
    if (options.length <= 5) return false; // No need for search with few options
    if (options.length > 500) return true; // Force search for huge lists
    if (isNarrowScreenWithScroll && options.length < 50) return false; // Disable search on narrow screens with few options
    return searchable;
  }, [searchable, options.length, isNarrowScreenWithScroll]);

  return (
    <MantineSelect
      value={value}
      onChange={handleChange}
      data={mantineOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchable={optimizedSearchable}
      clearable={clearable && !needsPerformanceMode} // Disable clearable for huge lists
      limit={optimizedLimit}
      maxDropdownHeight={props.maxDropdownHeight || (needsPerformanceMode ? 200 : 280)}
      withScrollArea={options.length > 10} // Enable virtual scrolling earlier
      withinPortal={shouldUsePortal}
      transitionProps={needsPerformanceMode || isNarrowScreenWithScroll ? { duration: 0 } : transitionProps}
      comboboxProps={{
        transitionProps: needsPerformanceMode || isNarrowScreenWithScroll ? { duration: 0 } : undefined,
        withinPortal: shouldUsePortal,
        position: isNarrowScreenWithScroll ? 'bottom' : 'bottom-start',
        // Optimize positioning for narrow screens - disable expensive middleware
        middlewares: isNarrowScreenWithScroll ? 
          { flip: false, shift: false, inline: false } : // Disable all positioning middleware
          undefined,
        offset: isNarrowScreenWithScroll ? 4 : 8, // Smaller offset on narrow screens
      }}
      styles={{
        dropdown: {
          willChange: isNarrowScreenWithScroll || needsPerformanceMode ? 'auto' : 'transform',
          transform: isNarrowScreenWithScroll ? 'none' : undefined, // Disable transform on narrow screens
          backfaceVisibility: 'hidden', // Prevent flicker
        }
      }}
      classNames={{
        dropdown: isNarrowScreenWithScroll ? 'dropdown-constrained-viewport' : ''
      }}
      {...props}
    />
  );
});

export default Select;
