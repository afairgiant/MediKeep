import { useContext } from 'react';
import ResponsiveContext from '../contexts/ResponsiveContext';

/**
 * useResponsive Hook
 * Provides access to responsive state and utilities
 * 
 * @throws {Error} If used outside of ResponsiveProvider
 * @returns {Object} Responsive state and helper functions
 * 
 * @example
 * const { breakpoint, isMobile, isAbove } = useResponsive();
 * 
 * if (isMobile) {
 *   return <MobileComponent />;
 * }
 * 
 * if (isAbove('md')) {
 *   return <DesktopComponent />;
 * }
 */
export function useResponsive() {
  const context = useContext(ResponsiveContext);
  
  if (!context) {
    throw new Error(
      'useResponsive must be used within a ResponsiveProvider. ' +
      'Make sure your component is wrapped with ResponsiveProvider.'
    );
  }
  
  return context;
}

/**
 * useBreakpoint Hook
 * Returns only the current breakpoint string
 * Optimized for components that only need breakpoint info
 * 
 * @returns {string} Current breakpoint (xs, sm, md, lg, xl, xxl)
 * 
 * @example
 * const breakpoint = useBreakpoint();
 * const columns = breakpoint === 'xs' ? 1 : 2;
 */
export function useBreakpoint() {
  const { breakpoint } = useResponsive();
  return breakpoint;
}

/**
 * useDeviceType Hook
 * Returns only the device type
 * 
 * @returns {string} Device type (mobile, tablet, desktop)
 * 
 * @example
 * const deviceType = useDeviceType();
 * const showSidebar = deviceType === 'desktop';
 */
export function useDeviceType() {
  const { deviceType } = useResponsive();
  return deviceType;
}

/**
 * useViewportSize Hook
 * Returns only viewport dimensions
 * 
 * @returns {Object} { width, height }
 * 
 * @example
 * const { width, height } = useViewportSize();
 * const aspectRatio = width / height;
 */
export function useViewportSize() {
  const { width, height } = useResponsive();
  return { width, height };
}

/**
 * useMobileFirst Hook
 * Provides mobile-first responsive utilities
 * 
 * @returns {Object} Mobile-first helper functions
 * 
 * @example
 * const { isSmallAndUp, isMediumAndUp } = useMobileFirst();
 */
export function useMobileFirst() {
  const { isAbove, matches } = useResponsive();
  
  return {
    isSmallAndUp: matches('sm') || isAbove('sm'),
    isMediumAndUp: matches('md') || isAbove('md'),
    isLargeAndUp: matches('lg') || isAbove('lg'),
    isExtraLargeAndUp: matches('xl') || isAbove('xl'),
    isExtraExtraLargeAndUp: matches('xxl') || isAbove('xxl')
  };
}

/**
 * useDesktopFirst Hook
 * Provides desktop-first responsive utilities
 * 
 * @returns {Object} Desktop-first helper functions
 * 
 * @example
 * const { isLargeAndDown, isMediumAndDown } = useDesktopFirst();
 */
export function useDesktopFirst() {
  const { isBelow, matches } = useResponsive();
  
  return {
    isExtraExtraLargeAndDown: true, // Always true
    isExtraLargeAndDown: matches('xl') || isBelow('xl'),
    isLargeAndDown: matches('lg') || isBelow('lg'),
    isMediumAndDown: matches('md') || isBelow('md'),
    isSmallAndDown: matches('sm') || isBelow('sm'),
    isExtraSmallOnly: matches('xs')
  };
}

export default useResponsive;