// jest-dom adds custom matchers for asserting on DOM nodes (works with Vitest too!)
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { expect, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { configure } from '@testing-library/react';

// Mock i18next to prevent HTTP requests in tests
vi.mock('./i18n/config', () => ({
  default: {
    t: (key) => key,
    use: () => ({ init: () => Promise.resolve() }),
    init: () => Promise.resolve(),
    changeLanguage: () => Promise.resolve(),
    language: 'en',
    isInitialized: true,
  },
}));

// Mock react-i18next hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      language: 'en',
      changeLanguage: () => Promise.resolve(),
    },
  }),
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

// Mock user preferences API globally for all tests
vi.mock('./services/api/userPreferencesApi', () => ({
  getUserPreferences: vi.fn(() =>
    Promise.resolve({
      unit_system: 'imperial',
      session_timeout_minutes: 30,
      date_format: 'mdy',
      paperless_enabled: false,
      language: 'en',
    })
  ),
  updateUserPreferences: vi.fn(prefs => Promise.resolve(prefs)),
}));

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  // Increase timeout for async operations
  asyncUtilTimeout: 5000,
});

// Mock window.matchMedia for components that use responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver for Mantine components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch if not using MSW for specific test
global.fetch = vi.fn();

// Console error suppression for known warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is deprecated') ||
        args[0].includes('Warning: An invalid form control') ||
        args[0].includes('Warning: findDOMNode is deprecated'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: `ReactDOMTestUtils.act` is deprecated')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

// Setup MSW server
import { server } from './test-utils/mocks/server';

// Establish API mocking before all tests
beforeAll(() => server.listen({
  onUnhandledRequest: 'error',
}));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
  // Clear all mocks
  vi.clearAllMocks();
  // Clear localStorage/sessionStorage
  localStorage.clear();
  sessionStorage.clear();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
  console.error = originalError;
  console.warn = originalWarn;
});
