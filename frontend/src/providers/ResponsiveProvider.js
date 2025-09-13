import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ResponsiveContext from '../contexts/ResponsiveContext';
import { 
  RESPONSIVE_CONFIG, 
  getBreakpointFromWidth, 
  isAboveBreakpoint,
  isBelowBreakpoint,
  matchesBreakpoint,
  getDeviceType
} from '../config/responsive.config';
import { debounce } from '../utils/debounce';
import logger from '../services/logger';

/**
 * ResponsiveProvider
 * Manages viewport state and provides responsive context to child components
 * 
 * Features:
 * - Debounced resize observer for performance
 * - Breakpoint calculation and state management
 * - Device type detection (mobile/tablet/desktop)
 * - Touch device detection
 * - Orientation detection
 * - Performance monitoring (optional)
 */

/**
 * Get initial viewport dimensions
 * Safe for SSR - returns default values if window is not available
 */
function getInitialDimensions() {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      height: 768
    };
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

/**
 * Detect if device supports touch
 */
function isTouchDevice() {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * ResponsiveProvider Component
 */
export function ResponsiveProvider({ 
  children, 
  initialBreakpoint = null,
  debounceDelay = RESPONSIVE_CONFIG.debounceDelay,
  debugMode = RESPONSIVE_CONFIG.debugMode 
}) {
  const [dimensions, setDimensions] = useState(getInitialDimensions);
  const [isTouch, setIsTouch] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  
  // Calculate current breakpoint from width
  const breakpoint = useMemo(() => {
    if (initialBreakpoint) {
      return initialBreakpoint;
    }
    return getBreakpointFromWidth(dimensions.width);
  }, [dimensions.width, initialBreakpoint]);
  
  // Calculate device type
  const deviceType = useMemo(() => {
    return getDeviceType(breakpoint);
  }, [breakpoint]);
  
  // Calculate orientation
  const isLandscape = useMemo(() => {
    return dimensions.width > dimensions.height;
  }, [dimensions.width, dimensions.height]);
  
  // Quick access booleans
  const responsiveFlags = useMemo(() => ({
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isLandscape,
    isPortrait: !isLandscape
  }), [deviceType, isLandscape]);
  
  // Helper functions for breakpoint comparison
  const helpers = useMemo(() => ({
    isAbove: (targetBreakpoint) => isAboveBreakpoint(breakpoint, targetBreakpoint),
    isBelow: (targetBreakpoint) => isBelowBreakpoint(breakpoint, targetBreakpoint),
    matches: (targetBreakpoint) => matchesBreakpoint(breakpoint, targetBreakpoint)
  }), [breakpoint]);
  
  // Handle viewport changes
  const handleViewportChange = useCallback(() => {
    const newDimensions = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Only update if dimensions actually changed
    if (newDimensions.width !== dimensions.width || newDimensions.height !== dimensions.height) {
      const oldBreakpoint = getBreakpointFromWidth(dimensions.width);
      const newBreakpoint = getBreakpointFromWidth(newDimensions.width);
      
      setDimensions(newDimensions);
      setUpdateCount(prev => prev + 1);
      
      // Log breakpoint changes if debug mode is enabled
      if (debugMode && oldBreakpoint !== newBreakpoint) {
        logger.debug('responsive_breakpoint_change', 'Breakpoint changed', {
          component: 'ResponsiveProvider',
          from: oldBreakpoint,
          to: newBreakpoint,
          width: newDimensions.width,
          height: newDimensions.height,
          timestamp: Date.now()
        });
      }
    }
  }, [dimensions.width, dimensions.height, debugMode]);
  
  // Create debounced resize handler
  const debouncedResize = useMemo(() => {
    return debounce(handleViewportChange, debounceDelay, {
      leading: false,
      trailing: true
    });
  }, [handleViewportChange, debounceDelay]);
  
  // Set up resize observer
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Detect touch capability
    setIsTouch(isTouchDevice());
    
    // Add resize listener
    window.addEventListener('resize', debouncedResize, { passive: true });
    
    // Initial call to set dimensions
    handleViewportChange();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', debouncedResize);
      debouncedResize.cancel();
    };
  }, [debouncedResize, handleViewportChange]);
  
  // Log provider initialization in debug mode
  useEffect(() => {
    if (debugMode) {
      logger.debug('responsive_provider_init', 'ResponsiveProvider initialized', {
        component: 'ResponsiveProvider',
        initialBreakpoint: breakpoint,
        dimensions,
        deviceType,
        debounceDelay,
        isTouch
      });
    }
  }, []); // Only run on mount
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Viewport dimensions
    width: dimensions.width,
    height: dimensions.height,
    
    // Current breakpoint
    breakpoint,
    deviceType,
    
    // Helper functions
    isAbove: helpers.isAbove,
    isBelow: helpers.isBelow,
    matches: helpers.matches,
    
    // Quick access flags
    ...responsiveFlags,
    isTouch,
    
    // Performance/debug info
    lastUpdate: Date.now(),
    updateCount
  }), [
    dimensions,
    breakpoint,
    deviceType,
    helpers,
    responsiveFlags,
    isTouch,
    updateCount
  ]);
  
  return (
    <ResponsiveContext.Provider value={contextValue}>
      {children}
    </ResponsiveContext.Provider>
  );
}

/**
 * Default props
 */
ResponsiveProvider.defaultProps = {
  debounceDelay: RESPONSIVE_CONFIG.debounceDelay,
  debugMode: RESPONSIVE_CONFIG.debugMode
};

export default ResponsiveProvider;