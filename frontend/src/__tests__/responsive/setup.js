// Jest setup file for responsive tests
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';

// Polyfills for jsdom environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window.matchMedia (required for responsive testing)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};

// Mock IntersectionObserver for virtual scrolling tests
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};

// Mock window.requestAnimationFrame
global.requestAnimationFrame = (cb) => {
  return setTimeout(cb, 16); // 60fps = 16ms
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock performance.now for consistent timing in tests
const mockPerformanceNow = jest.fn(() => Date.now());
global.performance = {
  ...global.performance,
  now: mockPerformanceNow,
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000
  }
};

// Mock window.getComputedStyle for style testing
global.getComputedStyle = jest.fn().mockImplementation((element) => ({
  getPropertyValue: jest.fn().mockReturnValue(''),
  minHeight: '44px',
  fontSize: '16px',
  padding: '16px',
  fontWeight: '400',
  // Add more CSS properties as needed
  ...element.style
}));

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

// Mock window.scrollTo
window.scrollTo = jest.fn();

// Mock HTMLElement.getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn().mockImplementation(() => ({
  width: 120,
  height: 44,
  top: 0,
  left: 0,
  bottom: 44,
  right: 120,
  x: 0,
  y: 0,
  toJSON: jest.fn()
}));

// Mock HTMLElement.scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock focus and blur for form testing
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock clipboard API for copy/paste tests
global.navigator.clipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue('')
};

// Mock touch events for mobile testing
global.TouchEvent = class TouchEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.touches = eventInitDict.touches || [];
    this.targetTouches = eventInitDict.targetTouches || [];
    this.changedTouches = eventInitDict.changedTouches || [];
  }
};

// Enhanced console methods for test debugging
const originalConsole = { ...console };
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  // Keep warnings and errors visible
  warn: originalConsole.warn,
  error: originalConsole.error,
  info: originalConsole.info
};

// Performance measurement utilities
global.measureRenderTime = (renderFn) => {
  const start = performance.now();
  const result = renderFn();
  const end = performance.now();
  return {
    result,
    duration: end - start
  };
};

// Cleanup function to run after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset performance mock
  mockPerformanceNow.mockClear();
  
  // Reset window dimensions to default
  window.innerWidth = 1024;
  window.innerHeight = 768;
  
  // Clear any remaining timers
  jest.clearAllTimers();
});

// Global test utilities available in all responsive tests
global.testUtils = {
  // Viewport presets for consistent testing
  viewports: {
    mobile: { width: 375, height: 667 },
    mobileLarge: { width: 414, height: 896 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
    desktopLarge: { width: 1920, height: 1080 }
  },
  
  // Common test data generators
  generateMockData: (type, count = 1) => {
    const generators = {
      medication: (index) => ({
        id: index,
        medication_name: `Medication ${index}`,
        dosage: `${(index + 1) * 10}mg`,
        frequency: index % 2 === 0 ? 'Once daily' : 'Twice daily',
        prescribing_practitioner: `Dr. ${String.fromCharCode(65 + (index % 26))}`,
        start_date: '2024-01-01',
        status: index % 3 === 0 ? 'Discontinued' : 'Active'
      }),
      
      allergy: (index) => ({
        id: index,
        allergen: `Allergen ${index}`,
        reaction_type: 'Skin rash',
        severity: ['Mild', 'Moderate', 'Severe'][index % 3],
        notes: `Test allergy notes ${index}`
      }),
      
      condition: (index) => ({
        id: index,
        condition_name: `Condition ${index}`,
        diagnosis_date: '2024-01-01',
        status: ['Active', 'Resolved', 'Chronic'][index % 3],
        notes: `Test condition notes ${index}`
      })
    };
    
    return Array.from({ length: count }, (_, i) => generators[type](i + 1));
  },
  
  // Performance assertion helpers
  assertPerformance: {
    renderTime: (duration, maxMs = 100) => {
      expect(duration).toBeLessThan(maxMs);
    },
    
    memoryUsage: (before, after, maxIncreaseMB = 10) => {
      const increaseMB = (after - before) / (1024 * 1024);
      expect(increaseMB).toBeLessThan(maxIncreaseMB);
    }
  }
};

// Error boundary for catching React errors in tests
class TestErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Test Error: {this.state.error?.message}</div>;
    }

    return this.props.children;
  }
}

global.TestErrorBoundary = TestErrorBoundary;

// Suppress specific warnings in test environment
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress known warnings that don't affect functionality
  const suppressedWarnings = [
    'React does not recognize the',
    'componentWillReceiveProps has been renamed',
    'componentWillMount has been renamed'
  ];
  
  if (suppressedWarnings.some(warning => args[0]?.includes(warning))) {
    return;
  }
  
  originalWarn.apply(console, args);
};

// Set up fake timers for animations and debouncing
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

export default {};