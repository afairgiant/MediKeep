import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithAuth } from '../../test-utils/render';
import ProfileSettings from './ProfileSettings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (typeof opts === 'string') return opts;
      if (opts && typeof opts === 'object' && 'max' in opts) {
        return `${key} (max ${opts.max})`;
      }
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return String(opts.defaultValue);
      }
      return key;
    },
  }),
}));

const mockUpdateUserProfile = vi.fn();
vi.mock('../../services/api', () => ({
  apiService: {
    updateUserProfile: (...args) => mockUpdateUserProfile(...args),
  },
}));

const mockNotifySuccess = vi.fn();
vi.mock('../../utils/notifyTranslated', () => ({
  notifySuccess: (...args) => mockNotifySuccess(...args),
}));

vi.mock('../../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const baseUser = {
  id: 7,
  username: 'janedoe',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'user',
};

function renderProfile(overrides = {}) {
  const updateUser = vi.fn();
  const logout = vi.fn().mockResolvedValue();
  const result = renderWithAuth(<ProfileSettings />, {
    authContextValue: {
      user: { ...baseUser, ...overrides },
      updateUser,
      logout,
    },
  });
  return { ...result, updateUser, logout };
}

beforeEach(() => {
  mockUpdateUserProfile.mockReset();
  mockNotifySuccess.mockReset();
});

describe('ProfileSettings', () => {
  it('renders current user values into inputs', () => {
    renderProfile();
    expect(screen.getByLabelText(/profile\.fields\.username/)).toHaveValue('janedoe');
    expect(screen.getByLabelText(/profile\.fields\.email/)).toHaveValue('jane@example.com');
    expect(screen.getByLabelText(/profile\.fields\.fullName/)).toHaveValue('Jane Doe');
  });

  it('disables save when no changes have been made', () => {
    renderProfile();
    expect(screen.getByRole('button', { name: 'profile.save' })).toBeDisabled();
  });

  it('rejects an invalid username before calling the API', async () => {
    renderProfile();
    const input = screen.getByLabelText(/profile\.fields\.username/);
    fireEvent.change(input, { target: { value: 'has spaces' } });
    fireEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() =>
      expect(screen.getByText(/profile\.errors\.usernameChars/i)).toBeInTheDocument()
    );
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('rejects an invalid email before calling the API', async () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText(/profile\.fields\.email/), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() =>
      expect(screen.getByText(/profile\.errors\.emailInvalid/i)).toBeInTheDocument()
    );
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('submits only changed fields and refreshes auth user on non-username change', async () => {
    mockUpdateUserProfile.mockResolvedValue({
      ...baseUser,
      full_name: 'Jane Q. Doe',
    });
    const { updateUser, logout } = renderProfile();

    fireEvent.change(screen.getByLabelText(/profile\.fields\.fullName/), {
      target: { value: 'Jane Q. Doe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() => expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1));
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      full_name: 'Jane Q. Doe',
    });
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Jane Q. Doe' })
    );
    expect(mockNotifySuccess).toHaveBeenCalledWith('profile.updateSuccess');
    expect(logout).not.toHaveBeenCalled();
  });

  it('logs the user out after a successful username change', async () => {
    mockUpdateUserProfile.mockResolvedValue({
      ...baseUser,
      username: 'janed',
    });
    const { updateUser, logout } = renderProfile();

    fireEvent.change(screen.getByLabelText(/profile\.fields\.username/), {
      target: { value: 'janed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({ username: 'janed' });
    expect(updateUser).not.toHaveBeenCalled();
    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'profile.usernameChangedNotice'
    );
  });

  it('surfaces server errors without logging the user out', async () => {
    const error = new Error('Username already taken');
    mockUpdateUserProfile.mockRejectedValue(error);
    const { updateUser, logout } = renderProfile();

    fireEvent.change(screen.getByLabelText(/profile\.fields\.username/), {
      target: { value: 'taken' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() =>
      expect(screen.getByText('Username already taken')).toBeInTheDocument()
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('treats a case-only username edit as no change', () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText(/profile\.fields\.username/), {
      target: { value: 'JaneDoe' },
    });
    expect(screen.getByRole('button', { name: 'profile.save' })).toBeDisabled();
  });

  it('reset button clears unsaved changes', () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText(/profile\.fields\.fullName/), {
      target: { value: 'Changed' },
    });
    expect(screen.getByLabelText(/profile\.fields\.fullName/)).toHaveValue('Changed');

    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(screen.getByLabelText(/profile\.fields\.fullName/)).toHaveValue('Jane Doe');
  });
});
