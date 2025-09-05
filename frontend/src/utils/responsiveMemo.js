/**
 * Responsive Memoization Utilities
 * Optimized memoization functions for responsive calculations
 */

/**
 * Memoize function results based on breakpoint
 * Useful for expensive calculations that depend on breakpoint
 * 
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Memoization options
 * @param {number} options.maxSize - Maximum cache size (default: 10)
 * @param {boolean} options.serializeArgs - Whether to serialize arguments (default: true)
 * @returns {Function} Memoized function
 * 
 * @example
 * const calculateLayout = memoizeResponsive((breakpoint, itemCount) => {
 *   // Expensive calculation here
 *   return computeComplexLayout(breakpoint, itemCount);
 * });
 */
export function memoizeResponsive(fn, options = {}) {
  const { maxSize = 10, serializeArgs = true } = options;
  const cache = new Map();
  
  return function memoized(...args) {
    // Create cache key
    let key;
    if (serializeArgs) {
      try {
        key = JSON.stringify(args);
      } catch (e) {
        // Fallback for non-serializable args
        key = args.map(arg => String(arg)).join('|');
      }
    } else {
      key = args.join('|');
    }
    
    // Check cache
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    // Calculate result
    const result = fn.apply(this, args);
    
    // Store in cache
    if (cache.size >= maxSize) {
      // Remove oldest entry (FIFO)
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    
    return result;
  };
}

/**
 * Memoize function with breakpoint-specific cache invalidation
 * Cache is cleared when breakpoint changes
 * 
 * @param {Function} fn - Function to memoize
 * @param {string} currentBreakpoint - Current breakpoint
 * @param {Object} options - Memoization options
 * @returns {Function} Memoized function with breakpoint invalidation
 * 
 * @example
 * const { breakpoint } = useResponsive();
 * const calculateColumns = useMemo(() => 
 *   memoizeWithBreakpointInvalidation(
 *     (bp, itemCount) => computeColumns(bp, itemCount),
 *     breakpoint
 *   ), [breakpoint]
 * );
 */
export function memoizeWithBreakpointInvalidation(fn, currentBreakpoint, options = {}) {
  const { maxSize = 10 } = options;
  const cache = new Map();
  let lastBreakpoint = currentBreakpoint;
  
  return function memoized(...args) {
    // Clear cache if breakpoint changed
    if (currentBreakpoint !== lastBreakpoint) {
      cache.clear();
      lastBreakpoint = currentBreakpoint;
    }
    
    const key = JSON.stringify([currentBreakpoint, ...args]);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(currentBreakpoint, ...args);
    
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    
    return result;
  };
}

/**
 * Create a responsive value calculator with memoization
 * Optimizes repeated calculations of responsive values
 * 
 * @param {Object} breakpointMap - Map of breakpoint to value
 * @param {*} fallback - Fallback value
 * @returns {Function} Function that returns value for given breakpoint
 * 
 * @example
 * const getColumns = createResponsiveCalculator({
 *   xs: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4
 * }, 1);
 * 
 * const columns = getColumns('md'); // Returns 3
 */
export function createResponsiveCalculator(breakpointMap, fallback = null) {
  const cache = new Map();
  
  return function calculate(breakpoint) {
    if (cache.has(breakpoint)) {
      return cache.get(breakpoint);
    }
    
    const value = breakpointMap[breakpoint] !== undefined 
      ? breakpointMap[breakpoint] 
      : fallback;
      
    cache.set(breakpoint, value);
    return value;
  };
}

/**
 * Throttled memoization for high-frequency updates
 * Useful for resize-dependent calculations
 * 
 * @param {Function} fn - Function to memoize and throttle
 * @param {number} throttleMs - Throttle delay in milliseconds
 * @param {Object} options - Additional options
 * @returns {Function} Throttled and memoized function
 * 
 * @example
 * const calculateLayout = throttledMemo(
 *   (width, height) => computeLayout(width, height),
 *   100
 * );
 */
export function throttledMemo(fn, throttleMs = 100, options = {}) {
  const { maxSize = 10 } = options;
  const cache = new Map();
  let lastCall = 0;
  let lastResult = null;
  let lastArgs = null;
  
  return function throttledMemoized(...args) {
    const now = Date.now();
    const key = JSON.stringify(args);
    
    // Check cache first
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    // Check if we should throttle
    if (now - lastCall < throttleMs && lastArgs && JSON.stringify(lastArgs) === key) {
      return lastResult;
    }
    
    // Calculate new result
    const result = fn.apply(this, args);
    lastCall = now;
    lastResult = result;
    lastArgs = args;
    
    // Store in cache
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    
    return result;
  };
}

/**
 * Create a stable reference for responsive objects
 * Prevents unnecessary re-renders when object contents are the same
 * 
 * @param {Object} obj - Object to stabilize
 * @param {Array} deps - Dependencies for comparison
 * @returns {Object} Stable object reference
 * 
 * @example
 * const stableStyles = createStableReference({
 *   fontSize: fontSize,
 *   padding: padding
 * }, [fontSize, padding]);
 */
export function createStableReference(obj, deps) {
  const cache = new WeakMap();
  const depsKey = JSON.stringify(deps);
  
  if (cache.has(obj) && cache.get(obj).deps === depsKey) {
    return cache.get(obj).value;
  }
  
  const stableObj = { ...obj };
  cache.set(obj, { value: stableObj, deps: depsKey });
  
  return stableObj;
}

/**
 * Memoize CSS-in-JS styles based on responsive values
 * 
 * @param {Function} stylesFn - Function that returns styles object
 * @param {Array} deps - Dependencies for memoization
 * @returns {Function} Memoized styles function
 * 
 * @example
 * const getStyles = memoizeStyles((breakpoint, theme) => ({
 *   container: {
 *     padding: breakpoint === 'xs' ? 8 : 16,
 *     backgroundColor: theme.colors.background
 *   }
 * }), [breakpoint, theme]);
 */
export function memoizeStyles(stylesFn, deps) {
  let lastDeps = null;
  let lastResult = null;
  
  return function memoizedStyles(...args) {
    const currentDeps = JSON.stringify(deps);
    
    if (lastDeps === currentDeps && lastResult) {
      return lastResult;
    }
    
    lastResult = stylesFn(...args);
    lastDeps = currentDeps;
    
    return lastResult;
  };
}

export default memoizeResponsive;