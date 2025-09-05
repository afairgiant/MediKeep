/**
 * Responsive Configuration
 * Centralized breakpoints and responsive behavior settings
 * All responsive values should reference this file - no magic numbers
 */

/**
 * Breakpoint definitions in pixels
 * Based on common device sizes and Bootstrap/Mantine standards
 */
export const BREAKPOINTS = Object.freeze({
  xs: 0,     // Mobile phones (0-575px)
  sm: 576,   // Large phones, small tablets (576-767px)
  md: 768,   // Tablets, small laptops with zoom (768-1023px)
  lg: 1024,  // Laptops, small desktops (1024-1279px)
  xl: 1280,  // Desktop monitors (1280-1535px)
  xxl: 1536  // Large desktop monitors (1536px+)
});

/**
 * Responsive system configuration
 */
export const RESPONSIVE_CONFIG = Object.freeze({
  // Debounce delay for resize events in milliseconds
  debounceDelay: 150,
  
  // Performance mode: 'balanced' | 'performance' | 'quality'
  // balanced: Standard debouncing and updates
  // performance: Aggressive debouncing, fewer updates
  // quality: Minimal debouncing, smooth updates
  performanceMode: 'balanced',
  
  // Default breakpoint to use as fallback
  fallbackBreakpoint: 'lg',
  
  // Enable virtual scrolling for large lists
  enableVirtualization: true,
  
  // Desktop-first approach (false = mobile-first)
  mobileFirst: false,
  
  // Transition duration for responsive changes (ms)
  transitionDuration: 200,
  
  // Enable debug logging for responsive events
  debugMode: false
});

/**
 * Helper function to get breakpoint name from width
 * @param {number} width - Current viewport width
 * @returns {string} Breakpoint name (xs, sm, md, lg, xl, xxl)
 */
export function getBreakpointFromWidth(width) {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  if (width < BREAKPOINTS.xxl) return 'xl';
  return 'xxl';
}

/**
 * Helper function to check if current breakpoint is above target
 * @param {string} current - Current breakpoint
 * @param {string} target - Target breakpoint to compare
 * @returns {boolean} True if current is above target
 */
export function isAboveBreakpoint(current, target) {
  const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
  return breakpointOrder.indexOf(current) > breakpointOrder.indexOf(target);
}

/**
 * Helper function to check if current breakpoint is below target
 * @param {string} current - Current breakpoint
 * @param {string} target - Target breakpoint to compare
 * @returns {boolean} True if current is below target
 */
export function isBelowBreakpoint(current, target) {
  const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
  return breakpointOrder.indexOf(current) < breakpointOrder.indexOf(target);
}

/**
 * Helper function to check if current breakpoint matches target
 * @param {string} current - Current breakpoint
 * @param {string} target - Target breakpoint to compare
 * @returns {boolean} True if current matches target
 */
export function matchesBreakpoint(current, target) {
  return current === target;
}

/**
 * Get device type from breakpoint
 * @param {string} breakpoint - Current breakpoint
 * @returns {string} Device type (mobile, tablet, desktop)
 */
export function getDeviceType(breakpoint) {
  if (breakpoint === 'xs' || breakpoint === 'sm') return 'mobile';
  if (breakpoint === 'md') return 'tablet';
  return 'desktop';
}

/**
 * Breakpoint display names for UI
 */
export const BREAKPOINT_NAMES = Object.freeze({
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
  xxl: 'Extra Extra Large'
});

/**
 * Common responsive values per breakpoint
 */
export const RESPONSIVE_VALUES = Object.freeze({
  // Container max widths
  containerWidth: {
    xs: '100%',
    sm: '540px',
    md: '720px',
    lg: '960px',
    xl: '1140px',
    xxl: '1320px'
  },
  
  // Grid columns
  gridColumns: {
    xs: 1,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
    xxl: 4
  },
  
  // Spacing/gutter sizes
  gutter: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28
  },
  
  // Font size scales
  fontSize: {
    xs: '14px',
    sm: '14px',
    md: '15px',
    lg: '16px',
    xl: '16px',
    xxl: '16px'
  }
});