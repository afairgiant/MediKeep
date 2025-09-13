/**
 * Debounce utility function
 * Delays the execution of a function until after a specified delay has passed
 * since the last time it was invoked
 */

/**
 * Creates a debounced version of a function
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @param {Object} options - Additional options
 * @param {boolean} options.leading - Execute on the leading edge of the timeout
 * @param {boolean} options.trailing - Execute on the trailing edge of the timeout
 * @returns {Function} The debounced function with cancel method
 */
export function debounce(func, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = null;
  let result = null;
  
  function invokeFunc() {
    const args = lastArgs;
    const thisArg = lastThis;
    
    lastArgs = null;
    lastThis = null;
    result = func.apply(thisArg, args);
    return result;
  }
  
  function leadingEdge() {
    // Reset any trailing edge timer
    timeoutId = setTimeout(timerExpired, delay);
    // Invoke the function on the leading edge if specified
    return leading ? invokeFunc() : result;
  }
  
  function timerExpired() {
    timeoutId = null;
    // Only invoke if we have lastArgs which means func has been called
    // during the delay period
    if (trailing && lastArgs) {
      return invokeFunc();
    }
    lastArgs = lastThis = null;
    return result;
  }
  
  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;
    
    if (isInvoking) {
      if (!timeoutId) {
        return leadingEdge();
      }
      // Reset the timer
      clearTimeout(timeoutId);
      timeoutId = setTimeout(timerExpired, delay);
    }
    
    return result;
  }
  
  function shouldInvoke(time) {
    return lastCallTime === null || (time - lastCallTime >= delay);
  }
  
  /**
   * Cancel any pending debounced invocations
   */
  debounced.cancel = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastThis = null;
    lastCallTime = null;
  };
  
  /**
   * Immediately invoke any pending debounced invocations
   */
  debounced.flush = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      if (lastArgs) {
        invokeFunc();
      }
      timeoutId = null;
    }
    return result;
  };
  
  /**
   * Check if there are any pending invocations
   */
  debounced.pending = function() {
    return timeoutId !== null;
  };
  
  return debounced;
}

/**
 * Simple debounce for common use cases
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} The debounced function
 */
export function simpleDebounce(func, delay) {
  let timeoutId;
  
  const debounced = function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
  
  debounced.cancel = function() {
    clearTimeout(timeoutId);
  };
  
  return debounced;
}

export default debounce;