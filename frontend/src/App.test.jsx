import { vi } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import App from './App';
import render from './test-utils/render';

// Mock the auth service
vi.mock('./services/auth/simpleAuthService', () => ({
  authService: {
    getToken: vi.fn(() => null),
    getCurrentUser: vi.fn(() => null),
  },
}));

describe('App Component', () => {
  test('renders app with error boundary', () => {
    render(<App />, { skipRouter: true });
    
    // Should render the main app container
    expect(screen.getByText(/Medical Records System/i)).toBeInTheDocument();
  });

  test('renders with authentication context', () => {
    render(<App />, {
      skipRouter: true,
      authContextValue: {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'user',
        },
        isAuthenticated: true,
      },
    });

    // Should render the main app
    expect(screen.getByText(/Medical Records System/i)).toBeInTheDocument();
  });

  test('renders with theme provider', () => {
    render(<App />, {
      skipRouter: true,
      authContextValue: {
        isLoading: false,
      },
    });

    // Should render the app with Mantine theme
    expect(screen.getByText(/Medical Records System/i)).toBeInTheDocument();
  });

  test('renders app structure correctly', () => {
    render(<App />, {
      skipRouter: true,
    });

    // Should have the App class
    expect(document.querySelector('.App')).toBeInTheDocument();
  });
});

