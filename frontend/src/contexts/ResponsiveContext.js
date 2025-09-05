import { createContext } from 'react';
import { RESPONSIVE_CONFIG } from '../config/responsive.config';

/**
 * ResponsiveContext
 * Provides responsive state and utilities to all child components
 */

/**
 * Default context value structure
 * Used when context is accessed outside of provider (development)
 */
const defaultContextValue = {
  // Current viewport dimensions
  width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  height: typeof window !== 'undefined' ? window.innerHeight : 768,
  
  // Current breakpoint name
  breakpoint: RESPONSIVE_CONFIG.fallbackBreakpoint,
  
  // Device type (mobile, tablet, desktop)
  deviceType: 'desktop',
  
  // Helper functions
  isAbove: () => false,
  isBelow: () => false,
  matches: () => false,
  
  // Quick access booleans
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  
  // Additional state
  isLandscape: false,
  isPortrait: true,
  isTouch: false,
  
  // Performance metrics
  lastUpdate: Date.now(),
  updateCount: 0
};

/**
 * Create the ResponsiveContext
 */
export const ResponsiveContext = createContext(defaultContextValue);

/**
 * Context display name for React DevTools
 */
ResponsiveContext.displayName = 'ResponsiveContext';

export default ResponsiveContext;