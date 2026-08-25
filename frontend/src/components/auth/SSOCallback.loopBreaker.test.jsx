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
import { stubWorkingSessionStorage } from '../../test-utils/browserStubs';
import { consumeAutoRedirectAttempt } from '../../utils/autoRedirectGuard';

vi.spyOn(authService, 'completeSSOAuth');

const SSO_USER = { id: 7, username: 'ssouser', role: 'user' };

/**
 * A successful sign-in has to reset the auto-redirect bounce counter.
 *
 * The counter stops a loop: bounce to the provider, come back without a session,
 * bounce again. Three of those in a minute and the login page stops trying. But
 * a user who signs in successfully was never in a loop, and if the counter is
 * never cleared, their earlier bounces stay on the clock -- so a legitimate
 * sign-in later in the same session can be refused by a count it did not earn.
 *
 * This existed as a documented lifecycle with no production caller: the module
 * exported `clearAutoRedirectAttempts`, its docstring said "called on any
 * successful authentication", and nothing called it. The counter reset only when
 * its 60-second window rolled off. These tests are what makes the docstring true.
 */
describe('SSOCallback clears the auto-redirect counter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('code=test-code&state=test-state');
    stubWorkingSessionStorage();
  });

  /** Burn the allowance, so a failure to clear is observable. */
  const exhaustAttempts = () => {
    expect(consumeAutoRedirectAttempt()).toBe(true);
    expect(consumeAutoRedirectAttempt()).toBe(true);
    expect(consumeAutoRedirectAttempt()).toBe(true);
    // Allowance spent: the next bounce would be refused.
    expect(consumeAutoRedirectAttempt()).toBe(false);
  };

  test('a successful login resets a spent allowance', async () => {
    exhaustAttempts();

    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: false,
    });

    render(<SSOCallback />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(consumeAutoRedirectAttempt()).toBe(true);
  });

  test('resets on the forced-password-change path too', async () => {
    // Still a successful authentication -- the session exists, so the bounces
    // that preceded it were not a loop.
    exhaustAttempts();

    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: true,
    });

    render(<SSOCallback />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
        replace: true,
      })
    );
    expect(consumeAutoRedirectAttempt()).toBe(true);
  });

  test('a FAILED callback does not reset the allowance', async () => {
    // The case the counter exists for. Clearing here would defeat it entirely:
    // every loop iteration ends in a callback, so resetting on failure would
    // hand back the allowance on exactly the path that is looping.
    exhaustAttempts();

    authService.completeSSOAuth.mockResolvedValue({
      success: false,
      error: 'SSO authentication failed',
    });

    render(<SSOCallback />);

    await waitFor(() =>
      expect(authService.completeSSOAuth).toHaveBeenCalled()
    );
    expect(consumeAutoRedirectAttempt()).toBe(false);
  });
});
