import { useState, useEffect, useRef, useMemo } from 'react';
import logger from '../services/logger';

// Configuration constants
const DEFAULT_DIMENSION_CHANGE_THRESHOLD = 5; // pixels
const DEFAULT_DEBOUNCE_MS = 100;

// Performance thresholds for different screen categories
const SCREEN_CATEGORIES = {
  ULTRA_SMALL: { width: 1280, height: 720 },  // Old laptops, netbooks
  SMALL_LAPTOP: { width: 1366, height: 768 },  // Common small laptop resolution
  STANDARD: { width: 1920, height: 1080 },     // Standard desktop
  MOBILE: { width: 768 },                      // Mobile devices
  TABLET: { width: 1024 },                     // Tablets
};

// Font size thresholds for accessibility detection
const FONT_SIZE_THRESHOLDS = {
  NORMAL: 16,     // Standard browser default
  LARGE: 20,      // 125% zoom or large text
  EXTRA_LARGE: 24 // 150% zoom or extra large text
};

/**
 * Detects if user has accessibility features enabled
 */
const detectAccessibilityMode = () => {
  try {
    // Check computed font size on root element
    const rootFontSize = parseFloat(
      window.getComputedStyle(document.documentElement).fontSize
    );
    
    // Check for high contrast mode
    const hasHighContrast = window.matchMedia && 
      (window.matchMedia('(prefers-contrast: high)').matches ||
       window.matchMedia('(-ms-high-contrast: active)').matches);
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check zoom level (approximate)
    const zoomLevel = Math.round((window.devicePixelRatio || 1) * 100);
    
    return {
      fontSize: rootFontSize,
      isLargeText: rootFontSize >= FONT_SIZE_THRESHOLDS.LARGE,
      isExtraLargeText: rootFontSize >= FONT_SIZE_THRESHOLDS.EXTRA_LARGE,
      hasHighContrast,
      prefersReducedMotion,
      zoomLevel,
      isAccessibilityMode: rootFontSize >= FONT_SIZE_THRESHOLDS.LARGE || hasHighContrast
    };
  } catch (error) {
    logger.error('Error detecting accessibility mode', {
      component: 'useWindowDimensions',
      error: error.message
    });
    return {
      fontSize: 16,
      isLargeText: false,
      isExtraLargeText: false,
      hasHighContrast: false,
      prefersReducedMotion: false,
      zoomLevel: 100,
      isAccessibilityMode: false
    };
  }
};

/**
 * Determines performance mode based on viewport and accessibility settings
 */
const determinePerformanceMode = (width, height, accessibility) => {
  // Calculate available viewport area
  const viewportArea = width * height;
  // Only consider truly constrained viewports (mobile-sized screens)
  const isConstrainedViewport = viewportArea < 1024 * 640;
  
  // Check for specific constrained conditions - be more conservative
  const isUltraSmallScreen = width < 1024 || height < 600; // True mobile/tablet sizes
  const isSmallLaptop = width <= SCREEN_CATEGORIES.SMALL_LAPTOP.width && 
                        height <= SCREEN_CATEGORIES.SMALL_LAPTOP.height;
  
  // Determine if we need reduced performance mode
  const needsReducedPerformance = 
    isConstrainedViewport || 
    isUltraSmallScreen ||
    (isSmallLaptop && accessibility.isAccessibilityMode) ||
    accessibility.isExtraLargeText ||
    (accessibility.isLargeText && height < 800);
  
  // Determine performance level
  let performanceLevel = 'full';
  if (needsReducedPerformance) {
    if (viewportArea < 1024 * 600 || accessibility.isExtraLargeText) {
      performanceLevel = 'minimal';
    } else if (isConstrainedViewport || accessibility.isLargeText) {
      performanceLevel = 'reduced';
    }
  }
  
  return {
    performanceLevel,
    isConstrainedViewport,
    isUltraSmallScreen,
    isSmallLaptop,
    needsReducedPerformance,
    viewportArea,
    // Feature flags based on performance level
    features: {
      animations: performanceLevel === 'full',
      complexLayouts: performanceLevel === 'full',
      virtualScrolling: performanceLevel !== 'minimal',
      dropdownSearch: performanceLevel === 'full' && !accessibility.isAccessibilityMode,
      autoComplete: performanceLevel !== 'minimal',
      liveValidation: performanceLevel === 'full',
      richInteractions: performanceLevel === 'full' && !accessibility.prefersReducedMotion
    }
  };
};

/**
 * Enhanced hook for tracking window dimensions with performance optimization
 * Detects constrained viewports, accessibility modes, and provides performance hints
 */
