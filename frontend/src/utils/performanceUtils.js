/**
 * Performance utilities for measuring and optimizing React components
 */

/**
 * Simple performance timer for measuring component render times
 */
export class PerformanceTimer {
  constructor(label) {
    this.label = label;
    this.startTime = null;
  }

  start() {
    this.startTime = performance.now();
    if (process.env.NODE_ENV === 'development') {
      console.time(this.label);
    }
  }

  end() {
    if (this.startTime) {
      const duration = performance.now() - this.startTime;
      if (process.env.NODE_ENV === 'development') {
        console.timeEnd(this.label);
        if (duration > 16) { // Flag renders taking longer than a frame (16.67ms)
          console.warn(`⚠️ Slow render detected: ${this.label} took ${duration.toFixed(2)}ms`);
        }
      }
      this.startTime = null;
      return duration;
    }
    return 0;
  }
}

/**
 * Hook to measure component render performance
 */
export const useRenderPerformance = (componentName) => {
  if (process.env.NODE_ENV !== 'development') {
    return () => {}; // No-op in production
  }

  let renderCount = 0;
  let totalTime = 0;

  return () => {
    const timer = new PerformanceTimer(`${componentName} render #${++renderCount}`);
    
    // Start timer
    timer.start();
    
    // Return cleanup function
    return () => {
      const duration = timer.end();
      totalTime += duration;
      
      if (renderCount % 10 === 0) {
        console.log(`📊 ${componentName} performance summary:`, {
          renderCount,
          averageTime: (totalTime / renderCount).toFixed(2) + 'ms',
          totalTime: totalTime.toFixed(2) + 'ms'
        });
      }
    };
  };
};

/**
 * Utility to measure DOM operations performance
 */
export const measureDOMOperation = (label, operation) => {
  if (process.env.NODE_ENV !== 'development') {
    return operation();
  }

  const timer = new PerformanceTimer(`DOM: ${label}`);
  timer.start();
  
  try {
    const result = operation();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
};

/**
 * Memory usage tracker for development
 */
export const logMemoryUsage = (label) => {
  if (process.env.NODE_ENV !== 'development' || !performance.memory) {
    return;
  }

  const memory = performance.memory;
  console.log(`🧠 Memory usage (${label}):`, {
    used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
    total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
    limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
  });
};

/**
 * Debounce utility for expensive operations
 */
export const createDebouncer = (delay = 300) => {
  let timeoutId = null;
  
  return (callback) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(callback, delay);
    
    // Return cancel function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  };
};

/**
 * Throttle utility for high-frequency events
 */
export const createThrottler = (delay = 100) => {
  let lastCall = 0;
  
  return (callback) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return callback();
    }
  };
};

export default {
  PerformanceTimer,
  useRenderPerformance,
  measureDOMOperation,
  logMemoryUsage,
  createDebouncer,
  createThrottler
};