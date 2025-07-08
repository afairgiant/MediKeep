import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/auth/Login';
import render from '../../test-utils/render';
import { createMockUser } from '../../test-utils/test-data';

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

// Mock toast notifications
jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Form', () => {
    test('renders login form with required fields', () => {
      render(<Login />);

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('renders create account button', () => {
      render(<Login />);

      expect(screen.getByText(/create new.*account/i)).toBeInTheDocument();
    });

    test('renders with Medical Records System title', () => {
      render(<Login />);

      expect(screen.getByText(/medical records system/i)).toBeInTheDocument();
    });

    test('renders form inputs correctly', () => {
      render(<Login />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(usernameInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(usernameInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('Component Structure', () => {
    test('renders with auth context', () => {
      render(<Login />, {
        authContextValue: {
          isLoading: false,
          error: null,
        },
      });

      expect(screen.getByText(/medical records system/i)).toBeInTheDocument();
    });

    test('renders with app data context', () => {
      render(<Login />, {
        appDataContextValue: {
          isLoading: false,
        },
      });

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    test('has proper form structure', () => {
      render(<Login />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    test('renders login container with proper styling', () => {
      render(<Login />);

      expect(document.querySelector('.login-container')).toBeInTheDocument();
      expect(document.querySelector('.login-form')).toBeInTheDocument();
    });
  });
});