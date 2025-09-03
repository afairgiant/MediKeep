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
  
  // All performance calculations using useMemo to prevent re-calculation
  const performanceConfig = useMemo(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const hasVerticalScrollbar = typeof document !== 'undefined' 
      ? document.documentElement.scrollHeight > height 
      : false;
    const hasHorizontalScrollbar = typeof document !== 'undefined'
      ? document.documentElement.scrollWidth > width
      : false;
    
    const isNarrowScreenWithScroll = (width < 1024 || height < 768) && (hasVerticalScrollbar || hasHorizontalScrollbar);
    const needsPerformanceMode = options.length > 200;
    const shouldUsePortal = !isInScrollableContainer && !isNarrowScreenWithScroll && !needsPerformanceMode && withinPortal;
    
    return {
      isNarrowScreenWithScroll,
      needsPerformanceMode,
      shouldUsePortal,
      width,
      height,
      hasVerticalScrollbar,
      hasHorizontalScrollbar
    };
  }, [options.length, isInScrollableContainer, withinPortal]);
  
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
    if (performanceConfig.isNarrowScreenWithScroll && renderCount.current === 1) {
      logger.debug('Narrow screen with scroll detected - optimizing dropdown performance', {
        component: 'Select',
        ...performanceConfig
      });
    }
  }, [options.length, performanceConfig]);

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
    if (performanceConfig.isNarrowScreenWithScroll && options.length < 50) return false; // Disable search on narrow screens with few options
    return searchable;
  }, [searchable, options.length, performanceConfig.isNarrowScreenWithScroll]);

  return (
    <MantineSelect
      value={value}
      onChange={handleChange}
      data={mantineOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchable={optimizedSearchable}
      clearable={clearable && !performanceConfig.needsPerformanceMode} // Disable clearable for huge lists
      limit={optimizedLimit}
      maxDropdownHeight={props.maxDropdownHeight || (performanceConfig.needsPerformanceMode ? 200 : 280)}
      withScrollArea={options.length > 10} // Enable virtual scrolling earlier
      withinPortal={performanceConfig.shouldUsePortal}
      transitionProps={performanceConfig.needsPerformanceMode || performanceConfig.isNarrowScreenWithScroll ? { duration: 0 } : transitionProps}
      comboboxProps={{
        transitionProps: performanceConfig.needsPerformanceMode || performanceConfig.isNarrowScreenWithScroll ? { duration: 0 } : undefined,
        withinPortal: performanceConfig.shouldUsePortal,
        position: performanceConfig.isNarrowScreenWithScroll ? 'bottom' : 'bottom-start',
        // Optimize positioning for narrow screens - disable expensive middleware
        middlewares: performanceConfig.isNarrowScreenWithScroll ? 
          { flip: false, shift: false, inline: false } : // Disable all positioning middleware
          undefined,
        offset: performanceConfig.isNarrowScreenWithScroll ? 4 : 8, // Smaller offset on narrow screens
      }}
      styles={{
        dropdown: {
          willChange: performanceConfig.isNarrowScreenWithScroll || performanceConfig.needsPerformanceMode ? 'auto' : 'transform',
          transform: performanceConfig.isNarrowScreenWithScroll ? 'none' : undefined, // Disable transform on narrow screens
          backfaceVisibility: 'hidden', // Prevent flicker
        }
      }}
      classNames={{
        dropdown: performanceConfig.isNarrowScreenWithScroll ? 'dropdown-constrained-viewport' : ''
      }}
      {...props}
    />
  );
});

export default Select;
