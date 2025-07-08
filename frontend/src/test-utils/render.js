import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import AuthContext from '../contexts/AuthContext';
import { AppDataContext } from '../contexts/AppDataContext';
import { MantineIntegratedThemeProvider } from '../contexts/ThemeContext';

// Mock auth context values
const defaultAuthContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
};

// Mock app data context values
const defaultAppDataContext = {
  currentPatient: null,
  practitioners: [],
  refreshPatient: jest.fn(),
  refreshPractitioners: jest.fn(),
  isLoading: false,
  error: null,
};

// Custom render function
function render(
  ui,
  {
    // Auth context overrides
    authContextValue = {},
    // App data context overrides
    appDataContextValue = {},
    // Router options
    initialEntries = ['/'],
    // Skip router wrapper (for components that include their own router)
    skipRouter = false,
    // Mantine theme overrides
    mantineTheme = {},
    // RTL render options
    ...renderOptions
  } = {}
) {
  const mergedAuthContext = { ...defaultAuthContext, ...authContextValue };
  const mergedAppDataContext = { ...defaultAppDataContext, ...appDataContextValue };

  function Wrapper({ children }) {
    const content = (
      <MantineProvider theme={mantineTheme}>
        <MantineIntegratedThemeProvider>
          <AuthContext.Provider value={mergedAuthContext}>
            <AppDataContext.Provider value={mergedAppDataContext}>
              {children}
            </AppDataContext.Provider>
          </AuthContext.Provider>
        </MantineIntegratedThemeProvider>
      </MantineProvider>
    );

    if (skipRouter) {
      return content;
    }

    return (
      <BrowserRouter initialEntries={initialEntries}>
        {content}
      </BrowserRouter>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Render with authenticated user
export function renderWithAuth(ui, options = {}) {
  const authUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
  };

  return render(ui, {
    authContextValue: {
      user: authUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
    ...options,
  });
}

// Render with admin user
export function renderWithAdmin(ui, options = {}) {
  const adminUser = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    full_name: 'Admin User',
    role: 'admin',
  };

  return render(ui, {
    authContextValue: {
      user: adminUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
    ...options,
  });
}

// Render with patient data
export function renderWithPatient(ui, patientData = {}, options = {}) {
  const defaultPatient = {
    id: 1,
    user_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    birth_date: '1990-01-01',
    gender: 'M',
    address: '123 Main St',
    blood_type: 'A+',
    height: 70,
    weight: 180,
    physician_id: null,
  };

  const mergedPatient = { ...defaultPatient, ...patientData };

  return renderWithAuth(ui, {
    appDataContextValue: {
      currentPatient: mergedPatient,
      isLoading: false,
      error: null,
    },
    ...options,
  });
}

// Render with loading state
export function renderWithLoading(ui, options = {}) {
  return render(ui, {
    authContextValue: {
      isLoading: true,
    },
    appDataContextValue: {
      isLoading: true,
    },
    ...options,
  });
}

// Render with error state
export function renderWithError(ui, error = 'Test error', options = {}) {
  return render(ui, {
    authContextValue: {
      error,
      isLoading: false,
    },
    ...options,
  });
}

// Re-export everything from RTL
export * from '@testing-library/react';

// Override the default export
export { render as default };