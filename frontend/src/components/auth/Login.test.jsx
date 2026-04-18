import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import Login from '../../pages/auth/Login';
import render from '../../test-utils/render';

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

vi.spyOn(authService, 'checkRegistrationEnabled');
vi.spyOn(authService, 'getSSOConfig');

describe('Login Component', () => {
  // Re-apply default implementations every test. clearAllMocks() only clears
  // call history, so a mockImplementation set in one test would otherwise leak
  // into the next test that doesn't override it (especially risky for the
  // deferred-promise test, which would hang a subsequent test forever).
  beforeEach(() => {
    vi.clearAllMocks();
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: true,
    });
    authService.getSSOConfig.mockResolvedValue({ enabled: false });
  });

  describe('Login Form', () => {
    test('renders login form with required fields', () => {
      render(<Login />);

      expect(document.getElementById('username')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(
        document.querySelector('button[type="submit"]')
      ).toBeInTheDocument();
    });

    test('hides registration UI until config loads, then shows create account button', async () => {
      // Use deferred promises to control when config resolves
      let resolveRegistration;
      let resolveSSO;
      authService.checkRegistrationEnabled.mockImplementation(
        () =>
          new Promise(r => {
            resolveRegistration = r;
          })
      );
      authService.getSSOConfig.mockImplementation(
        () =>
          new Promise(r => {
            resolveSSO = r;
          })
      );

      render(<Login />);

      // Before config loads: button must NOT be in the document
      expect(screen.queryByText('login.createAccount')).not.toBeInTheDocument();

      // Resolve both config fetches
      resolveRegistration({ registration_enabled: true });
      resolveSSO({ enabled: false });

      // After config loads: button appears
      expect(
        await screen.findByText('login.createAccount')
      ).toBeInTheDocument();
    });

    test('shows SSO button when backend returns enabled:true', async () => {
      authService.checkRegistrationEnabled.mockResolvedValue({
        registration_enabled: true,
      });
      authService.getSSOConfig.mockResolvedValue({
        enabled: true,
        provider_type: 'github',
      });

      render(<Login />);

      // SSO section wrapper should appear once config resolves
      const ssoSection = await screen.findByTestId('sso-section');
      expect(ssoSection).toBeInTheDocument();
      // No config-error notice on the happy path
      expect(screen.queryByTestId('config-error')).not.toBeInTheDocument();
    });

    test('shows retry notice when SSO config fetch fails (not the SSO button)', async () => {
      // Simulate the service layer's new error contract: fetch failed,
      // not "backend said SSO is off"
      authService.checkRegistrationEnabled.mockResolvedValue({
        registration_enabled: false,
        error: true,
      });
      authService.getSSOConfig.mockResolvedValue({
        enabled: false,
        error: true,
      });

      render(<Login />);

      // Config-error notice is visible; SSO section is not
      expect(await screen.findByTestId('config-error')).toBeInTheDocument();
      expect(screen.queryByTestId('sso-section')).not.toBeInTheDocument();
      // Registration-disabled message should NOT be shown in the error state
      // (we don't actually know whether registration is disabled)
      expect(
        screen.queryByText('login.registrationDisabled')
      ).not.toBeInTheDocument();
    });

    test('does NOT show retry notice when backend genuinely returns SSO disabled', async () => {
      authService.checkRegistrationEnabled.mockResolvedValue({
        registration_enabled: true,
      });
      authService.getSSOConfig.mockResolvedValue({ enabled: false });

      render(<Login />);

      // Create-account button appears (registration is enabled)
      expect(
        await screen.findByText('login.createAccount')
      ).toBeInTheDocument();
      // No SSO section, no error notice — genuine disabled state
      expect(screen.queryByTestId('sso-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('config-error')).not.toBeInTheDocument();
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
