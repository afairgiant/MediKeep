import React from 'react';
import { useViewportSize } from '@mantine/hooks';
import { BREAKPOINTS } from '../config/navigation.config';

/**
 * Custom hook for consistent viewport detection across the app
 * Returns viewport type and specific boolean flags
 */
export const useViewport = () => {
  const { width, height } = useViewportSize();
  
  // Determine viewport type
  let viewport = 'mobile';
  if (width >= BREAKPOINTS.desktop) {
    viewport = 'desktop';
  } else if (width >= BREAKPOINTS.laptop) {
    viewport = 'laptop';
  } else if (width >= BREAKPOINTS.mobile) {
    viewport = 'tablet';
  }
  
  
  return {
    // Raw values
    width,
    height,
    
    // Viewport type
    viewport,
    
    // Boolean flags for convenience
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.laptop,
    isLaptop: width >= BREAKPOINTS.laptop && width < BREAKPOINTS.desktop,
    isDesktop: width >= BREAKPOINTS.desktop,
    
    // Utility flags
    isTouchDevice: width < BREAKPOINTS.laptop, // Mobile and tablet
    isCompact: width < BREAKPOINTS.desktop, // Mobile, tablet, and laptop
    
    // Breakpoint values for reference
    breakpoints: BREAKPOINTS,
  };
};

// Helper hook for media query matching
export const useMediaQuery = (query) => {
  const [matches, setMatches] = React.useState(false);
  
  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    
    const handler = (e) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);
  
  return matches;
};