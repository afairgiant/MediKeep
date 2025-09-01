import { useState, useEffect, useRef } from 'react';

/**
 * Optimized hook for tracking window dimensions with debounced updates
 * Prevents excessive re-renders and performance issues from constant window size checks
 */
export const useWindowDimensions = (debounceMs = 100) => {
  const [dimensions, setDimensions] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    isSmallScreen: window.innerHeight < 800,
    isMobileWidth: window.innerWidth < 768,
    isTabletWidth: window.innerWidth < 1024,
  }));
  
  const timeoutRef = useRef(null);

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
        
        setDimensions(prev => {
          const newDimensions = {
            width: newWidth,
            height: newHeight,
            isSmallScreen: newHeight < 800,
            isMobileWidth: newWidth < 768,
            isTabletWidth: newWidth < 1024,
          };
          
          // Only update if dimensions actually changed significantly (prevent micro-updates)
          if (
            Math.abs(prev.width - newWidth) > 5 || 
            Math.abs(prev.height - newHeight) > 5 ||
            prev.isSmallScreen !== newDimensions.isSmallScreen ||
            prev.isMobileWidth !== newDimensions.isMobileWidth ||
            prev.isTabletWidth !== newDimensions.isTabletWidth
          ) {
            return newDimensions;
          }
          return prev;
        });
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [debounceMs]);

  return dimensions;
};

export default useWindowDimensions;