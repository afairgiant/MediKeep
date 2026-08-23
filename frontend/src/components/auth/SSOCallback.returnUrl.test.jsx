import { vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import render from '../../test-utils/render';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('code=test-code&state=test-state');

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('./SSOConflictModal', () => ({ default: () => null }));
vi.mock('./GitHubLinkModal', () => ({ default: () => null }));

import SSOCallback from './SSOCallback';
import { authService } from '../../services/auth/simpleAuthService';
import { withThrowingSessionStorage } from '../../test-utils/browserStubs';

vi.spyOn(authService, 'completeSSOAuth');

const SSO_USER = { id: 7, username: 'ssouser', role: 'user' };

/**
 * Deep-link preservation across the SSO round trip used to rest entirely on
 * sessionStorage, which is exactly the mechanism that fails in private browsing
 * and with storage disabled. The backend now carries the return path in the
 * state entry, keyed to the OAuth state parameter, which survives anything
 * sessionStorage does not.
 */
describe('SSOCallback return path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('code=test-code&state=test-state');
    sessionStorage.clear();
    // clearAllMocks clears calls but keeps implementations, and these mocks are
    // shared across the file - without this a stored value set by one case leaks
    // into the next and quietly satisfies assertions it should not.
    sessionStorage.getItem.mockReturnValue(null);
  });

  const renderCallback = () => {
    render(<SSOCallback />, { authContextValue: { login: vi.fn() } });
  };

  // setupTests replaces sessionStorage with bare vi.fn()s that hold nothing, so
  // a stored value has to be handed to getItem rather than written first.
  const storedReturnUrl = value => {
    sessionStorage.getItem.mockImplementation(key =>
      key === 'sso_return_url' ? value : null
    );
  };

  const expectRedirect = async path =>
    waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(path, { replace: true })
    );

  const successResult = extra => ({
    success: true,
    user: SSO_USER,
    isNewUser: false,
    mustChangePassword: false,
    ...extra,
  });

  test('uses the return path the server carried through the state entry', async () => {
    authService.completeSSOAuth.mockResolvedValue(
      successResult({ returnUrl: '/patients/42' })
    );

    renderCallback();

    await expectRedirect('/patients/42');
  });

  test('the server path wins over a stale sessionStorage value', async () => {
    storedReturnUrl('/medications');
    authService.completeSSOAuth.mockResolvedValue(
      successResult({ returnUrl: '/patients/42' })
    );

    renderCallback();

    await expectRedirect('/patients/42');
    // And the stale value must not survive to influence a later login.
    await waitFor(() =>
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('sso_return_url')
    );
  });

  test('falls back to sessionStorage when the server carried nothing', async () => {
    storedReturnUrl('/medications');
    authService.completeSSOAuth.mockResolvedValue(
      successResult({ returnUrl: null })
    );

    renderCallback();

    // A flow started before the backend began returning return_url still has one
    // here, so the fallback is kept deliberately rather than removed.
    await expectRedirect('/medications');
  });

  /**
   * The real case this exists for: the mechanism must not depend on storage.
   */
  test('works with sessionStorage unavailable', async () => {
    await withThrowingSessionStorage(async () => {
      authService.completeSSOAuth.mockResolvedValue(
        successResult({ returnUrl: '/lab-results?status=open' })
      );

      renderCallback();

      await expectRedirect('/lab-results?status=open');
    });
  });

  /**
   * return_url reaches the backend as a free-text query parameter, is stored
   * verbatim and echoed back verbatim. Navigating to it unchecked would be an
   * open redirect at the highest-trust moment in the app. See 8.11.
   */
  test.each([
    ['an absolute URL', 'https://evil.example/steal'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash protocol-relative URL', '/\\evil.example'],
  ])(
    'rejects %s from the callback and lands on the dashboard',
    async (_label, hostile) => {
      authService.completeSSOAuth.mockResolvedValue(
        successResult({ returnUrl: hostile })
      );

      renderCallback();

      await expectRedirect('/dashboard');
    }
  );

  test('a new user still goes to profile completion', async () => {
    authService.completeSSOAuth.mockResolvedValue(
      successResult({ isNewUser: true, returnUrl: '/patients/42' })
    );

    renderCallback();

    await expectRedirect('/patients/me?edit=true');
  });
});
