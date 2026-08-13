import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import render from '../../test-utils/render';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('code=test-code&state=test-state');

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

// The modals are driven by their own UI; stub them so this file tests
// SSOCallback's post-login routing rather than the modals' internals.
vi.mock('./SSOConflictModal', () => ({
  default: ({ isOpen, onResolve }) =>
    isOpen ? (
      <button
        onClick={() =>
          onResolve({
            action: 'link',
            preference: 'auto_link',
            tempToken: 'temp-token',
          })
        }
      >
        resolve-conflict
      </button>
    ) : null,
}));

vi.mock('./GitHubLinkModal', () => ({
  default: ({ isOpen, onLinkComplete }) =>
    isOpen ? (
      <button
        onClick={() =>
          onLinkComplete({
            // Raw backend response shape - snake_case
            user: { id: 3, username: 'ghuser', role: 'user' },
            access_token: 'token',
            is_new_user: false,
            must_change_password: true,
          })
        }
      >
        complete-github-link
      </button>
    ) : null,
}));

import SSOCallback from './SSOCallback';
import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'completeSSOAuth');
vi.spyOn(authService, 'resolveSSOConflict');

const SSO_USER = { id: 7, username: 'ssouser', role: 'user' };

/**
 * Guards the lockout regression: an SSO user flagged must_change_password used to
 * land on the dashboard, where every API call returned 403 with no way out.
 */
describe('SSOCallback - must change password routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('code=test-code&state=test-state');
    sessionStorage.clear();
  });

  const renderCallback = () => {
    const login = vi.fn();
    render(<SSOCallback />, { authContextValue: { login } });
    return login;
  };

  test('passes the flag to login and routes to /change-password', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: true,
    });

    const login = renderCallback();

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(SSO_USER, {
        sso: true,
        mustChangePassword: true,
      })
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
        replace: true,
      })
    );
  });

  test('routes to the dashboard when the flag is not set', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: false,
    });

    const login = renderCallback();

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(SSO_USER, {
        sso: true,
        mustChangePassword: false,
      })
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    );
  });

  test('the flag wins over the new-user profile redirect', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: true,
      mustChangePassword: true,
    });

    renderCallback();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
        replace: true,
      })
    );
  });

  test('the flag wins over a stored return URL', async () => {
    sessionStorage.setItem('sso_return_url', '/medications');
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: true,
    });

    renderCallback();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
        replace: true,
      })
    );
  });

  test('conflict resolution carries the flag through', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      conflict: true,
      existing_user_info: { email: 'ssouser@example.com' },
      sso_user_info: { email: 'ssouser@example.com' },
      temp_token: 'temp-token',
    });
    authService.resolveSSOConflict.mockResolvedValue({
      success: true,
      user: SSO_USER,
      isNewUser: false,
      mustChangePassword: true,
    });

    const login = renderCallback();
    const user = userEvent.setup();

    await user.click(await screen.findByText('resolve-conflict'));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(SSO_USER, {
        sso: true,
        mustChangePassword: true,
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
      replace: true,
    });
  });

  test('GitHub manual linking carries the flag through', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: true,
      github_manual_link: true,
      github_user_info: { github_username: 'ghuser' },
      temp_token: 'temp-token',
    });

    const login = renderCallback();
    const user = userEvent.setup();

    await user.click(await screen.findByText('complete-github-link'));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        { id: 3, username: 'ghuser', role: 'user' },
        { sso: true, mustChangePassword: true }
      )
    );
    expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
      replace: true,
    });
  });
});
