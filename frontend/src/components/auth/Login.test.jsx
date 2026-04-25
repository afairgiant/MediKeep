import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      // not "backend said SSO is off". The Login page auto-retries with
      // backoff (~5s total) before surfacing the error, so extend the
      // findByTestId timeout past the full retry window.
      authService.checkRegistrationEnabled.mockResolvedValue({
        registration_enabled: false,
        error: true,
      });
      authService.getSSOConfig.mockResolvedValue({
        enabled: false,
        error: true,
      });

      render(<Login />);

      // Config-error notice appears only after all retry attempts exhaust.
      expect(
        await screen.findByTestId('config-error', {}, { timeout: 8000 })
      ).toBeInTheDocument();
      expect(screen.queryByTestId('sso-section')).not.toBeInTheDocument();
      // Registration-disabled message should NOT be shown in the error state
      // (we don't actually know whether registration is disabled)
      expect(
        screen.queryByText('login.registrationDisabled')
      ).not.toBeInTheDocument();
    }, 10000);

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

    test('auto-retries silently when first config fetch fails and shows SSO once recovered', async () => {
      // First attempt: both fetches report fetch-failure. Second attempt
      // (after the 500ms backoff): both succeed. The user must never see
      // the config-error notice during this recovery window.
      authService.checkRegistrationEnabled
        .mockResolvedValueOnce({ registration_enabled: false, error: true })
        .mockResolvedValue({ registration_enabled: true });
      authService.getSSOConfig
        .mockResolvedValueOnce({ enabled: false, error: true })
        .mockResolvedValue({ enabled: true, provider_type: 'google' });

      render(<Login />);

      // Longer timeout to cover the 500ms backoff + async retry.
      const ssoSection = await screen.findByTestId(
        'sso-section',
        {},
        { timeout: 3000 }
      );
      expect(ssoSection).toBeInTheDocument();
      expect(screen.queryByTestId('config-error')).not.toBeInTheDocument();
      expect(authService.checkRegistrationEnabled).toHaveBeenCalledTimes(2);
      expect(authService.getSSOConfig).toHaveBeenCalledTimes(2);
    });

    test('attempts 4 total fetches (1 initial + 3 retries) before giving up', async () => {
      // All attempts fail -- the page lands on the config-error state after
      // the full 5s backoff window. Using real timers here keeps the test
      // stable against library internals that rely on setInterval polling.
      authService.checkRegistrationEnabled.mockResolvedValue({
        registration_enabled: false,
        error: true,
      });
      authService.getSSOConfig.mockResolvedValue({
        enabled: false,
        error: true,
      });

      render(<Login />);

      expect(
        await screen.findByTestId('config-error', {}, { timeout: 8000 })
      ).toBeInTheDocument();
      expect(authService.checkRegistrationEnabled).toHaveBeenCalledTimes(4);
      expect(authService.getSSOConfig).toHaveBeenCalledTimes(4);
    }, 10000);

    test('window online event short-circuits pending backoff and re-fetches', async () => {
      // First attempt fails; subsequent attempts would succeed. Without an
      // online event we'd wait 500ms for the first retry. Firing online
      // immediately after the initial failure should cancel the backoff and
      // trigger the next fetch well inside that window.
      authService.checkRegistrationEnabled
        .mockResolvedValueOnce({ registration_enabled: false, error: true })
        .mockResolvedValue({ registration_enabled: true });
      authService.getSSOConfig
        .mockResolvedValueOnce({ enabled: false, error: true })
        .mockResolvedValue({ enabled: true, provider_type: 'github' });

      render(<Login />);

      // Wait for the first (failing) attempt to complete.
      await waitFor(() => {
        expect(authService.getSSOConfig).toHaveBeenCalledTimes(1);
      });

      // Confirm we're still inside the 500ms backoff (no second call yet).
      // If the backoff elapses on its own, the test would still pass without
      // the online wiring -- the timing assertion below is what makes it
      // load-bearing.
      expect(authService.getSSOConfig).toHaveBeenCalledTimes(1);

      // Fire online before the 500ms backoff elapses, then measure recovery.
      const t0 = performance.now();
      window.dispatchEvent(new Event('online'));

      const ssoSection = await screen.findByTestId(
        'sso-section',
        {},
        { timeout: 2000 }
      );
      expect(ssoSection).toBeInTheDocument();
      // Recovery must be well under the 500ms backoff -- proves online
      // drove the retry, not the regular timer.
      expect(performance.now() - t0).toBeLessThan(400);
      expect(screen.queryByTestId('config-error')).not.toBeInTheDocument();
    });

    test('retry button re-runs config load in place (no full page reload)', async () => {
      const reloadSpy = vi.fn();
      const originalLocation = window.location;
      // JSDOM's window.location is read-only; rebuild it with a spied reload.
      delete window.location;
      window.location = { ...originalLocation, reload: reloadSpy };

      try {
        // All retries fail so we land on the config-error state.
        authService.checkRegistrationEnabled.mockResolvedValue({
          registration_enabled: false,
          error: true,
        });
        authService.getSSOConfig.mockResolvedValue({
          enabled: false,
          error: true,
        });

        render(<Login />);

        const errorNotice = await screen.findByTestId(
          'config-error',
          {},
          { timeout: 6000 }
        );
        expect(errorNotice).toBeInTheDocument();
        const callsBeforeRetry =
          authService.checkRegistrationEnabled.mock.calls.length;

        // Swap to a successful response for the retry click.
        authService.checkRegistrationEnabled.mockResolvedValue({
          registration_enabled: true,
        });
        authService.getSSOConfig.mockResolvedValue({
          enabled: true,
          provider_type: 'google',
        });

        const user = userEvent.setup();
        await user.click(screen.getByText('login.retry'));

        expect(
          await screen.findByTestId('sso-section', {}, { timeout: 3000 })
        ).toBeInTheDocument();
        expect(
          authService.checkRegistrationEnabled.mock.calls.length
        ).toBeGreaterThan(callsBeforeRetry);
        expect(reloadSpy).not.toHaveBeenCalled();
      } finally {
        window.location = originalLocation;
      }
    }, 10000);
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
