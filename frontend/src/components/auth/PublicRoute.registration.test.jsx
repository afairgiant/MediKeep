import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { render } from '@testing-library/react';
import { PublicRoute } from './ProtectedRoute';
import { resetRegistrationAvailability } from '../../hooks/useRegistrationAvailable';

let mockAuth = { isAuthenticated: false, isLoading: false, mustChangePassword: false };
vi.mock('../../contexts/AuthContext', async () => ({
  ...(await vi.importActual('../../contexts/AuthContext')),
  useAuth: () => mockAuth,
}));

import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'checkRegistrationEnabled');

/**
 * /user-creation must not render a form the server will refuse.
 *
 * Before this guard the page had no protection of any kind: PublicRoute checked
 * only isAuthenticated and UserRegistrationForm never read registration status,
 * so a direct visit with ALLOW_USER_REGISTRATION=false rendered the whole form
 * and failed at submit. SSO_ONLY_MODE reaches the same state by a second route,
 * which is why the guard keys off the endpoint that folds both in.
 */

/**
 * Reports the URL the guard actually redirected to. Asserting on rendered markup
 * cannot tell "no reason was attached" from "a reason was attached and the login
 * page happens not to print it".
 */
const LoginPage = () => {
  const location = useLocation();
  return (
    <div>
      <span>login page</span>
      <span data-testid="login-search">{location.search}</span>
    </div>
  );
};

const renderUserCreation = () =>
  render(
    <MemoryRouter initialEntries={['/user-creation']}>
      <Routes>
        <Route
          path="/user-creation"
          element={
            <PublicRoute requiresRegistration>
              <div>registration form</div>
            </PublicRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetRegistrationAvailability();
  mockAuth = { isAuthenticated: false, isLoading: false, mustChangePassword: false };
});

describe('when registration is unavailable', () => {
  test('bounces to the login page', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
    });

    renderUserCreation();

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('registration form')).not.toBeInTheDocument();
  });

  test('carries no reason -- nobody was signed out', async () => {
    // A reason would tell a visitor who was never signed in that they had been,
    // and would suppress a redirect to the identity provider that should happen.
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
    });

    renderUserCreation();
    await screen.findByText('login page');

    const params = new URLSearchParams(
      screen.getByTestId('login-search').textContent
    );
    expect(params.get('reason')).toBeNull();
  });
});

describe('when registration is available', () => {
  test('renders the form', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: true,
    });

    renderUserCreation();

    expect(await screen.findByText('registration form')).toBeInTheDocument();
  });
});

describe('when the status lookup fails', () => {
  test('fails open and renders the form', async () => {
    // The server refuses the POST regardless, so guessing wrong costs a
    // rejected submit. Bouncing on a network blip strands someone who
    // legitimately can register, with nowhere to go.
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      error: true,
    });

    renderUserCreation();

    expect(await screen.findByText('registration form')).toBeInTheDocument();
  });

  test('a thrown lookup also fails open', async () => {
    authService.checkRegistrationEnabled.mockRejectedValue(
      new Error('network down')
    );

    renderUserCreation();

    expect(await screen.findByText('registration form')).toBeInTheDocument();
  });
});

describe('routes that do not opt in', () => {
  test('/login makes no registration request at all', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>login page</div>
              </PublicRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(authService.checkRegistrationEnabled).not.toHaveBeenCalled();
  });

  test('an authenticated visitor goes to the dashboard without a lookup', async () => {
    mockAuth.isAuthenticated = true;
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
    });

    renderUserCreation();

    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(authService.checkRegistrationEnabled).not.toHaveBeenCalled();
  });
});

describe('the shared lookup', () => {
  test('is fetched once across several mounts', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: true,
    });

    const first = renderUserCreation();
    await screen.findByText('registration form');
    first.unmount();

    renderUserCreation();
    await screen.findByText('registration form');

    await waitFor(() =>
      expect(authService.checkRegistrationEnabled).toHaveBeenCalledTimes(1)
    );
  });
});
