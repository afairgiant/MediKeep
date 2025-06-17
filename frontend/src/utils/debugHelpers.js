import { useEffect, useRef } from 'react';

/*
React Component Debug Helper
============================

This script helps identify React component lifecycle issues that might
cause unexpected logouts in the admin dashboard.

It adds debugging hooks to detect:
1. Component unmounting without user action
2. State resets that might trigger logout
3. Navigation events that shouldn't cause logout
4. Token storage issues
*/

export const addDebugListeners = () => {
  // Track token changes in localStorage
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;

  localStorage.setItem = function (key, value) {
    if (key === 'token') {
      console.log('🔑 Token SET:', {
        timestamp: new Date().toISOString(),
        key,
        value: value?.substring(0, 20) + '...',
        stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
      });
    }
    return originalSetItem.apply(this, arguments);
  };

  localStorage.removeItem = function (key) {
    if (key === 'token') {
      console.log('🗑️ Token REMOVED:', {
        timestamp: new Date().toISOString(),
        key,
        stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
      });
    }
    return originalRemoveItem.apply(this, arguments);
  };
  // Track navigation events through performance API instead
  // (Avoiding direct history manipulation due to ESLint restrictions)

  // Track window events that might cause logout
  window.addEventListener('beforeunload', event => {
    console.log('🚪 Window beforeunload:', {
      timestamp: new Date().toISOString(),
      hasToken: !!localStorage.getItem('token'),
    });
  });

  window.addEventListener('unload', event => {
    console.log('🚪 Window unload:', {
      timestamp: new Date().toISOString(),
      hasToken: !!localStorage.getItem('token'),
    });
  });

  // Track visibility changes
  document.addEventListener('visibilitychange', () => {
    console.log('👁️ Visibility change:', {
      timestamp: new Date().toISOString(),
      hidden: document.hidden,
      hasToken: !!localStorage.getItem('token'),
    });
  });

  // Track focus events
  window.addEventListener('blur', () => {
    console.log('👁️ Window blur:', {
      timestamp: new Date().toISOString(),
      hasToken: !!localStorage.getItem('token'),
    });
  });

  window.addEventListener('focus', () => {
    console.log('👁️ Window focus:', {
      timestamp: new Date().toISOString(),
      hasToken: !!localStorage.getItem('token'),
    });
  });

  console.log('🐛 Debug listeners added - watching for logout triggers');
};

// React Hook for component lifecycle debugging
export const useComponentDebug = componentName => {
  const mountTime = useRef(Date.now());
  const renderCount = useRef(0);

  renderCount.current += 1;

  useEffect(() => {
    console.log(`🎯 ${componentName} MOUNTED:`, {
      timestamp: new Date().toISOString(),
      mountTime: mountTime.current,
    });

    return () => {
      console.log(`💀 ${componentName} UNMOUNTING:`, {
        timestamp: new Date().toISOString(),
        lifespan: Date.now() - mountTime.current,
        renderCount: renderCount.current,
        stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
      });
    };
  }, [componentName]);

  console.log(`🔄 ${componentName} RENDER #${renderCount.current}:`, {
    timestamp: new Date().toISOString(),
    timeSinceMount: Date.now() - mountTime.current,
  });
};
