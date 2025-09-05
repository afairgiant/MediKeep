import { useMemo } from 'react';
import { useResponsive } from './useResponsive';
import { BREAKPOINTS, RESPONSIVE_VALUES } from '../config/responsive.config';

/**
 * useBreakpointValue Hook
 * Returns different values based on current breakpoint
 * 
 * @param {Object} values - Object with breakpoint keys and corresponding values
 * @param {*} fallback - Fallback value if no breakpoint matches
 * @returns {*} Value for current breakpoint
 * 
 * @example
 * const columns = useBreakpointValue({
 *   xs: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4
 * }, 1);
 */
export function useBreakpointValue(values, fallback = null) {
  const { breakpoint } = useResponsive();
  
  return useMemo(() => {
    if (values && typeof values === 'object' && values[breakpoint] !== undefined) {
      return values[breakpoint];
    }
    return fallback;
  }, [values, breakpoint, fallback]);
}

/**
 * useBreakpointStyles Hook
 * Returns CSS styles object based on breakpoint
 * 
 * @param {Object} stylesMap - Object with breakpoint keys and style objects
 * @returns {Object} CSS styles for current breakpoint
 * 
 * @example
 * const styles = useBreakpointStyles({
 *   xs: { fontSize: '14px', padding: '8px' },
 *   lg: { fontSize: '16px', padding: '16px' }
 * });
 */
export function useBreakpointStyles(stylesMap) {
  const { breakpoint } = useResponsive();
  
  return useMemo(() => {
    if (!stylesMap || typeof stylesMap !== 'object') {
      return {};
    }
    
    // Find the most specific style for current breakpoint
    // Check current breakpoint first, then fall back to smaller ones
    const breakpointOrder = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (stylesMap[bp]) {
        return stylesMap[bp];
      }
    }
    
    return {};
  }, [stylesMap, breakpoint]);
}

/**
 * useGridColumns Hook
 * Returns appropriate number of columns for current breakpoint
 * 
 * @param {Object} customColumns - Custom column configuration per breakpoint
 * @returns {number} Number of columns for current breakpoint
 * 
 * @example
 * const columns = useGridColumns(); // Uses default responsive values
 * const customColumns = useGridColumns({ xs: 1, sm: 2, lg: 4 });
 */
export function useGridColumns(customColumns = null) {
  const columns = customColumns || RESPONSIVE_VALUES.gridColumns;
  return useBreakpointValue(columns, 1);
}

/**
 * useContainerWidth Hook
 * Returns appropriate container width for current breakpoint
 * 
 * @param {Object} customWidths - Custom width configuration per breakpoint
 * @returns {string} Container width for current breakpoint
 */
export function useContainerWidth(customWidths = null) {
  const widths = customWidths || RESPONSIVE_VALUES.containerWidth;
  return useBreakpointValue(widths, '100%');
}

/**
 * useGutter Hook
 * Returns appropriate gutter/spacing for current breakpoint
 * 
 * @param {Object} customGutter - Custom gutter configuration per breakpoint
 * @returns {number} Gutter size in pixels for current breakpoint
 */
export function useGutter(customGutter = null) {
  const gutter = customGutter || RESPONSIVE_VALUES.gutter;
  return useBreakpointValue(gutter, 16);
}

/**
 * useBreakpointClass Hook
 * Returns CSS class names based on current breakpoint
 * 
 * @param {Object} classMap - Object with breakpoint keys and class names
 * @param {string} baseClass - Base class name to always include
 * @returns {string} Space-separated class names
 * 
 * @example
 * const className = useBreakpointClass({
 *   xs: 'mobile-layout',
 *   lg: 'desktop-layout'
 * }, 'base-component');
 */
export function useBreakpointClass(classMap, baseClass = '') {
  const responsiveClass = useBreakpointValue(classMap, '');
  
  return useMemo(() => {
    const classes = [baseClass, responsiveClass].filter(Boolean);
    return classes.join(' ').trim();
  }, [baseClass, responsiveClass]);
}

/**
 * useBreakpointConfig Hook
 * Returns a complete responsive configuration object
 * Useful for components that need multiple responsive values
 * 
 * @param {Object} config - Configuration object with breakpoint mappings
 * @returns {Object} Current configuration values
 * 
 * @example
 * const config = useBreakpointConfig({
 *   columns: { xs: 1, sm: 2, lg: 3 },
 *   spacing: { xs: 8, sm: 12, lg: 16 },
 *   showSidebar: { xs: false, lg: true }
 * });
 * // Returns: { columns: 2, spacing: 12, showSidebar: false } (for sm breakpoint)
 */
export function useBreakpointConfig(config) {
  const { breakpoint } = useResponsive();
  
  return useMemo(() => {
    if (!config || typeof config !== 'object') {
      return {};
    }
    
    const result = {};
    
    Object.keys(config).forEach(key => {
      if (config[key] && typeof config[key] === 'object') {
        // This is a breakpoint mapping
        result[key] = config[key][breakpoint] !== undefined 
          ? config[key][breakpoint] 
          : null;
      } else {
        // This is a static value
        result[key] = config[key];
      }
    });
    
    return result;
  }, [config, breakpoint]);
}

/**
 * useIsBreakpoint Hook
 * Returns boolean for specific breakpoint checks
 * 
 * @param {string|Array} target - Breakpoint(s) to check against
 * @returns {boolean} True if current breakpoint matches any target
 * 
 * @example
 * const isMobile = useIsBreakpoint(['xs', 'sm']);
 * const isTablet = useIsBreakpoint('md');
 */
export function useIsBreakpoint(target) {
  const { breakpoint } = useResponsive();
  
  return useMemo(() => {
    if (Array.isArray(target)) {
      return target.includes(breakpoint);
    }
    return breakpoint === target;
  }, [breakpoint, target]);
}

export default useBreakpointValue;