import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/auth/Login';
import render from '../../test-utils/render';
import { createMockUser } from '../../test-utils/test-data';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

// Mock toast notifications
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Spy on authService config endpoints (keeps prototype methods intact)
import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'checkRegistrationEnabled').mockResolvedValue({
  registration_enabled: true,
});
vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Form', () => {
    test('renders login form with required fields', () => {
      render(<Login />);

      expect(document.getElementById('username')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.querySelector('button[type="submit"]')).toBeInTheDocument();
    });

    test('hides registration UI until config loads, then shows create account button', async () => {
      // Use deferred promises to control when config resolves
      let resolveRegistration;
      let resolveSSO;
      authService.checkRegistrationEnabled.mockImplementation(
        () => new Promise(r => { resolveRegistration = r; })
      );
      authService.getSSOConfig.mockImplementation(
        () => new Promise(r => { resolveSSO = r; })
      );

      render(<Login />);

      // Before config loads: button must NOT be in the document
      expect(screen.queryByText('auth.login.createAccount')).not.toBeInTheDocument();

      // Resolve both config fetches
      resolveRegistration({ registration_enabled: true });
      resolveSSO({ enabled: false });

      // After config loads: button appears
      expect(await screen.findByText('auth.login.createAccount')).toBeInTheDocument();
    });

    test('renders with MediKeep title', () => {
      render(<Login />);

      expect(screen.getByText(/medikeep/i)).toBeInTheDocument();
    });

    test('renders form inputs correctly', () => {
      render(<Login />);

      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');

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

      expect(screen.getByText(/medikeep/i)).toBeInTheDocument();
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

      // CSS Modules hash class names, so check for partial class match
      const container = document.querySelector('[class*="loginContainer"]');
      const form = document.querySelector('[class*="loginForm"]');
      expect(container).toBeInTheDocument();
      expect(form).toBeInTheDocument();
    });
  });
});
