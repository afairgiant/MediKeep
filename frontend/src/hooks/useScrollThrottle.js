import { useEffect, useRef, useCallback } from 'react';
import logger from '../services/logger';

/**
 * Custom hook to throttle scroll events and prevent excessive positioning calculations
 * Particularly useful for dropdown components in scrollable containers
 */
export const useScrollThrottle = (callback, delay = 16, deps = []) => {
  const timeoutRef = useRef(null);
  const lastExecutionRef = useRef(0);
  const frameRef = useRef(null);

  // Create a throttled callback
  const throttledCallback = useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionRef.current;

    // Clear any pending timeout/frame
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    // If enough time has passed, execute immediately
    if (timeSinceLastExecution >= delay) {
      lastExecutionRef.current = now;
      callback(...args);
    } else {
      // Otherwise, schedule for later
      const remainingTime = delay - timeSinceLastExecution;
      
      // Use requestAnimationFrame for smoother performance if delay is short
      if (remainingTime <= 16) {
        frameRef.current = requestAnimationFrame(() => {
          lastExecutionRef.current = Date.now();
          callback(...args);
        });
      } else {
        timeoutRef.current = setTimeout(() => {
          lastExecutionRef.current = Date.now();
          callback(...args);
        }, remainingTime);
      }
    }
  }, [callback, delay, ...deps]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return throttledCallback;
};

/**
 * Hook to add throttled scroll listeners specifically for dropdown positioning
 */
export const useDropdownScrollOptimization = (isOpen, isInScrollableContainer = false) => {
  const scrollListenerRef = useRef(null);
  const dropdownElementRef = useRef(null);

  // Throttled scroll handler to minimize positioning calculations
  const handleScroll = useScrollThrottle((e) => {
    if (!isOpen || !isInScrollableContainer) return;

    // Log excessive scroll events in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Throttled scroll event for dropdown', {
        component: 'useDropdownScrollOptimization',
        scrollTop: e.target.scrollTop,
        isInScrollableContainer
      });
    }

    // Temporarily hide dropdown during rapid scrolling to prevent lag
    if (dropdownElementRef.current) {
      dropdownElementRef.current.style.visibility = 'hidden';
      
      // Show it again after scroll stops
      clearTimeout(scrollListenerRef.current);
      scrollListenerRef.current = setTimeout(() => {
        if (dropdownElementRef.current) {
          dropdownElementRef.current.style.visibility = 'visible';
        }
      }, 100);
    }
  }, 16); // 60fps throttling

  useEffect(() => {
    if (!isOpen || !isInScrollableContainer) return;

    // Find the dropdown element
    const findDropdown = () => {
      const dropdown = document.querySelector('[data-mantine-dropdown]');
      if (dropdown) {
        dropdownElementRef.current = dropdown;
      }
    };

    // Wait a bit for dropdown to mount
    const findTimer = setTimeout(findDropdown, 50);

    // Add passive scroll listeners to all scrollable containers
    const scrollableElements = [
      window,
      document.querySelector('[data-mantine-modal]'),
      ...document.querySelectorAll('.mantine-ScrollArea-viewport')
    ].filter(Boolean);

    scrollableElements.forEach(element => {
      element.addEventListener('scroll', handleScroll, { passive: true });
      element.addEventListener('wheel', handleScroll, { passive: true });
    });

    return () => {
      clearTimeout(findTimer);
      clearTimeout(scrollListenerRef.current);
      
      scrollableElements.forEach(element => {
        element.removeEventListener('scroll', handleScroll);
        element.removeEventListener('wheel', handleScroll);
      });
    };
  }, [isOpen, isInScrollableContainer, handleScroll]);

  return dropdownElementRef;
};

export default useScrollThrottle;