export const useWindowDimensions = (debounceMs = DEFAULT_DEBOUNCE_MS, changeThreshold = DEFAULT_DIMENSION_CHANGE_THRESHOLD) => {
  const [dimensions, setDimensions] = useState(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const accessibility = detectAccessibilityMode();
    const performance = determinePerformanceMode(width, height, accessibility);
    
    return {
      width,
      height,
      isSmallScreen: height < 800,
      isMobileWidth: width < 768,
      isTabletWidth: width < 1024,
      accessibility,
      performance,
      // Legacy compatibility
      ...performance.features
    };
  });
  
  const timeoutRef = useRef(null);
  const lastLogRef = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Debounce the resize handler
      timeoutRef.current = setTimeout(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        const accessibility = detectAccessibilityMode();
        const performance = determinePerformanceMode(newWidth, newHeight, accessibility);
        
        setDimensions(prev => {
          const newDimensions = {
            width: newWidth,
            height: newHeight,
            isSmallScreen: newHeight < 800,
            isMobileWidth: newWidth < 768,
            isTabletWidth: newWidth < 1024,
            accessibility,
            performance,
            // Legacy compatibility
            ...performance.features
          };
          
          // Only update if dimensions actually changed significantly
          const hasSignificantChange = 
            Math.abs(prev.width - newWidth) > changeThreshold || 
            Math.abs(prev.height - newHeight) > changeThreshold ||
            prev.isSmallScreen !== newDimensions.isSmallScreen ||
            prev.isMobileWidth !== newDimensions.isMobileWidth ||
            prev.isTabletWidth !== newDimensions.isTabletWidth ||
            prev.performance?.performanceLevel !== performance.performanceLevel ||
            prev.accessibility?.fontSize !== accessibility.fontSize;
          
          if (hasSignificantChange) {
            // Log performance mode changes (throttled)
            const now = Date.now();
            if (now - lastLogRef.current > 5000) {
              lastLogRef.current = now;
              logger.info('Window dimensions and performance mode updated', {
                component: 'useWindowDimensions',
                width: newWidth,
                height: newHeight,
                performanceLevel: performance.performanceLevel,
                isAccessibilityMode: accessibility.isAccessibilityMode,
                fontSize: accessibility.fontSize,
                viewportArea: performance.viewportArea
              });
            }
            return newDimensions;
          }
          return prev;
        });
      }, debounceMs);
    };

    // Initial accessibility check
    const accessibility = detectAccessibilityMode();
    if (accessibility.isAccessibilityMode) {
      logger.info('Accessibility mode detected on mount', {
        component: 'useWindowDimensions',
        ...accessibility
      });
    }

    // Listen for resize events
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Listen for zoom changes (approximate)
    const mediaQueryList = window.matchMedia && window.matchMedia('(resolution: 1dppx)');
    if (mediaQueryList && mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleResize);
    }
    
    // Listen for font size changes
    const fontSizeObserver = new MutationObserver(() => {
      const currentFontSize = parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      );
      if (Math.abs(currentFontSize - dimensions.accessibility?.fontSize) > 1) {
        handleResize();
      }
    });
    
    fontSizeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (mediaQueryList && mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleResize);
      }
      fontSizeObserver.disconnect();
    };
  }, [debounceMs, changeThreshold, dimensions.accessibility?.fontSize]);

  // Memoize helper functions for components
  const helpers = useMemo(() => ({
    shouldReduceAnimations: () => 
      dimensions.performance?.performanceLevel !== 'full' || 
      dimensions.accessibility?.prefersReducedMotion,
    
    shouldSimplifyLayout: () => 
      dimensions.performance?.performanceLevel === 'minimal',
    
    shouldLimitDropdownItems: () => 
      dimensions.performance?.performanceLevel !== 'full',
    
    getMaxDropdownHeight: () => {
      if (dimensions.performance?.performanceLevel === 'minimal') return 150;
      if (dimensions.performance?.performanceLevel === 'reduced') return 200;
      if (dimensions.isSmallScreen) return 250;
      return 300;
    },
    
    getModalSize: (requestedSize) => {
      if (dimensions.performance?.performanceLevel === 'minimal') return 'sm';
      if (dimensions.isMobileWidth) return 'sm';
      if (dimensions.isTabletWidth && requestedSize === 'xl') return 'lg';
      if (dimensions.performance?.isConstrainedViewport && requestedSize === 'xl') return 'lg';
      return requestedSize;
    },
    
    getDebounceDelay: (baseDelay = 300) => {
      if (dimensions.performance?.performanceLevel === 'minimal') return baseDelay * 2;
      if (dimensions.performance?.performanceLevel === 'reduced') return baseDelay * 1.5;
      return baseDelay;
    }
  }), [dimensions]);

  return {
    ...dimensions,
    ...helpers
  };
};

export default useWindowDimensions;