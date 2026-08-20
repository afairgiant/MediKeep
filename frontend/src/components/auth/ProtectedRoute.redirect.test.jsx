import { describe, test, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { withThrowingSessionStorage } from '../../test-utils/browserStubs';

const mockAuth = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  hasRole: () => false,
  hasAnyRole: () => false,
  mustChangePassword: false,
  sessionEndedReason: null,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../../utils/notifyTranslated', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock('../ui/LoadingSpinner', () => ({
  default: () => <div>loading</div>,
}));

/** Stand-in for the login page that reports the URL it was reached with. */
const LoginProbe = () => {
  const location = useLocation();
  return <div data-testid="login-search">{location.search}</div>;
};

const renderAt = (initialPath, { strict = false } = {}) => {
  const tree = (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/lab-results"
          element={
            <ProtectedRoute>
              <div>protected</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const loginParams = () =>
  new URLSearchParams(screen.getByTestId('login-search').textContent);

/**
 * ProtectedRoute is where the reason recorded by AuthContext becomes a URL. It
 * is also the one redirect that is SUPPOSED to reach the identity provider when
 * SSO_AUTO_REDIRECT is on, so both directions matter: suppress when the session
 * ended, and do not suppress when it never existed.
 */
describe('ProtectedRoute login redirect', () => {
  beforeEach(() => {
    mockAuth.isAuthenticated = false;
    mockAuth.isLoading = false;
    mockAuth.sessionEndedReason = null;
  });

  /**
   * The assertion that stops someone "simplifying" this by suppressing
   * unconditionally, which would quietly disable the whole auto-redirect feature.
   */
  test('a fresh visitor is not suppressed, and keeps their deep link', () => {
    renderAt('/lab-results?status=open');

    const params = loginParams();
    expect(params.get('local')).toBeNull();
    expect(params.get('reason')).toBeNull();
    expect(params.get('next')).toBe('/lab-results?status=open');
  });

  // The whole point of `next` is landing the user back where they were. A path
  // rebuilt from pathname alone loses the filter and the anchor, which is exactly
  // the deep link worth preserving.
  test('the deep link keeps its query string and fragment', () => {
    renderAt('/lab-results?status=open&sort=date#result-117');

    expect(loginParams().get('next')).toBe(
      '/lab-results?status=open&sort=date#result-117'
    );
  });

  test('after a logout the redirect carries suppression and the reason', () => {
    mockAuth.sessionEndedReason = 'logged_out';
    renderAt('/lab-results');

    const params = loginParams();
    expect(params.get('local')).toBe('1');
    expect(params.get('reason')).toBe('logged_out');
  });

  test('after an inactivity timeout the redirect carries suppression', () => {
    mockAuth.sessionEndedReason = 'session_expired';
    renderAt('/lab-results');

    expect(loginParams().get('reason')).toBe('session_expired');
  });

  test('an authenticated user reaches the protected page', () => {
    mockAuth.isAuthenticated = true;
    renderAt('/lab-results');

    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  /**
   * The reason lives in reducer state rather than a consume-on-read module flag
   * precisely because of this: StrictMode double-invokes render in development,
   * and a flag cleared by the discarded first pass would lose suppression in dev
   * only - the hardest possible place to notice it.
   */
  test('suppression survives a StrictMode double render', () => {
    mockAuth.sessionEndedReason = 'session_expired';
    renderAt('/lab-results', { strict: true });

    expect(loginParams().get('local')).toBe('1');
  });

  /**
   * Storage being unavailable must not affect suppression at all - it travels in
   * the URL specifically so it does not depend on storage. See criterion 10.
   */
  test('suppression works with sessionStorage throwing', () => {
    withThrowingSessionStorage(() => {
      mockAuth.sessionEndedReason = 'logged_out';
      renderAt('/lab-results');
      expect(loginParams().get('local')).toBe('1');
    });
  });
});
