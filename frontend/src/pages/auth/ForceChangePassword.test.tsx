import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ForceChangePassword from './ForceChangePassword';
import render from '../../test-utils/render';
import logger from '../../services/logger';
import { apiService } from '../../services/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  apiService: { changePassword: vi.fn() },
}));

describe('ForceChangePassword', () => {
  const mockLogout = vi.fn().mockResolvedValue(undefined);
  const mockClearMustChangePassword = vi.fn();

  const authContext = {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, username: 'admin' },
    logout: mockLogout,
    clearMustChangePassword: mockClearMustChangePassword,
    mustChangePassword: true,
    hasRole: vi.fn(() => true),
    hasAnyRole: vi.fn(() => true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(<ForceChangePassword />, { authContextValue: authContext });

  // Helper: fill all three fields and submit the form
  const fillAndSubmit = (currentPwd: string, newPwd: string, confirmPwd: string) => {
    const currentInput = document.getElementById('currentPassword') as HTMLInputElement;
    const newInput = document.getElementById('newPassword') as HTMLInputElement;
    const confirmInput = document.getElementById('confirmPassword') as HTMLInputElement;
    fireEvent.change(currentInput, { target: { value: currentPwd, name: 'currentPassword' } });
    fireEvent.change(newInput, { target: { value: newPwd, name: 'newPassword' } });
    fireEvent.change(confirmInput, { target: { value: confirmPwd, name: 'confirmPassword' } });
    fireEvent.submit(document.querySelector('form')!);
  };

  describe('Rendering', () => {
    test('renders all three password input fields', () => {
      renderComponent();
      expect(document.getElementById('currentPassword')).toBeInTheDocument();
      expect(document.getElementById('newPassword')).toBeInTheDocument();
      expect(document.getElementById('confirmPassword')).toBeInTheDocument();
    });

    test('renders title via i18n key', () => {
      renderComponent();
      expect(
        screen.getByText('settings.security.password.forceChange.title')
      ).toBeInTheDocument();
    });

    test('renders subtitle via i18n key', () => {
      renderComponent();
      expect(
        screen.getByText('settings.security.password.forceChange.subtitle')
      ).toBeInTheDocument();
    });

    test('renders within login-container layout', () => {
      renderComponent();
      expect(document.querySelector('.login-container')).toBeInTheDocument();
      expect(document.querySelector('.login-form')).toBeInTheDocument();
    });

    test('renders a submit button', () => {
      renderComponent();
      expect(document.querySelector('button[type="submit"]')).toBeInTheDocument();
    });
  });

  describe('Client-side Validation', () => {
    test('shows allFieldsRequired error when all fields are empty', async () => {
      renderComponent();
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.allFieldsRequired'
          )
        ).toBeInTheDocument();
      });
      expect(apiService.changePassword).not.toHaveBeenCalled();
    });

    test('shows passwordsMustMatch error when new passwords differ', async () => {
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass1', 'different1');
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.passwordsMustMatch'
          )
        ).toBeInTheDocument();
      });
      expect(apiService.changePassword).not.toHaveBeenCalled();
    });

    test('shows passwordTooShort error when new password is under 6 chars', async () => {
      renderComponent();
      fillAndSubmit('oldpass1', 'ab1', 'ab1');
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.passwordTooShort'
          )
        ).toBeInTheDocument();
      });
      expect(apiService.changePassword).not.toHaveBeenCalled();
    });

    test('shows passwordMustDiffer error when new password equals current', async () => {
      renderComponent();
      fillAndSubmit('samepass1', 'samepass1', 'samepass1');
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.passwordMustDiffer'
          )
        ).toBeInTheDocument();
      });
      expect(apiService.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('Successful Password Change', () => {
    test('calls changePassword with the correct payload', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({} as never);
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(apiService.changePassword).toHaveBeenCalledWith({
          currentPassword: 'oldpass1',
          newPassword: 'newpass123',
        });
      });
    });

    test('calls clearMustChangePassword and navigates to /dashboard', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({} as never);
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(mockClearMustChangePassword).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    test('logs success info after password change', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({} as never);
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Password changed'),
          expect.objectContaining({ component: 'ForceChangePassword' })
        );
      });
    });
  });

  describe('Failed Password Change', () => {
    test('shows changeFailed error when API rejects', async () => {
      vi.mocked(apiService.changePassword).mockRejectedValue(new Error('Network error'));
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.changeFailed'
          )
        ).toBeInTheDocument();
      });
    });

    test('logs error with component context and error message', async () => {
      vi.mocked(apiService.changePassword).mockRejectedValue(new Error('API error'));
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to change password'),
          expect.objectContaining({
            component: 'ForceChangePassword',
            error: 'API error',
          })
        );
      });
    });

    test('does not navigate or clear flag when API fails', async () => {
      vi.mocked(apiService.changePassword).mockRejectedValue(new Error('API error'));
      renderComponent();
      fillAndSubmit('oldpass1', 'newpass123', 'newpass123');
      await waitFor(() => {
        expect(
          screen.getByText(
            'settings.security.password.forceChange.errors.changeFailed'
          )
        ).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockClearMustChangePassword).not.toHaveBeenCalled();
    });
  });

  describe('Logout', () => {
    test('calls logout and navigates to /login', async () => {
      renderComponent();
      const buttons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = buttons.find(b =>
        b.textContent?.includes('navigation:menu.logout')
      );
      expect(logoutBtn).toBeDefined();
      if (logoutBtn) fireEvent.click(logoutBtn);
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });
});
